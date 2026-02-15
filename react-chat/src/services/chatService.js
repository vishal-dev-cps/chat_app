// import api from './api';

// // ===== CHAT KEY UTILITY =====
// export const getChatKey = (userId1, userId2) => {
//   const sortedIds = [userId1, userId2].sort();
//   return `chat_${sortedIds[0]}_${sortedIds[1]}`;
// };

// // ===== LOCAL STORAGE OPERATIONS =====
// export const saveChatToLocal = (userId1, userId2, messages) => {
//   try {
//     const chatKey = getChatKey(userId1, userId2);
//     localStorage.setItem(chatKey, JSON.stringify(messages));
    
//     // Also update last message cache for quick access
//     const lastMessage = messages[messages.length - 1];
//     if (lastMessage) {
//       const lastMsgKey = `last_msg_${chatKey}`;
//       localStorage.setItem(lastMsgKey, JSON.stringify({
//         text: lastMessage.text,
//         timestamp: lastMessage.timestamp,
//         from: lastMessage.from,
//         isDeleted: lastMessage.isDeleted || false
//       }));
//     }
//   } catch (error) {
//     console.error('Error saving chat to localStorage:', error);
//   }
// };

// export const getChatFromLocal = (userId1, userId2) => {
//   try {
//     const chatKey = getChatKey(userId1, userId2);
//     const data = localStorage.getItem(chatKey);
//     return data ? JSON.parse(data) : [];
//   } catch (error) {
//     console.error('Error getting chat from localStorage:', error);
//     return [];
//   }
// };

// export const getLastMessage = (userId1, userId2) => {
//   try {
//     const chatKey = getChatKey(userId1, userId2);
//     const lastMsgKey = `last_msg_${chatKey}`;
//     const data = localStorage.getItem(lastMsgKey);
    
//     if (data) {
//       return JSON.parse(data);
//     }
    
//     // Fallback: get from full chat history
//     const messages = getChatFromLocal(userId1, userId2);
//     if (messages.length > 0) {
//       const lastMsg = messages[messages.length - 1];
//       return {
//         text: lastMsg.text,
//         timestamp: lastMsg.timestamp,
//         from: lastMsg.from,
//         isDeleted: lastMsg.isDeleted || false
//       };
//     }
    
//     return null;
//   } catch (error) {
//     console.error('Error getting last message:', error);
//     return null;
//   }
// };

// // ===== UNREAD MESSAGE COUNT =====
// export const getUnreadCount = (currentUserId, otherUserId) => {
//   try {
//     const messages = getChatFromLocal(currentUserId, otherUserId);
//     return messages.filter(msg => 
//       msg.from === otherUserId && 
//       msg.to === currentUserId && 
//       msg.status !== 'read'
//     ).length;
//   } catch (error) {
//     console.error('Error calculating unread count:', error);
//     return 0;
//   }
// };

// export const markMessagesAsRead = async (currentUserId, otherUserId) => {
//   try {
//     const messages = getChatFromLocal(currentUserId, otherUserId);
//     const updatedMessages = messages.map(msg => {
//       if (msg.from === otherUserId && msg.to === currentUserId && msg.status !== 'read') {
//         return { ...msg, status: 'read' };
//       }
//       return msg;
//     });
    
//     saveChatToLocal(currentUserId, otherUserId, updatedMessages);
//     return updatedMessages;
//   } catch (error) {
//     console.error('Error marking messages as read:', error);
//     return [];
//   }
// };

// // ===== MESSAGE OPERATIONS =====
// export const updateMessageInHistory = async (userId1, userId2, message) => {
//   try {
//     const messages = getChatFromLocal(userId1, userId2);
//     const existingIndex = messages.findIndex(m => m.id === message.id);
    
//     if (existingIndex !== -1) {
//       // Update existing message
//       messages[existingIndex] = { ...messages[existingIndex], ...message };
//     } else {
//       // Add new message
//       messages.push(message);
//     }
    
//     // Sort by timestamp
//     messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
//     saveChatToLocal(userId1, userId2, messages);
//     return message;
//   } catch (error) {
//     console.error('Error updating message in history:', error);
//     return null;
//   }
// };

