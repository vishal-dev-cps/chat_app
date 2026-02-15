import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useState, useEffect, useMemo } from 'react';
import UserList from './components/UserList';
import GroupList from './components/GroupList';
import { fetchGroups } from './services/groupService';
import SidebarHeader from './components/SidebarHeader';
import { loadUsers } from './services/userService';
import api from './services/api';
import { 
  fetchUserStatus, 
  updateUserStatus, 
  saveChatToLocal, 
  updateMessageInHistory,
  markMessagesAsRead 
} from './services/chatService';
import { requestNotificationPermission, showChatNotification } from './services/notificationService';
import { socket, connectSocket, disconnectSocket } from './services/socket';
import ChatWindow from './components/ChatWindow';
import GroupChatWindow from './components/GroupChatWindow';
import LoginModal from './components/LoginModal';
import './App.css';

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramId = urlParams.get('securityId') || urlParams.get('user');
  const [currentUserId, setCurrentUserId] = useState(paramId || null);
  const showLogin = !currentUserId;

  // Store currentUserId in localStorage for other components
  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem('current_user_id', currentUserId);
    }
  }, [currentUserId]);

  // Primary state hooks
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMessages, setGroupMessages] = useState([]);
  const [userStatuses, setUserStatuses] = useState({});
  const [search, setSearch] = useState('');
  const [groups, setGroups] = useState([]);
  const [sidebarTab, setSidebarTab] = useState('chats');
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Register for notifications
  useEffect(() => {
    requestNotificationPermission();

    let unreadCount = 0;
    const originalTitle = document.title;

    const updateTabTitle = () => {
      if (unreadCount > 0) {
        document.title = `(${unreadCount}) ${originalTitle.replace(/^\(\d+\)\s*/, '')}`;
      } else {
        document.title = originalTitle.replace(/^\(\d+\)\s*/, '');
      }
    };

    const handleFocus = () => {
      unreadCount = 0;
      updateTabTitle();
    };

    const handleNotification = (message) => {
      if (selectedUser?.id !== message.from) {
        unreadCount++;
        updateTabTitle();
      }
    };

    window.addEventListener('focus', handleFocus);

    const notificationHandler = (e) => {
      if (e.detail && e.detail.type === 'new_message') {
        handleNotification(e.detail.message);
      }
    };
    window.addEventListener('custom-notification', notificationHandler);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('custom-notification', notificationHandler);
      document.title = originalTitle;
    };
  }, [selectedUser]);

  // Load groups
  const refreshGroups = async () => {
    try {
      const g = await fetchGroups(currentUserId);
      setGroups(g);
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  };

  useEffect(() => {
    refreshGroups();
  }, []);

  useEffect(() => {
    if (sidebarTab === 'groups') {
      refreshGroups();
    }
  }, [sidebarTab]);

  // Load group messages
  useEffect(() => {
    const loadGroupMessages = async () => {
      if (!selectedGroup) return;

      const cacheKey = `group_chat_${String(selectedGroup.id)}`;
      const raw = localStorage.getItem(cacheKey);
      
      if (raw && raw !== '[]') {
        try {
          const cached = JSON.parse(raw);
          setGroupMessages(Array.isArray(cached) ? cached : []);
        } catch {
          setGroupMessages([]);
        }
        return;
      }

      try {
        const { fetchGroupMessages } = await import('./services/groupMessageService');
        const msgs = await fetchGroupMessages(selectedGroup.id);
        setGroupMessages(msgs);
        localStorage.setItem(cacheKey, JSON.stringify(msgs));
      } catch (err) {
        console.error('Failed to fetch group messages:', err);
      }
    };
    loadGroupMessages();
  }, [selectedGroup]);

  // Connect socket
  useEffect(() => {
    if (currentUserId) {
      connectSocket(currentUserId);

      const onChatMessage = async (msg) => {
        if (msg.to !== currentUserId) return;

        const newMsg = {
          ...msg,
          status: 'delivered',
          timestamp: msg.timestamp || Date.now()
        };

        // Save to localStorage immediately
        await updateMessageInHistory(currentUserId, msg.from, newMsg);

        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) {
            return prev;
          }
          const updated = [...prev, newMsg];
          
          // Update localStorage with full conversation
          saveChatToLocal(currentUserId, msg.from, updated.filter(m => 
            (m.from === msg.from && m.to === currentUserId) ||
            (m.from === currentUserId && m.to === msg.from)
          ));
          
          return updated;
        });

        // Mark as read if chat is active
        if (selectedUser?.id === msg.from) {
          const readMsg = { ...newMsg, status: 'read' };
          await updateMessageInHistory(currentUserId, msg.from, readMsg);
          await markMessagesAsRead(currentUserId, msg.from);
          
          setMessages(prev => {
            const updated = prev.map(m => (m.id === readMsg.id ? readMsg : m));
            
            // Update localStorage
            saveChatToLocal(currentUserId, msg.from, updated.filter(m => 
              (m.from === msg.from && m.to === currentUserId) ||
              (m.from === currentUserId && m.to === msg.from)
            ));
            
            return updated;
          });
        } else {
          showChatNotification(newMsg, users);
        }
      };

      // Listen for message deletions
      const onMessageDeleted = async (data) => {
        console.log('[APP] Message deletion received:', data);
        
        if (data.userId1 === currentUserId || data.userId2 === currentUserId) {
          setMessages(prev => {
            const updated = prev.map(msg =>
              msg.id === data.messageId
                ? { 
                    ...msg, 
                    isDeleted: true, 
                    text: '', 
                    attachments: [],
                    deletedAt: Date.now()
                  }
                : msg
            );
            
            // Update localStorage
            const otherUserId = data.userId1 === currentUserId ? data.userId2 : data.userId1;
            const conversationMessages = updated.filter(m => 
              (m.from === otherUserId && m.to === currentUserId) ||
              (m.from === currentUserId && m.to === otherUserId)
            );
            
            saveChatToLocal(currentUserId, otherUserId, conversationMessages);
            
            return updated;
          });
        }
      };

      socket.on('chat_message', onChatMessage);
      socket.on('message-deleted', onMessageDeleted);

      return () => {
        socket.off('chat_message', onChatMessage);
        socket.off('message-deleted', onMessageDeleted);
        disconnectSocket();
      };
    }
  }, [currentUserId, selectedUser, users]);

  // Load users
  useEffect(() => {
    (async () => {
      if (!currentUserId) return;

      try {
        const response = await api.get(`/api/chat/user/${currentUserId}`);
        if (response.data?.success) {
          const currentUser = response.data.user;
          const fetched = await loadUsers(currentUser);
          setUsers(fetched);

          updateUserStatus({ userId: currentUserId, status: 'online' }).catch(console.error);
        } else {
          console.error('Failed to fetch user details:', response.data);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    })();
  }, [currentUserId]);

  // Mark messages as read when user is selected
  useEffect(() => {
    if (selectedUser && currentUserId) {
      markMessagesAsRead(currentUserId, selectedUser.id).then(updatedMessages => {
        setMessages(prev =>
          prev.map(msg => {
            const updated = updatedMessages.find(m => m.id === msg.id);
            return updated || msg;
          })
        );
      });
    }
  }, [selectedUser, currentUserId]);

  // Fetch user statuses
  useEffect(() => {
    if (!users.length) return;
    (async () => {
      const promises = users.map(u => fetchUserStatus(u.id).catch(() => null));
      const results = await Promise.all(promises);
      const statusMap = {};
      results.forEach(r => {
        if (r?.userId) statusMap[r.userId] = { isOnline: r.isOnline, lastSeen: r.lastSeen };
      });
      setUserStatuses(statusMap);
    })();
  }, [users]);

  // Inactivity timer
  useEffect(() => {
    if (!currentUserId) return;
    let inactivityTimer;
    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        updateUserStatus({ userId: currentUserId, status: 'offline' }).catch(console.error);
      }, 5 * 60 * 1000);
    };
    
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(ev => window.addEventListener(ev, resetTimer));
    resetTimer();
    
    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(ev => window.removeEventListener(ev, resetTimer));
    };
  }, [currentUserId]);

  // Handle beforeunload
  useEffect(() => {
    if (!currentUserId) return;
    const handler = () => {
      navigator.sendBeacon && navigator.sendBeacon(
        `${import.meta.env.VITE_API_URL || 'https://us-central1-securityerp.cloudfunctions.net'}/api/chat/user/status`,
        JSON.stringify({ userId: currentUserId, status: 'offline' })
      );
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [currentUserId]);

  // Listen for cross-tab messages
  useEffect(() => {
    function handleStorage(e) {
      if (e.key === 'chat_message' && e.newValue) {
        const msg = JSON.parse(e.newValue);
        if (msg.id && msg.to === currentUserId && msg.from !== currentUserId) {
          const newMsg = { ...msg, status: 'delivered' };

          if (selectedUser?.id === msg.from) {
            newMsg.status = 'read';
          }

          setMessages(prev => [...prev, newMsg]);

          if (selectedUser?.id !== msg.from) {
            showChatNotification({ ...msg, from: msg.from, text: msg.text, id: msg.id }, users);
          }
        }
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [currentUserId, selectedUser]);

  // Send message
  const sendMessage = async (payload) => {
    const text = (typeof payload === 'string')
      ? payload
      : (typeof payload?.text === 'string' ? payload.text : '');
    const attachments = (typeof payload === 'object' && Array.isArray(payload?.attachments)) ? payload.attachments : [];

    if ((!text || text.trim() === '') && attachments.length === 0) return;
    if (!selectedUser || !currentUserId) return;

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    const newMsg = {
      id: messageId,
      from: currentUserId,
      to: selectedUser.id,
      text,
      attachments,
      timestamp,
      status: 'sending'
    };

    // Save to localStorage immediately
    await updateMessageInHistory(currentUserId, selectedUser.id, newMsg);

    setMessages(prev => {
      const updated = [...prev, newMsg];
      
      // Update localStorage with full conversation
      saveChatToLocal(currentUserId, selectedUser.id, updated.filter(m => 
        (m.from === selectedUser.id && m.to === currentUserId) ||
        (m.from === currentUserId && m.to === selectedUser.id)
      ));
      
      return updated;
    });

    // Update status to delivered
    setTimeout(async () => {
      const deliveredMsg = { ...newMsg, status: 'delivered' };
      setMessages(prev => {
        const updated = prev.map(m => (m.id === messageId ? deliveredMsg : m));
        
        // Update localStorage
        saveChatToLocal(currentUserId, selectedUser.id, updated.filter(m => 
          (m.from === selectedUser.id && m.to === currentUserId) ||
          (m.from === currentUserId && m.to === selectedUser.id)
        ));
        
        return updated;
      });
      await updateMessageInHistory(currentUserId, selectedUser.id, deliveredMsg);

      // Simulate read status
      if (selectedUser) {
        setTimeout(async () => {
          if (selectedUser) {
            const readMsg = { ...deliveredMsg, status: 'read' };
            setMessages(prev => {
              const updated = prev.map(m => (m.id === messageId ? readMsg : m));
              
              // Update localStorage
              saveChatToLocal(currentUserId, selectedUser.id, updated.filter(m => 
                (m.from === selectedUser.id && m.to === currentUserId) ||
                (m.from === currentUserId && m.to === selectedUser.id)
              ));
              
              return updated;
            });
            await updateMessageInHistory(currentUserId, selectedUser.id, readMsg);
          }
        }, 1000);
      }
    }, 500);

    socket.emit('chat_message', newMsg);

    // Handle group messages
    const onGroupMessage = (msg) => {
      if (msg.groupId !== selectedGroup?.id) return;
      setGroupMessages((prev) => [...prev, msg]);
    };
    socket.on('group_message', onGroupMessage);
  };

  // Send group message
  const sendGroupMessage = async (text, attachments = []) => {
    text = typeof text === 'string' ? text : '';
    if (!selectedGroup) return;
    if (text.trim() === '' && attachments.length === 0) return;
    
    const { sendGroupMessage: sendGroupMsgApi } = await import('./services/groupMessageService');
    const payload = {
      senderId: currentUserId,
      content: text.trim() || (attachments.length > 0 ? ' ' : ''),
      attachments,
      timestamp: new Date().toISOString(),
    };
    
    const msg = await sendGroupMsgApi(selectedGroup.id, payload);
    setGroupMessages((prev) => [...prev, msg]);
    socket.emit('group_message', { groupId: selectedGroup.id, ...msg });
  };

  return (
    <>
      <LoginModal show={showLogin} onSubmit={(id) => {
        setCurrentUserId(id);
        window.history.replaceState({}, '', `?securityId=${id}`);
      }} />
      <div className="app-wrapper">
        <div className={`sidebar ${showMobileChat ? 'mobile-hidden' : ''}`}>
          <div className="sidebar-tabs d-flex">
            <button 
              className={`flex-fill btn btn-sm ${sidebarTab === 'chats' ? 'btn-primary' : 'btn-outline-secondary'}`} 
              onClick={() => setSidebarTab('chats')}
            >
              Chats
            </button>
            <button 
              className={`flex-fill btn btn-sm ${sidebarTab === 'groups' ? 'btn-primary' : 'btn-outline-secondary'}`} 
              onClick={() => setSidebarTab('groups')}
            >
              Groups
            </button>
          </div>
          <SidebarHeader
            users={users}
            onSearch={setSearch}
            currentUser={users.find(u => u.id === currentUserId)}
            currentUserId={currentUserId}
            onGroupCreated={refreshGroups}
          />
          {sidebarTab === 'chats' ? (
            <UserList
              users={users.filter(u =>
                u.displayName.toLowerCase().includes(search.toLowerCase())
              )}
              selected={selectedUser}
              onSelect={(user) => {
                setSelectedUser(user);
                setSelectedGroup(null);
                setShowMobileChat(true);
              }}
              messages={messages}
            />
          ) : (
            <GroupList
              groups={groups}
              selected={selectedGroup}
              users={users}
              currentUserId={currentUserId}
              onSelect={(g) => {
                setSelectedGroup(g);
                setSelectedUser(null);
                setShowMobileChat(true);
              }}
              onUpdated={refreshGroups}
            />
          )}
        </div>
        <div className={`chat-area d-flex flex-column ${showMobileChat ? 'mobile-visible' : ''}`}>
          {selectedGroup ? (
            <GroupChatWindow
              currentUserId={currentUserId}
              group={selectedGroup}
              messages={groupMessages}
              onSend={sendGroupMessage}
              onBack={() => setShowMobileChat(false)}
            />
          ) : (
            <ChatWindow
              messages={messages}
              selectedUser={selectedUser}
              currentUserId={currentUserId}
              onSend={sendMessage}
              onBack={() => setShowMobileChat(false)}
              setMessages={setMessages}
            />
          )}
        </div>
      </div>
    </>
  );
}