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
    return Array.isArray(parsedData.messages) ? parsedData.messages : [];
  } catch (error) {
    console.error('Error getting chat from localStorage:', error);
    return [];
  }
};

// API base URL
const API_BASE_URL = 'http://localhost:3000';

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

// Fetch chat history from server and sync with local storage
export const fetchChatHistory = async (currentUserId, otherUserId) => {
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Response is not JSON');
      }
      
      const result = await response.json();
      
      if (!result.success || !Array.isArray(result.messages)) {
        console.warn('Invalid server response format, using local messages');
        return localMessages;
      }
      
      const serverMessages = result.messages.map(msg => ({
        id: msg.id,
        from: msg.from,
        to: msg.from === currentUserId ? otherUserId : currentUserId,
        text: msg.content || msg.text || '', // Map content to text for display
        content: msg.content || msg.text || '', // Keep content for backward compatibility
        timestamp: msg.timestamp,
        status: msg.status || (msg.read ? 'read' : 'delivered'),
        read: msg.read
      }));
      
      // 3. Merge and deduplicate messages (favor server versions)
      const messageMap = new Map();
      
      // Add local messages first
      localMessages.forEach(msg => {
        if (msg.id) messageMap.set(msg.id, msg);
      });
      
      // Add/overwrite with server messages
      serverMessages.forEach(msg => {
        if (msg.id) messageMap.set(msg.id, msg);
      });
      
      const mergedMessages = Array.from(messageMap.values())
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // 4. Update local storage with merged data
      saveChatToLocal(currentUserId, otherUserId, mergedMessages);
      
      return mergedMessages;
      
    } catch (error) {
      console.warn('Error fetching from server, using local messages:', error.message);
      return localMessages;
    }
  } catch (error) {
    console.error('Error fetching chat history:', error);
    // Return local messages if server fetch fails
    return getChatFromLocal(currentUserId, otherUserId);
  }
};

// Update a single message in chat history
export const updateMessageInHistory = (currentUserId, otherUserId, message) => {
  try {
    const chatKey = getChatKey(currentUserId, otherUserId);
    const chatData = JSON.parse(localStorage.getItem(chatKey) || '{"messages":[]}');
    
    // Find and update message
    const messageIndex = chatData.messages.findIndex(m => m.id === message.id || m.tempId === message.tempId);
    
    if (messageIndex !== -1) {
      // Update existing message
      chatData.messages[messageIndex] = {
        ...chatData.messages[messageIndex],
        ...message,
        // Preserve existing fields if not being updated
        content: message.content || chatData.messages[messageIndex].content,
        status: message.status || chatData.messages[messageIndex].status
      };
    } else {
      // Add new message
      chatData.messages.push(message);
    }
    
    // Update last updated timestamp
    chatData.lastUpdated = new Date().toISOString();
    
    // Save back to localStorage
    localStorage.setItem(chatKey, JSON.stringify(chatData));
    return true;
  } catch (error) {
    console.error('Error updating message in history:', error);
    return false;
  }
};