// // ===== SOFT DELETE MESSAGE (WhatsApp style) =====
// export const softDeleteMessage = async (userId1, userId2, messageId) => {
//   try {
//     const messages = getChatFromLocal(userId1, userId2);
//     const messageIndex = messages.findIndex(m => m.id === messageId);
    
//     if (messageIndex === -1) {
//       console.error('Message not found:', messageId);
//       return false;
//     }
    
//     // Mark as deleted instead of removing
//     messages[messageIndex] = {
//       ...messages[messageIndex],
//       isDeleted: true,
//       deletedAt: Date.now(),
//       text: '', // Clear text
//       attachments: [] // Clear attachments
//     };
    
//     saveChatToLocal(userId1, userId2, messages);
    
//     // Optionally sync with backend
//     try {
//       await api.post('/api/chat/message/delete', {
//         messageId,
//         userId1,
//         userId2
//       });
//     } catch (err) {
//       console.error('Failed to sync deletion with backend:', err);
//     }
    
//     return true;
//   } catch (error) {
//     console.error('Error soft deleting message:', error);
//     return false;
//   }
// };

// // ===== FETCH CHAT HISTORY =====
// export const fetchChatHistory = async (userId1, userId2) => {
//   try {
//     // First check localStorage
//     const localMessages = getChatFromLocal(userId1, userId2);
    
//     // Check if chat was deleted
//     const sortedIds = [userId1, userId2].sort();
//     const deletedKey = `deleted_chat_${sortedIds[0]}_${sortedIds[1]}`;
//     if (localStorage.getItem(deletedKey)) {
//       return [];
//     }
    
//     if (localMessages.length > 0) {
//       return localMessages;
//     }
    
//     // Fallback to API
//     try {
//       const response = await api.get('/api/chat/history', {
//         params: { userId, otherUserId }
//       });
      
//       if (response.data?.success && Array.isArray(response.data.messages)) {
//         const messages = response.data.messages;
//         saveChatToLocal(userId1, userId2, messages);
//         return messages;
//       }
//     } catch (apiError) {
//       console.error('API fetch failed, using local only:', apiError);
//     }
    
//     return localMessages;
//   } catch (error) {
//     console.error('Error fetching chat history:', error);
//     return [];
//   }
// };

// // ===== DELETE CHAT HISTORY =====
// export const deleteChatHistory = async (userId1, userId2) => {
//   try {
//     const sortedIds = [userId1, userId2].sort();
//     const chatKey = getChatKey(userId1, userId2);
//     const lastMsgKey = `last_msg_${chatKey}`;
//     const deletedKey = `deleted_chat_${sortedIds[0]}_${sortedIds[1]}`;
    
//     // Mark as deleted
//     localStorage.setItem(deletedKey, '1');
    
//     // Clear chat data
//     localStorage.removeItem(chatKey);
//     localStorage.removeItem(lastMsgKey);
    
//     // Optionally sync with backend
//     try {
//       await api.post('/api/chat/delete', { userId1, userId2 });
//     } catch (err) {
//       console.error('Failed to sync deletion with backend:', err);
//     }
    
//     return true;
//   } catch (error) {
//     console.error('Error deleting chat history:', error);
//     return false;
//   }
// };

// // ===== USER STATUS =====
// export const fetchUserStatus = async (userId) => {
//   try {
//     const response = await api.get(`/api/chat/user/status/${userId}`);
//     if (response.data?.success) {
//       return {
//         userId,
//         isOnline: response.data.status === 'online',
//         lastSeen: response.data.lastSeen,
//         isTyping: false
//       };
//     }
//     return { userId, isOnline: false, lastSeen: null, isTyping: false };
//   } catch (error) {
//     console.error('Error fetching user status:', error);
//     return { userId, isOnline: false, lastSeen: null, isTyping: false };
//   }
// };

// export const updateUserStatus = async ({ userId, status }) => {
//   try {
//     const response = await api.post('/api/chat/user/status', { userId, status });
//     return response.data;
//   } catch (error) {
//     console.error('Error updating user status:', error);
//     return null;
//   }
// };


import api from './api';

// ===== CHAT KEY UTILITY =====
export const getChatKey = (userId1, userId2) => {
  const sortedIds = [userId1, userId2].sort();
  return `chat_${sortedIds[0]}_${sortedIds[1]}`;
};

