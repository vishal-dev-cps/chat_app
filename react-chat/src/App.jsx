import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useState, useEffect, useMemo } from 'react';
import UserList from './components/UserList';
import GroupList from './components/GroupList';
import { fetchGroups } from './services/groupService';
import SidebarHeader from './components/SidebarHeader';
import { loadUsers } from './services/userService';
import api from './services/api';
import { fetchUserStatus, updateUserStatus } from './services/chatService';
import { fetchChatHistory, saveChatToLocal, updateMessageInHistory } from './services/chatService';
import { requestNotificationPermission, showChatNotification } from './services/notificationService';
import { socket, connectSocket, disconnectSocket } from './services/socket';
import ChatWindow from './components/ChatWindow';
import GroupChatWindow from './components/GroupChatWindow';
import MessageInput from './components/MessageInput';
import LoginModal from './components/LoginModal';
import './App.css';

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramId = urlParams.get('securityId') || urlParams.get('user');
  const [currentUserId, setCurrentUserId] = useState(paramId || null);
  const showLogin = !currentUserId;

  // Primary state hooks (declared early to avoid TDZ issues)
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMessages, setGroupMessages] = useState([]);
  const [userStatuses, setUserStatuses] = useState({});
  const [search, setSearch] = useState('');
  const [groups, setGroups] = useState([]);
  const [sidebarTab, setSidebarTab] = useState('chats'); // 'chats' | 'groups'
  const [readStatus, setReadStatus] = useState({});
  const [showMobileChat, setShowMobileChat] = useState(false); // Mobile navigation state
  // Register for notifications and handle window focus/blur events
  useEffect(() => {
    // Request notification permission
    requestNotificationPermission();

    // Track unread count
    let unreadCount = 0;
    const originalTitle = document.title;

    // Update tab title with unread count
    const updateTabTitle = () => {
      if (unreadCount > 0) {
        document.title = `(${unreadCount}) ${originalTitle.replace(/^\(\d+\)\s*/, '')}`;
      } else {
        document.title = originalTitle.replace(/^\(\d+\)\s*/, '');
      }
    };

    // Handle window focus
    const handleFocus = () => {
      unreadCount = 0;
      updateTabTitle();
    };

    // Handle window blur (optional: could be used for presence updates)
    const handleBlur = () => {
      // Could be used to update user status to 'away' in the future
    };

    // Listen for new message notifications
    const handleNotification = (message) => {
      // Only count messages not from the currently selected user
      if (selectedUser?.id !== message.from) {
        unreadCount++;
        updateTabTitle();
      }
    };

    // Add event listeners
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Listen for custom notification events if needed
    const notificationHandler = (e) => {
      if (e.detail && e.detail.type === 'new_message') {
        handleNotification(e.detail.message);
      }
    };
    window.addEventListener('custom-notification', notificationHandler);

    // Cleanup
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('custom-notification', notificationHandler);
      document.title = originalTitle; // Restore original title
    };
  }, [selectedUser]);

  // Connect socket when currentUserId becomes available
  // Load groups initially and whenever a group is created
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

  // Fetch groups when user switches to Groups tab
  useEffect(() => {
    if (sidebarTab === 'groups') {
      refreshGroups();
    }
  }, [sidebarTab]);

  useEffect(() => {
    const loadGroupMessages = async () => {
      if (!selectedGroup) return;

      // Check localStorage first
      const cacheKey = `group_chat_${String(selectedGroup.id)}`;
      const raw = localStorage.getItem(cacheKey);
      // If any cached value exists and is not an empty array string, trust it and skip fetch
      if (raw && raw !== '[]') {
        try {
          const cached = JSON.parse(raw);
          setGroupMessages(Array.isArray(cached) ? cached : []);
        } catch {
          // If parsing fails just use empty and fall through to API
          setGroupMessages([]);
        }
        return;
      }

      // Fallback to API fetch
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

  useEffect(() => {
    if (currentUserId) {
      connectSocket(currentUserId);

      // ===== Socket listeners =====
      // Incoming chat message
      const onChatMessage = async (msg) => {
        // Only process if recipient is this user
        if (msg.to !== currentUserId) return;

        const newMsg = {
          ...msg,
          status: 'delivered',
          // Ensure timestamp is a number
          timestamp: msg.timestamp || Date.now()
        };

        // Save to chat history first
        await updateMessageInHistory(currentUserId, msg.from, newMsg);

        // Add to messages state
        setMessages(prev => {
          // Check if message already exists (prevents duplicates)
          if (prev.some(m => m.id === newMsg.id)) {
            return prev;
          }
          return [...prev, newMsg];
        });

        // Update read status if this is from the currently selected user
        if (selectedUser?.id === msg.from) {
          newMsg.status = 'read';
          setReadStatus(prev => ({ ...prev, [msg.from]: Date.now() }));
          // Update in history as read
          await updateMessageInHistory(currentUserId, msg.from, { ...newMsg, status: 'read' });
        } else {
          // Only show notification if not from the currently selected user
          showChatNotification(newMsg, users);
        }
      };

      socket.on('chat_message', onChatMessage);

      return () => {
        socket.off('chat_message', onChatMessage);
        disconnectSocket();
      };
    }
  }, [currentUserId, selectedUser, users]);




  // load users on mount
  useEffect(() => {
    (async () => {
      if (!currentUserId) return;

      try {
        // Fetch current user details from API
        const response = await api.get(`/api/chat/user/${currentUserId}`);
        if (response.data?.success) {
          const currentUser = response.data.user;
          console.log('[App] Current user:', currentUser);
          const fetched = await loadUsers(currentUser);
          setUsers(fetched);
          // Removed automatic selection of first user

          // update my status to online
          updateUserStatus({ userId: currentUserId, status: 'online' }).catch(console.error);
        } else {
          console.error('Failed to fetch user details:', response.data);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    })();
  }, [currentUserId]);



  // Load chat history when a user is selected
  useEffect(() => {
    const loadChat = async () => {
      if (selectedUser && currentUserId) {
        try {
          const chatHistory = await fetchChatHistory(currentUserId, selectedUser.id);

          // Mark messages as read and update state
          const updatedMessages = chatHistory.map(msg => ({
            ...msg,
            status: msg.from === selectedUser.id && msg.to === currentUserId ? 'read' : msg.status
          }));

          // Sort messages by timestamp
          updatedMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

          // Update messages state
          setMessages(updatedMessages);

          // Update read status for the current chat
          if (selectedUser) {
            setReadStatus(prev => ({
              ...prev,
              [selectedUser.id]: Date.now()
            }));

            // Mark messages as read in history
            const unreadMessages = updatedMessages.filter(
              msg => msg.from === selectedUser.id &&
                msg.to === currentUserId &&
                msg.status !== 'read'
            );

            if (unreadMessages.length > 0) {
              const readUpdates = unreadMessages.map(msg => ({
                ...msg,
                status: 'read'
              }));

              // Update all unread messages as read in history
              await Promise.all(
                readUpdates.map(msg =>
                  updateMessageInHistory(currentUserId, selectedUser.id, msg)
                )
              );

              // Update local state
              setMessages(prev =>
                prev.map(msg =>
                  msg.from === selectedUser.id && msg.to === currentUserId && msg.status !== 'read'
                    ? { ...msg, status: 'read' }
                    : msg
                )
              );
            }
          }

        } catch (error) {
          console.error('Error loading chat history:', error);
        }
      }
    };

    loadChat();
  }, [selectedUser, currentUserId]);

  // Fetch status for all users after list loads
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

  // Inactivity timer – 5 min sets offline
  useEffect(() => {
    if (!currentUserId) return;
    let inactivityTimer;
    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        updateUserStatus({ userId: currentUserId, status: 'offline' }).catch(console.error);
      }, 1 * 60 * 1000);
    };
    // list of events indicating activity
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(ev => window.addEventListener(ev, resetTimer));
    resetTimer(); // start timer
    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(ev => window.removeEventListener(ev, resetTimer));
    };
  }, [currentUserId]);

  // Handle beforeunload -> set offline
  useEffect(() => {
    if (!currentUserId) return;
    const handler = () => {
      navigator.sendBeacon && navigator.sendBeacon(
        //`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/chat/user/status`,
        `${import.meta.env.VITE_API_URL || 'https://us-central1-securityerp.cloudfunctions.net'}/api/chat/user/status`,
        JSON.stringify({ userId: currentUserId, status: 'offline' })
      );
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [currentUserId]);

  // Listen for messages via localStorage events (cross-tab sync)
  useEffect(() => {
    function handleStorage(e) {
      if (e.key === 'chat_message' && e.newValue) {
        const msg = JSON.parse(e.newValue);
        // Only process if message is for current user
        if (msg.id && msg.to === currentUserId && msg.from !== currentUserId) {
          // Set initial status as 'delivered' for received messages
          const newMsg = { ...msg, status: 'delivered' };

          // If this chat is active, mark as read immediately
          if (selectedUser?.id === msg.from) {
            newMsg.status = 'read';
            setReadStatus(prev => ({
              ...prev,
              [msg.from]: Date.now()
            }));
          }

          setMessages(prev => [...prev, newMsg]);

          // If chat is not active, show notification
          if (selectedUser?.id !== msg.from) {
            showChatNotification({ ...msg, from: msg.from, text: msg.text, id: msg.id }, users);
          }
        }
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [currentUserId, selectedUser]);

  // Calculate unread counts for each user
  const unreadCounts = useMemo(() => {
    const counts = {};
    messages.forEach(msg => {
      if (msg.to === currentUserId && msg.status !== 'read') {
        counts[msg.from] = (counts[msg.from] || 0) + 1;
      }
    });
    return counts;
  }, [messages, currentUserId]);

  const updateMessageStatus = (messageId, status) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? { ...msg, status } : msg
      )
    );
  };

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
      status: 'sending' // initial status
    };

    // Save to local history immediately
    updateMessageInHistory(currentUserId, selectedUser.id, newMsg);

    // Update local state
    setMessages(prev => [...prev, newMsg]);

    // Simulate message delivery
    setTimeout(async () => {
      const deliveredMsg = { ...newMsg, status: 'delivered' };
      updateMessageStatus(messageId, 'delivered');
      await updateMessageInHistory(currentUserId, selectedUser.id, deliveredMsg);

      // In a real app, this would be triggered by the recipient's client
      if (selectedUser) {
        setTimeout(async () => {
          if (selectedUser) {
            const readMsg = { ...deliveredMsg, status: 'read' };
            updateMessageStatus(messageId, 'read');
            await updateMessageInHistory(currentUserId, selectedUser.id, readMsg);
          }
        }, 1000);
      }
    }, 500);

    // Emit over socket to backend so other browsers/clients can receive
    socket.emit('chat_message', newMsg);

    // Handle incoming group_message
    const onGroupMessage = (msg) => {
      if (msg.groupId !== selectedGroup?.id) return;
      setGroupMessages((prev) => [...prev, msg]);
    };
    socket.on('group_message', onGroupMessage);

  };

  // ===== Group Chat Send =====
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
    // Optimistic update
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
            <button className={`flex-fill btn btn-sm ${sidebarTab === 'chats' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setSidebarTab('chats')}>Chats</button>
            <button className={`flex-fill btn btn-sm ${sidebarTab === 'groups' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setSidebarTab('groups')}>Groups</button>
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
              users={users
                .filter(u =>
                  u.displayName.toLowerCase().includes(search.toLowerCase())
                )
                .map(u => {
                  const uid = u.userId || u.id;

                  // ✅ CALCULATE UNREAD COUNT FROM MESSAGES (SOURCE OF TRUTH)
                  const unreadCount = messages.reduce((count, m) => {
                    if (
                      m.from === uid &&
                      m.to === currentUserId &&
                      m.status !== 'read'
                    ) {
                      return count + 1;
                    }
                    return count;
                  }, 0);

                  return {
                    ...u,
                    unreadCount,
                  };
                })
                .sort((a, b) => {
                  // 1️⃣ Unread chats first
                  if (b.unreadCount !== a.unreadCount) {
                    return b.unreadCount - a.unreadCount;
                  }

                  // 2️⃣ Online users
                  if (a.status === 'online' && b.status !== 'online') return -1;
                  if (a.status !== 'online' && b.status === 'online') return 1;

                  // 3️⃣ Name fallback
                  return a.displayName.localeCompare(b.displayName);
                })}
              selected={selectedUser}
              onSelect={(user) => {
                const uid = user.userId || user.id;

                setSelectedUser(user);
                setSelectedGroup(null);
                setShowMobileChat(true);

                // ✅ Mark messages as read (this will auto-drop chat down)
                setMessages(prev =>
                  prev.map(m =>
                    m.from === uid && m.to === currentUserId
                      ? { ...m, status: 'read' }
                      : m
                  )
                );
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
                setShowMobileChat(true); // Show chat on mobile
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
            />
          )}
        </div>
      </div>
    </>
  );
}