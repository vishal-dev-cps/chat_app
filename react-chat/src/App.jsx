import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useState, useEffect, useMemo } from 'react';
import UserList from './components/UserList';
import SidebarHeader from './components/SidebarHeader';
import { loadUsers } from './services/userService';
import { fetchUserStatus, updateUserStatus } from './services/chatService';
import { fetchChatHistory, saveChatToLocal, updateMessageInHistory } from './services/chatService';
import { requestNotificationPermission, showChatNotification } from './services/notificationService';
import { socket, connectSocket, disconnectSocket } from './services/socket';
import ChatWindow from './components/ChatWindow';
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
  const [userStatuses, setUserStatuses] = useState({});
  const [search, setSearch] = useState('');
  const [readStatus, setReadStatus] = useState({});
  // Register for notifications once
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Connect socket when currentUserId becomes available
  useEffect(() => {
    if (currentUserId) {
      connectSocket(currentUserId);

      // Incoming chat message
      const onChatMessage = (msg) => {
        // Only process if recipient is this user
        if (msg.to !== currentUserId) return;

        const newMsg = { ...msg, status: 'delivered' };

        if (selectedUser?.id === msg.from) {
          newMsg.status = 'read';
          setReadStatus(prev => ({ ...prev, [msg.from]: Date.now() }));
        }
        setMessages(prev => [...prev, newMsg]);

        if (selectedUser?.id !== msg.from) {
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
      const currentUser = { id: currentUserId, role: 'admin' }; // TODO: real role
      const fetched = await loadUsers(currentUser);
      setUsers(fetched);
      // Removed automatic selection of first user
    })();
    // update my status to online
    if (currentUserId) {
      updateUserStatus({ userId: currentUserId, status: 'online' }).catch(console.error);
    }
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
          
          setMessages(updatedMessages);
          
          // Update read status
          setReadStatus(prev => ({
            ...prev,
            [selectedUser.id]: Date.now()
          }));
          
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
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/chat/user/status`,
        JSON.stringify({ userId: currentUserId, status: 'offline' })
      );
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [currentUserId]);

  // Listen for messages via localStorage events (cross-tab demo)
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

  const sendMessage = async (text) => {
    if (!text || !selectedUser || !currentUserId) return;
    
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    
    const newMsg = { 
      id: messageId,
      from: currentUserId, 
      to: selectedUser.id, 
      text, 
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

    // Legacy broadcast for same-browser tabs
    localStorage.setItem('chat_message', JSON.stringify(newMsg));
  };

  return (
    <>
      <LoginModal show={showLogin} onSubmit={(id)=>{
        setCurrentUserId(id);
        window.history.replaceState({}, '', `?securityId=${id}`);
      }}/>
      <div className="app-wrapper">
        <div className="sidebar">
          <SidebarHeader onSearch={setSearch} currentUser={users.find(u=>u.id===currentUserId)} />
          <UserList 
            users={users
              .filter(u => u.displayName.toLowerCase().includes(search.toLowerCase()))
              .map(user => ({
                ...user,
                unreadCount: unreadCounts[user.id] || 0
              }))}
            selected={selectedUser} 
            onSelect={setSelectedUser} 
            messages={messages}
          />
        </div>
        <div className="chat-area d-flex flex-column">
          <ChatWindow 
            messages={messages} 
            selectedUser={selectedUser} 
            currentUserId={currentUserId} 
            onSend={sendMessage}
          />
        </div>
      </div>
    </>
  );
}