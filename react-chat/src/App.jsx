import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useState, useEffect } from 'react';
import UserList from './components/UserList';
import ChatWindow from './components/ChatWindow';
import MessageInput from './components/MessageInput';
import './App.css';

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const currentUserParam = urlParams.get('user');
  const currentUserId = currentUserParam ? Number(currentUserParam) : 1; // default user id 1
  const [users] = useState([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);

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
    <div className="container-fluid py-3">
      <div className="row">
        <div className="col-4">
          <UserList users={users} selected={selectedUser} onSelect={setSelectedUser} />
        </div>
        <div className="col-8 d-flex flex-column" style={{ height: '80vh' }}>
          <ChatWindow messages={messages} selectedUser={selectedUser} currentUserId={currentUserId} />
          <MessageInput disabled={!selectedUser} onSend={sendMessage} />
        </div>
      </div>
    </div>
  );
}