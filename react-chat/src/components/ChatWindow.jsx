import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { fetchUserStatus } from '../services/chatService';
import './ChatWindow.css';
import MessageStatus from './MessageStatus';
import MessageInput from './MessageInput';
import { getChatFromLocal, deleteChatHistory, saveChatToLocal, fetchChatHistory, updateMessageInHistory, softDeleteMessage } from '../services/chatService';
import { backupMessages } from '../services/backupService';
import { format } from 'date-fns';
import { socket, connectSocket } from '../services/socket';

export default function ChatWindow({ messages, selectedUser, currentUserId, onSend, onBack }) {
  const [hoveredMessage, setHoveredMessage] = useState(null);
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

  const handleDeleteChat = async () => {
    if (!selectedUser) return;
    const sortedIds = [currentUserId, selectedUser.id].sort();
    const chatKey = `chat_${sortedIds[0]}_${sortedIds[1]}`;
    if (window.confirm('Delete this chat history? This action cannot be undone.')) {
      localStorage.removeItem(chatKey);
      localStorage.setItem(`deleted_chat_${sortedIds[0]}_${sortedIds[1]}`, '1');
      await deleteChatHistory(currentUserId, selectedUser.id);
      alert('Chat deleted');
      window.location.reload();
    }
  };

  const messagesContainerRef = useRef(null);
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    if (selectedUser) {
      scrollToBottom('auto');
    }
  }, [messages, scrollToBottom, selectedUser]);

  const [usercurrentstatus, setUsercurrentstatus] = useState({ isOnline: false, isTyping: false, lastSeen: null });

  useEffect(() => {
    let ignore = false;
    if (selectedUser?.id) {
      fetchUserStatus(selectedUser.id)
        .then((data) => {
          if (!ignore) {
            setUsercurrentstatus({ isOnline: data.isOnline, lastSeen: data.lastSeen, isTyping: false });
          }
        })
        .catch(console.error);
    }
    return () => { ignore = true; };
  }, [selectedUser]);

  useEffect(() => {
    const activeSocket = socket;
    if (!activeSocket || !selectedUser?.id || !currentUserId) return;
    let typingTimeout;

    if (!activeSocket.connected || activeSocket.auth?.userId !== currentUserId) {
      connectSocket(currentUserId);
    }

    activeSocket.offAny();
    activeSocket.onAny((evt, ...payload) => {
      console.log('[SOCKET RX]', evt, ...payload);
    });

    const addListeners = () => {
      activeSocket.off('user-status-update', handleStatusUpdate);
      activeSocket.off('typing-private', handleTypingPrivate);
      activeSocket.on('user-status-update', handleStatusUpdate);
      activeSocket.on('typing-private', handleTypingPrivate);
      activeSocket.on('user-typing', handleTypingPrivate);
    };

    addListeners();

    function handleStatusUpdate(data) {
      if (data.userId === selectedUser.id) {
        setUsercurrentstatus(prev => ({
          ...prev,
          isOnline: data.status === 'online',
          lastSeen: data.lastSeen || prev.lastSeen
        }));
      }
    }

    function handleTypingPrivate(data) {
      if (data.from === selectedUser.id) {
        setUsercurrentstatus(prev => ({ ...prev, isTyping: true }));
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
          setUsercurrentstatus(prev => ({ ...prev, isTyping: false }));
        }, 2000);
      }
    }

    return () => {
      activeSocket.off('user-status-update', handleStatusUpdate);
      activeSocket.off('typing-private', handleTypingPrivate);
      activeSocket.offAny?.();
      clearTimeout(typingTimeout);
    };
  }, [selectedUser?.id, currentUserId]);

  const isTyping = usercurrentstatus.isTyping;
  const isOnline = usercurrentstatus.isOnline;
  const statusText = isTyping
    ? 'Typing...'
    : isOnline
      ? 'Online'
      : usercurrentstatus.lastSeen
        ? `Last seen: ${new Date(usercurrentstatus.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Offline';
  const statusClass = isTyping ? 'typing' : isOnline ? 'online' : 'offline';

  const filteredMessages = useMemo(() => {
    if (!selectedUser || !Array.isArray(messages)) return [];
    return messages
      .filter(msg =>
        (msg.from === selectedUser?.id && msg.to === currentUserId) ||
        (msg.to === selectedUser?.id && msg.from === currentUserId)
      )
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [messages, selectedUser, currentUserId]);

  const handleDeleteMessage = async (message) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        const success = await softDeleteMessage(currentUserId, selectedUser.id, message.id);
        if (success) {
          const updatedMessages = await fetchChatHistory(currentUserId, selectedUser.id);
          setMessages(updatedMessages);
        }
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    }
  };

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

  // ✅ BLOCK CHAT IF SUPERADMIN
  const isSuperAdmin = selectedUser?.role?.toLowerCase() === "superadmin";

  return (
    <div className="chat-window">
      <div className="chat-header">
        {onBack && (
          <button className="back-button" onClick={onBack}>
            <i className="fas fa-arrow-left"></i>
          </button>
        )}
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
        <button className="btn-delete" onClick={handleDeleteChat}><i className="fas fa-trash"></i></button>
      </div>

      {isSuperAdmin ? (
        <div className="super-block-wrapper">

          <div className="super-block-card">
            <div className="super-icon-circle">
              <i className="fas fa-shield-alt"></i>
            </div>

            <h4 className="super-title">{selectedUser.displayName}</h4>
            <p className="super-subtext">Super Admin Account</p>

            <div className="super-info-box">
              <p><strong>Email:</strong> {selectedUser.email}</p>
            </div>

            <button
              className="super-email-btn"
              onClick={() => window.location.href = `mailto:${selectedUser.email}`}
            >
              <i className="fas fa-envelope"></i>&nbsp; Contact via Email
            </button>

            <p className="super-note">
              Chat disabled — please reach out via email.
            </p>
          </div>

        </div>
      ) : (
        <>
          {/* ✅ NORMAL CHAT UI */}
          <div className="chat-messages-container" ref={messagesContainerRef}>
            <div className="chat-messages">
              {filteredMessages.length === 0 ? (
                <div className="empty-chat-state">
                  <div className="empty-chat-content">
                    <h5>No messages yet</h5>
                    <p className="empty-chat-message">Send a message to start the conversation</p>
                  </div>
                </div>
              ) : (
                filteredMessages.map((m, i) => {
                  const isSent = m.from === currentUserId;
                  return (
                    <div
                      key={i}
                      className={`message-wrapper ${isSent ? 'sent' : 'received'}`}
                      onMouseEnter={() => setHoveredMessage(m.id)}
                      onMouseLeave={() => setHoveredMessage(null)}
                    >
                      <div className={`message-content ${isSent ? 'sent' : 'received'}`}>
                        <div className="message-actions">
                          {isSent && hoveredMessage === m.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMessage(m);
                              }}
                              className="message-action-btn"
                              title="Delete message"
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          )}
                        </div>
                        <div className={`msg-bubble ${isSent ? 'sent' : 'received'}`}>
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
                          {m.text && (
                            <span className="msg-text">{m.text}</span>
                          )}
                          <span className="message-time">
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {isSent && (
                              <span className="message-status">
                                {m.status === 'read' ? (
                                  <i className="fas fa-check-double text-primary"></i>
                                ) : m.status === 'delivered' ? (
                                  <i className="fas fa-check-double"></i>
                                ) : (
                                  <i className="fas fa-check"></i>
                                )}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {isTyping && (
                <div className="typing-indicator">
                  <span className="typing-dot">•</span>
                  <span className="typing-dot">•</span>
                  <span className="typing-dot">•</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {onSend && (
            <div className="chat-input-container">
              <MessageInput
                onSend={onSend}
                disabled={!selectedUser}
                currentUserId={currentUserId}
                selectedUserId={selectedUser?.id}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