// ===== LOCAL STORAGE OPERATIONS =====
export const saveChatToLocal = (userId1, userId2, messages) => {
  try {
    const chatKey = getChatKey(userId1, userId2);
    
    // Sort messages by timestamp before saving
    const sortedMessages = [...messages].sort((a, b) => 
      (a.timestamp || 0) - (b.timestamp || 0)
    );
    
    localStorage.setItem(chatKey, JSON.stringify(sortedMessages));
    
    // Always update last message cache - get the MOST RECENT (last in sorted array)
    if (sortedMessages.length > 0) {
      const lastMessage = sortedMessages[sortedMessages.length - 1];
      const lastMsgKey = `last_msg_${chatKey}`;
      localStorage.setItem(lastMsgKey, JSON.stringify({
        text: lastMessage.text || '',
        timestamp: lastMessage.timestamp,
        from: lastMessage.from,
        to: lastMessage.to,
        isDeleted: lastMessage.isDeleted || false,
        attachments: lastMessage.attachments || []
      }));
    }
    
    return true;
  } catch (error) {
    console.error('Error saving chat to localStorage:', error);
    return false;
  }
};

export const getChatFromLocal = (userId1, userId2) => {
  try {
    const chatKey = getChatKey(userId1, userId2);
    
    // Check if chat was deleted
    const sortedIds = [userId1, userId2].sort();
    const deletedKey = `deleted_chat_${sortedIds[0]}_${sortedIds[1]}`;
    if (localStorage.getItem(deletedKey)) {
      return [];
    }
    
    const data = localStorage.getItem(chatKey);
    
    if (!data) {
      return [];
    }
    
    const parsed = JSON.parse(data);
    
    // Ensure it's an array
    if (!Array.isArray(parsed)) {
      return [];
    }
    
    // Filter out invalid messages
    return parsed.filter(msg => 
      msg && 
      msg.id && 
      msg.from && 
      msg.to && 
      msg.timestamp
    );
  } catch (error) {
    console.error('Error getting chat from localStorage:', error);
    return [];
  }
};

export const getLastMessage = (userId1, userId2) => {
  try {
    const chatKey = getChatKey(userId1, userId2);
    
    // First check if chat was deleted
    const sortedIds = [userId1, userId2].sort();
    const deletedKey = `deleted_chat_${sortedIds[0]}_${sortedIds[1]}`;
    if (localStorage.getItem(deletedKey)) {
      return null;
    }
    
    // Get full chat history
    const messages = getChatFromLocal(userId1, userId2);
    
    // Only return last message if there are actual messages
    if (!messages || messages.length === 0) {
      return null;
    }
    
    // Sort by timestamp and get the most recent
    const sortedMessages = [...messages].sort((a, b) => 
      (b.timestamp || 0) - (a.timestamp || 0)
    );
    
    const lastMsg = sortedMessages[0];
    
    // Verify the message has required fields
    if (!lastMsg || (!lastMsg.text && (!lastMsg.attachments || lastMsg.attachments.length === 0))) {
      return null;
    }
    
    return {
      text: lastMsg.text || '',
      timestamp: lastMsg.timestamp,
      from: lastMsg.from,
      to: lastMsg.to,
      isDeleted: lastMsg.isDeleted || false,
      attachments: lastMsg.attachments || []
    };
  } catch (error) {
    console.error('Error getting last message:', error);
    return null;
  }
};

// ===== UNREAD MESSAGE COUNT =====
export const getUnreadCount = (currentUserId, otherUserId) => {
  try {
    const messages = getChatFromLocal(currentUserId, otherUserId);
    return messages.filter(msg => 
      msg.from === otherUserId && 
      msg.to === currentUserId && 
      msg.status !== 'read'
    ).length;
  } catch (error) {
    console.error('Error calculating unread count:', error);
    return 0;
  }
};

export const markMessagesAsRead = async (currentUserId, otherUserId) => {
  try {
    const messages = getChatFromLocal(currentUserId, otherUserId);
    const updatedMessages = messages.map(msg => {
      if (msg.from === otherUserId && msg.to === currentUserId && msg.status !== 'read') {
        return { ...msg, status: 'read' };
      }
      return msg;
    });
    
    saveChatToLocal(currentUserId, otherUserId, updatedMessages);
    return updatedMessages;
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return [];
  }
};

