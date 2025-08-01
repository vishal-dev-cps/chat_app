import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { fetchUserStatus } from '../services/chatService';
import './ChatWindow.css';
import MessageStatus from './MessageStatus';
import MessageInput from './MessageInput';
import { getChatFromLocal, deleteChatHistory } from '../services/chatService';
import { backupMessages } from '../services/backupService';

export default function ChatWindow({ messages, selectedUser, currentUserId, onSend }) {
  const handleBackup = async () => {
    try {
      const msgs = getChatFromLocal(currentUserId, selectedUser.id) || [];
      const apiMsgs = msgs.map(m => ({
        senderId: m.from,
        recipientId: m.to,
        message: m.text,
        tempId: m.id,
        ...(m.attachments && { attachments: m.attachments })
      }));
      if (apiMsgs.length === 0) {
        alert('No messages to backup');
        return;
      }
      await backupMessages(apiMsgs);
      alert('Backup successful');
    } catch (e) {
      console.error(e);
      alert('Backup failed');
    }
  };
  const messagesEndRef = useRef(null);

  // Delete chat history for the current conversation
  const handleDeleteChat = async () => {
    if (!selectedUser) return;
    const sortedIds = [currentUserId, selectedUser.id].sort();
    const chatKey = `chat_${sortedIds[0]}_${sortedIds[1]}`;
    if (window.confirm('Delete this chat history? This action cannot be undone.')) {
      // 1. Remove local copy
      localStorage.removeItem(chatKey);
      // Mark as deleted to prevent refetch
      localStorage.setItem(`deleted_chat_${sortedIds[0]}_${sortedIds[1]}`, '1');
      // 2. Delete from server
      await deleteChatHistory(currentUserId, selectedUser.id);
      alert('Chat deleted');
      // Reload to reflect changes quickly; in a larger app you'd refresh state via parent callback
      window.location.reload();
    }
  };
  const messagesContainerRef = useRef(null);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (selectedUser) {
      scrollToBottom('auto');
    }
  }, [messages, scrollToBottom, selectedUser]);

  // Local state for dynamic status
  const [userStatus, setUserStatus] = useState({ isOnline: false, isTyping: false, lastSeen: null });

  // Fetch status when selected user changes
  useEffect(() => {
    let ignore = false;
    if (selectedUser?.id) {
      fetchUserStatus(selectedUser.id)
        .then((data) => {
          if (!ignore) {
            setUserStatus({ isOnline: data.isOnline, lastSeen: data.lastSeen, isTyping: false });
          }
        })
        .catch(console.error);
    }
    return () => { ignore = true; };
  }, [selectedUser]);

  // Listen for real-time status updates via Socket.IO if available globally
  useEffect(() => {
    const socket = window?.socket;
    if (!socket || !selectedUser?.id) return;

    const handler = (data) => {
      if (data.userId === selectedUser.id) {
        setUserStatus((prev) => ({ ...prev, isOnline: data.status === 'online', lastSeen: data.lastSeen }));
      }
    };
    socket.on?.('user-status-update', handler);
    return () => socket.off?.('user-status-update', handler);
  }, [selectedUser]);

  const isTyping = userStatus.isTyping || selectedUser?.isTyping;
  const isOnline = userStatus.isOnline;
  const statusText = isTyping ? 'typing…' : isOnline ? 'online' : 'offline';
  const statusClass = isTyping ? 'typing' : isOnline ? 'online' : 'offline';

  // Filter and sort messages for the selected user
  const filteredMessages = useMemo(() => {
    if (!selectedUser || !Array.isArray(messages)) return [];

    return messages
      .filter(msg =>
        (msg.from === selectedUser?.id && msg.to === currentUserId) ||
        (msg.to === selectedUser?.id && msg.from === currentUserId)
      )
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [messages, selectedUser, currentUserId]);

  if (!selectedUser) return (
    <div className="chat-empty-state">
      <div className="empty-state-content">
        <div className="empty-state-icon">
          <svg viewBox="0 0 24 24" width="200" height="200">
            <path fill="#54656F" d="M19.25 3.018H4.75A2.753 2.753 0 0 0 2 5.77v12.495a2.754 2.754 0 0 0 2.75 2.753h14.5A2.754 2.754 0 0 0 22 18.265V5.766A2.753 2.753 0 0 0 19.25 3.018zm-14.5 1.5h14.5c.69 0 1.25.56 1.25 1.25v.714l-8.05 5.367a.81.81 0 0 1-.9-.002L3.5 6.482v-.714c0-.69.56-1.25 1.25-1.25zM20.5 18.265c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25V8.24l7.24 4.83a2.265 2.265 0 0 0 2.52.004l7.24-4.83v10.02z"></path>
          </svg>
        </div>
        <h4>Security Chat</h4>
        <p className="subtitle">
          Welcome to Security Chat, a safe space to connect with your peers and mentors.
          <br />
          Select a user to start chatting.
        </p>
      </div>
    </div>
  );
  return (
    <div className="chat-window">
      <div className="chat-header">
        <img
          src={selectedUser.photoURL}
          alt={selectedUser.displayName}
          onError={(e) => {
            const initials = (selectedUser.displayName || 'U').split(' ').slice(0, 2).map(s => s[0].toUpperCase()).join('');
            e.target.onerror = null;
            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random`;
          }}
        />
        <div className="header-info">
          <span className="name">{selectedUser.displayName}</span>
          <span className={`status ${statusClass}`}>{statusText}</span>
        </div>

        {/* Backup current chat */}
        <button className="btn-backup" onClick={async () => {
          try {
            const msgs = getChatFromLocal(currentUserId, selectedUser.id) || [];
            const apiMsgs = msgs.map(m => ({
              senderId: m.from,
              recipientId: m.to,
              message: m.text,
              tempId: m.id,
              ...(m.attachments && { attachments: m.attachments })
            }));
            if (apiMsgs.length === 0) { alert('No messages to backup'); return; }
            await backupMessages(apiMsgs);
            alert('Backup successful');
          } catch (e) { console.error(e); alert('Backup failed'); }
        }}><i className="fas fa-cloud-upload-alt"></i></button>

        {/* Delete current chat */}
        <button className="btn-delete" onClick={handleDeleteChat}><i className="fas fa-trash"></i></button>
      </div>
      <div className="chat-messages-container" ref={messagesContainerRef}>
        <div className="chat-messages">
          {filteredMessages.length === 0 ? (
            <div className="empty-chat-state">
              <div className="empty-chat-content">
                <div className="empty-chat-icon">
                  <svg viewBox="0 0 24 24" width="120" height="120">
                    <path fill="#54656F" d="M19.25 3.018H4.75A2.753 2.753 0 0 0 2 5.77v12.495a2.754 2.754 0 0 0 2.75 2.753h14.5A2.754 2.754 0 0 0 22 18.265V5.766A2.753 2.753 0 0 0 19.25 3.018zm-14.5 1.5h14.5c.69 0 1.25.56 1.25 1.25v.714l-8.05 5.367a.81.81 0 0 1-.9-.002L3.5 6.482v-.714c0-.69.56-1.25 1.25-1.25zM20.5 18.265c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25V8.24l7.24 4.83a2.265 2.265 0 0 0 2.52.004l7.24-4.83v10.02z"></path>
                  </svg>
                </div>
                <h5>No messages yet</h5>
                <p className="empty-chat-message">Send a message to start the conversation</p>
              </div>
            </div>
          ) : (
            filteredMessages.map((m, i) => {
              const isSent = m.from === currentUserId;
              return (
                <div key={i} className={`mb-2 ${isSent ? 'text-end' : 'text-start'}`}>
                  <div className={`msg-bubble-container ${isSent ? 'sent' : 'received'}`}>
                    <span className="msg-bubble">
                      {/* Attachments */}
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="msg-attachments">
                          {m.attachments.map(att => (
                            att.type?.startsWith('image/') ? (
                              <img key={att.url} src={att.url} alt={att.name} className="chat-img" />
                            ) : (
                              <a key={att.url} href={att.url} target="_blank" rel="noreferrer" className="file-link">
                                {att.name}
                              </a>
                            )
                          ))}
                        </div>
                      )}
                      {/* Message text */}
                      {m.text && (
                        <span className="msg-text">{m.text}</span>
                      )}
                      {/* Timestamp */}
                      <span className="message-time">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      {onSend && (
        <div className="chat-input-container">
          <MessageInput onSend={onSend} disabled={!selectedUser} />
        </div>
      )}
    </div>
  );
}