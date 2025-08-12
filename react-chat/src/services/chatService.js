import apiClient from './api';

// Generate a consistent chat key for localStorage
const getChatKey = (userId1, userId2) => {
  const sortedIds = [userId1, userId2].sort();
  return `chat_${sortedIds[0]}_${sortedIds[1]}`;
};

// Save chat messages to localStorage
export const saveChatToLocal = (currentUserId, otherUserId, messages) => {
  try {
    const chatKey = getChatKey(currentUserId, otherUserId);
    const chatData = {
      lastUpdated: new Date().toISOString(),
      messages: messages.map(msg => ({
        id: msg.id,
        from: msg.from || msg.senderId || currentUserId,
        to: msg.to || (msg.from === currentUserId ? otherUserId : currentUserId),
        text: msg.text || msg.content || msg.message || '',
        timestamp: msg.timestamp || new Date().toISOString(),
        status: msg.status || 'sent',
        read: msg.read || msg.status === 'read',
        ...(msg.attachments && { attachments: msg.attachments }),
        ...(msg.tempId && { tempId: msg.tempId })
      }))
    };
    
    localStorage.setItem(chatKey, JSON.stringify(chatData));
    return true;
  } catch (error) {
    console.error('Error saving chat to localStorage:', error);
    return false;
  }
};

// Get chat history from localStorage
export const getChatFromLocal = (currentUserId, otherUserId) => {
  try {
    const chatKey = getChatKey(currentUserId, otherUserId);
    const chatData = localStorage.getItem(chatKey);
    
    if (!chatData) return [];
    
    const parsedData = JSON.parse(chatData);
    
    // Ensure we have a valid messages array
    if (!Array.isArray(parsedData.messages)) {
      console.warn('Invalid chat data format, initializing new chat');
      return [];
    }
    
    // Process messages to ensure they have all required fields
    const processedMessages = parsedData.messages.map(msg => ({
      id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: msg.from,
      to: msg.to,
      text: msg.text || msg.content || '',
      timestamp: msg.timestamp || Date.now(),
      status: msg.status || 'sent',
      ...(msg.attachments && { attachments: msg.attachments }),
      ...(msg.read !== undefined && { read: msg.read })
    }));
    
    // Sort messages by timestamp to ensure correct order
    return processedMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
  } catch (error) {
    console.error('Error getting chat from localStorage:', error);
    return [];
  }
};

// API base URL
const API_BASE_URL = 'https://us-central1-securityerp.cloudfunctions.net';
//const API_BASE_URL = 'http://localhost:3000';

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'https://us-central1-securityerp.cloudfunctions.net';
//const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Fetch user status
function authHeaders() {
  const token = localStorage.getItem('authToken');
  const accessKey = localStorage.getItem('accessKey');
  return {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(accessKey && { 'x-access-key': accessKey }),
    'Content-Type': 'application/json'
  };
}

export async function fetchUserStatus(userId) {
  if (!userId) throw new Error('userId required');
  const res = await fetch(`${API_BASE}/api/chat/user/status/${userId}`, {
    headers: authHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch status');
  const json = await res.json();
  return json?.data || { userId, status: 'offline', isOnline: false };
}

// Update user status
export async function updateUserStatus({ userId, status }) {
  const res = await fetch(`${API_BASE}/api/chat/user/status`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ userId, status })
  });
  if (!res.ok) throw new Error('Failed to update status');
  const json = await res.json();
  return json?.data;
}

// Delete chat history for a conversation
export const deleteChatHistory = async (currentUserId, otherUserId) => {
  if (!currentUserId || !otherUserId) return false;
  try {
    const res = await fetch(`${API_BASE}/api/chat/history`, {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ userId: currentUserId, otherUserId })
    });
    if (!res.ok) throw new Error('Failed to delete history');
    return true;
  } catch (err) {
    console.error('Error deleting chat history:', err);
    return false;
  }
};