// ===== MESSAGE OPERATIONS =====
export const updateMessageInHistory = async (userId1, userId2, message) => {
  try {
    const messages = getChatFromLocal(userId1, userId2);
    const existingIndex = messages.findIndex(m => m.id === message.id);
    
    if (existingIndex !== -1) {
      // Update existing message
      messages[existingIndex] = { ...messages[existingIndex], ...message };
    } else {
      // Add new message
      messages.push(message);
    }
    
    // Sort by timestamp
    messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    saveChatToLocal(userId1, userId2, messages);
    return message;
  } catch (error) {
    console.error('Error updating message in history:', error);
    return null;
  }
};

// ===== SOFT DELETE MESSAGE (WhatsApp style) =====
export const softDeleteMessage = async (userId1, userId2, messageId) => {
  try {
    const messages = getChatFromLocal(userId1, userId2);
    const messageIndex = messages.findIndex(m => m.id === messageId);
    
    if (messageIndex === -1) {
      console.error('Message not found:', messageId);
      return false;
    }
    
    // Mark as deleted instead of removing
    messages[messageIndex] = {
      ...messages[messageIndex],
      isDeleted: true,
      deletedAt: Date.now(),
      text: '', // Clear text
      attachments: [] // Clear attachments
    };
    
    saveChatToLocal(userId1, userId2, messages);
    
    // Optionally sync with backend
    try {
      await api.post('/api/chat/message/delete', {
        messageId,
        userId1,
        userId2
      });
    } catch (err) {
      console.error('Failed to sync deletion with backend:', err);
    }
    
    return true;
  } catch (error) {
    console.error('Error soft deleting message:', error);
    return false;
  }
};

// ===== FETCH CHAT HISTORY =====
export const fetchChatHistory = async (userId1, userId2) => {
  try {
    // First check localStorage
    const localMessages = getChatFromLocal(userId1, userId2);
    
    // Check if chat was deleted
    const sortedIds = [userId1, userId2].sort();
    const deletedKey = `deleted_chat_${sortedIds[0]}_${sortedIds[1]}`;
    if (localStorage.getItem(deletedKey)) {
      return [];
    }
    
    if (localMessages.length > 0) {
      return localMessages;
    }
    
    // Fallback to API
    try {
      const response = await api.get('/api/chat/history', {
        params: { userId, otherUserId:userId2 }
      });
      
      if (response.data?.success && Array.isArray(response.data.messages)) {
        const messages = response.data.messages;
        saveChatToLocal(userId1, userId2, messages);
        return messages;
      }
    } catch (apiError) {
      console.error('API fetch failed, using local only:', apiError);
    }
    
    return localMessages;
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return [];
  }
};

// ===== DELETE CHAT HISTORY =====
export const deleteChatHistory = async (userId1, userId2) => {
  try {
    const sortedIds = [userId1, userId2].sort();
    const chatKey = getChatKey(userId1, userId2);
    const lastMsgKey = `last_msg_${chatKey}`;
    const deletedKey = `deleted_chat_${sortedIds[0]}_${sortedIds[1]}`;
    
    // Mark as deleted
    localStorage.setItem(deletedKey, '1');
    
    // Clear chat data
    localStorage.removeItem(chatKey);
    localStorage.removeItem(lastMsgKey);
    
    // Optionally sync with backend
    try {
      await api.post('/api/chat/delete', { userId1, userId2 });
    } catch (err) {
      console.error('Failed to sync deletion with backend:', err);
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting chat history:', error);
    return false;
  }
};

// ===== USER STATUS =====
export const fetchUserStatus = async (userId) => {
  try {
    const response = await api.get(`/api/chat/user/status/${userId}`);
    if (response.data?.success) {
      return {
        userId,
        isOnline: response.data.status === 'online',
        lastSeen: response.data.lastSeen,
        isTyping: false
      };
    }
    return { userId, isOnline: false, lastSeen: null, isTyping: false };
  } catch (error) {
    console.error('Error fetching user status:', error);
    return { userId, isOnline: false, lastSeen: null, isTyping: false };
  }
};

export const updateUserStatus = async ({ userId, status }) => {
  try {
    const response = await api.post('/api/chat/user/status', { userId, status });
    return response.data;
  } catch (error) {
    console.error('Error updating user status:', error);
    return null;
  }
};