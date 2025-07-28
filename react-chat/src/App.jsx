import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useState, useEffect } from 'react';
import UserList from './components/UserList';
import SidebarHeader from './components/SidebarHeader';
import { loadUsers } from './services/userService';
import ChatWindow from './components/ChatWindow';
import MessageInput from './components/MessageInput';
import LoginModal from './components/LoginModal';
import './App.css';

export default function App() {
    const urlParams = new URLSearchParams(window.location.search);
  const paramId = urlParams.get('securityId') || urlParams.get('user');
  const [currentUserId, setCurrentUserId] = useState(paramId || null);
  const showLogin = !currentUserId;
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);

  // load users on mount
  useEffect(() => {
    (async () => {
      if (!currentUserId) return;
      const currentUser = { id: currentUserId, role: 'admin' }; // TODO: real role
      const fetched = await loadUsers(currentUser);
      setUsers(fetched);
      if (fetched.length > 0) setSelectedUser(fetched[0]);
    })();
  }, [currentUserId]);

  // Listen for messages via localStorage events (cross-tab demo)
  useEffect(() => {
    function handleStorage(e) {
      if (e.key === 'chat_message' && e.newValue) {
        const msg = JSON.parse(e.newValue);
        // Accept message if I am sender or receiver, but avoid duplicate sender push
        if (msg.id && msg.to && msg.from !== undefined) {
          if (msg.to === currentUserId && msg.from !== currentUserId) {
            setMessages((prev) => [...prev, msg]);
          }
        }
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [currentUserId]);

  const sendMessage = (text) => {
    if (!text || !selectedUser) return;
    const newMsg = { id: Date.now(), from: currentUserId, to: selectedUser.id, text };
    setMessages((prev) => [...prev, newMsg]);
    // broadcast to other tabs
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
          <UserList users={users.filter(u=>u.displayName.toLowerCase().includes(search.toLowerCase()))} selected={selectedUser} onSelect={setSelectedUser} />
        </div>
        <div className="chat-area d-flex flex-column">
          <ChatWindow messages={messages} selectedUser={selectedUser} currentUserId={currentUserId} />
          <MessageInput disabled={!selectedUser} onSend={sendMessage} />
        </div>
      </div>
    </>
  );
}