// Fetch chat history from server and sync with local storage
export const fetchChatHistory = async (currentUserId, otherUserId) => {
  // If chat was previously deleted, stop early
  const sortedIds = [currentUserId, otherUserId].sort();
  if (localStorage.getItem(`deleted_chat_${sortedIds[0]}_${sortedIds[1]}`)) {
    return [];
  }
  try {
    // 1. Get local messages first for instant display
    const localMessages = getChatFromLocal(currentUserId, otherUserId);
    
    try {
      // 2. Fetch from server
      const response = await fetch(`${API_BASE_URL}/api/chat/history?userId=${currentUserId}&otherUserId=${otherUserId}`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      const serverData = await response.json();
      const serverMessages = Array.isArray(serverData.messages) ? serverData.messages : [];
      
      // 3. Create a map of all messages by ID for easy lookup
      const messageMap = new Map();
      
      // Process local messages first
      localMessages.forEach(msg => {
        if (msg && msg.id) {
          messageMap.set(msg.id, {
            ...msg,
            // Mark source as local
            _source: 'local'
          });
        }
      });
      
      // Process server messages and merge with local
      serverMessages.forEach(msg => {
        if (msg && msg.id) {
          const existingMsg = messageMap.get(msg.id);
          
          if (existingMsg) {
            // Merge with existing message, preferring server data but keeping local status
            messageMap.set(msg.id, {
              ...existingMsg,
              ...msg,
              // Preserve local status if it's 'read' and server status is older
              status: (existingMsg.status === 'read' && 
                      msg.status !== 'read' && 
                      existingMsg.timestamp > (msg.updatedAt || 0)) 
                ? 'read' 
                : (msg.status || existingMsg.status || 'sent'),
              // Keep the latest timestamp
              timestamp: Math.max(
                existingMsg.timestamp || 0, 
                msg.timestamp || 0,
                new Date(msg.createdAt || 0).getTime() || 0
              ),
              // Mark as synced
              _synced: true
            });
          } else {
            // Add new message from server
            messageMap.set(msg.id, {
              ...msg,
              _source: 'server',
              _synced: true
            });
          }
        }
      });
      
      // Convert map back to array and sort by timestamp
      let mergedMessages = Array.from(messageMap.values())
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      
      // Filter out any invalid messages
      mergedMessages = mergedMessages.filter(msg => 
        msg && 
        msg.id && 
        (msg.text || msg.content || '').trim() !== ''
      );
      
      // 4. Update local storage with merged data
      saveChatToLocal(currentUserId, otherUserId, mergedMessages);
      
      return mergedMessages;
      
    } catch (error) {
      console.warn('Error fetching from server, using local messages:', error.message);
      // Ensure we return valid messages even if server fetch fails
      return localMessages.filter(msg => msg && msg.id && (msg.text || msg.content || '').trim() !== '');
    }
  } catch (error) {
    console.error('Error in fetchChatHistory:', error);
    // Return empty array if both local and server fetches fail
    return [];
  }
};

// Helper function to send messages to backend
const sendMessageToBackend = async (userId, otherUserId, message) => {
  try {
    await apiClient.post('/api/chat/messages', {
      userId,
      otherUserId,
      messages: [{
        id: message.id,
        from: message.from,
        content: message.text || message.content,
        timestamp: message.timestamp,
        read: message.status === 'read',
        status: message.status || 'sent'
      }]
    });
  } catch (error) {
    console.error('Error sending message to backend:', error);
    // Don't throw error to keep the UI working
  }
};

// Update a single message in chat history and sync with backend
export const updateMessageInHistory = async (currentUserId, otherUserId, message) => {
  try {
    const chatKey = getChatKey(currentUserId, otherUserId);
    const existingData = localStorage.getItem(chatKey);
    let chatData = { messages: [] };
    let isNewMessage = false;
    
    // Parse existing data if it exists
    if (existingData) {
      try {
        chatData = JSON.parse(existingData);
        // Ensure messages is an array
        if (!Array.isArray(chatData.messages)) {
          chatData.messages = [];
        }
      } catch (e) {
        console.warn('Corrupted chat data, resetting...');
        chatData = { messages: [] };
      }
    }
    
    // If message has an ID, check if it already exists
    if (message.id) {
      const existingIndex = chatData.messages.findIndex(m => m.id === message.id);
      
      if (existingIndex !== -1) {
        // Update existing message while preserving any existing fields
        chatData.messages[existingIndex] = {
          ...chatData.messages[existingIndex],
          ...message,
          // Preserve timestamp if not being updated
          timestamp: message.timestamp || chatData.messages[existingIndex].timestamp
        };
      } else {
        // Add new message
        chatData.messages.push({
          id: message.id,
          from: message.from || currentUserId,
          to: message.to || otherUserId,
          text: message.text || message.content || '',
          timestamp: message.timestamp || Date.now(),
          status: message.status || 'sent',
          ...(message.attachments && { attachments: message.attachments })
        });
        isNewMessage = true;
      }
    } else if (message.tempId) {
      // Handle temporary IDs (for messages being sent)
      const tempIndex = chatData.messages.findIndex(m => m.tempId === message.tempId);
      if (tempIndex !== -1) {
        chatData.messages[tempIndex] = {
          ...chatData.messages[tempIndex],
          ...message,
          // If we now have a real ID, remove the tempId
          ...(message.id && { tempId: undefined })
        };
        isNewMessage = !!message.id; // Consider it new if we got a real ID
      } else {
        chatData.messages.push(message);
        isNewMessage = true;
      }
    } else {
      // Fallback: add as new message with generated ID
      const newMessage = {
        ...message,
        id: message.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: message.timestamp || Date.now(),
        from: message.from || currentUserId,
        to: message.to || otherUserId
      };
      chatData.messages.push(newMessage);
      isNewMessage = true;
    }
    
    // Sort messages by timestamp to maintain order
    chatData.messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Limit the number of messages to prevent localStorage overflow
    const MAX_MESSAGES = 1000;
    if (chatData.messages.length > MAX_MESSAGES) {
      chatData.messages = chatData.messages.slice(-MAX_MESSAGES);
    }
    
    // Update last updated timestamp
    chatData.lastUpdated = new Date().toISOString();
    
    // Save to localStorage
    localStorage.setItem(chatKey, JSON.stringify(chatData));
    
    // Send to backend if it's a new message
    const lastMessage = chatData.messages[chatData.messages.length - 1];
    if (isNewMessage && lastMessage) {
      await sendMessageToBackend(currentUserId, otherUserId, lastMessage);
    }
    
    return true;
  } catch (error) {
    console.error('Error updating message in history:', error);
    return false;
  }
};

/**
 * Soft delete a message
 * @param {string} currentUserId - ID of the current user
 * @param {string} otherUserId - ID of the other user in the chat
 * @param {string} messageId - ID of the message to delete
 * @returns {Promise<boolean>} - True if successful
 */
export const softDeleteMessage = async (currentUserId, otherUserId, messageId) => {
  try {
    const chatKey = getChatKey(currentUserId, otherUserId);
    const existingData = localStorage.getItem(chatKey);
    
    if (!existingData) return false;
    
    let chatData;
    try {
      chatData = JSON.parse(existingData);
      if (!Array.isArray(chatData.messages)) {
        chatData.messages = [];
      }
    } catch (e) {
      console.warn('Corrupted chat data during delete:', e);
      return false;
    }

    // Remove the message from local storage
    const initialLength = chatData.messages.length;
    chatData.messages = chatData.messages.filter(m => m.id !== messageId);
    
    if (chatData.messages.length === initialLength) {
      console.warn('Message not found for deletion:', messageId);
      return false;
    }

    // Update last updated timestamp
    chatData.lastUpdated = new Date().toISOString();
    
    // Save back to localStorage
    localStorage.setItem(chatKey, JSON.stringify(chatData));
    
    try {
      // Call the API to soft delete the message
      await apiClient.post('/api/chat/messages/soft-delete', {
        messageIds: [messageId],
        userId: currentUserId,
        otherUserId: otherUserId
      });
    } catch (error) {
      console.error('Error deleting message from server:', error);
      // Continue even if server delete fails
    }
    
    return true;
  } catch (error) {
    console.error('Error in softDeleteMessage:', error);
    return false;
  }
};
