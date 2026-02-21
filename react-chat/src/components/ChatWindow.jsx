import { useEffect, useRef, useCallback, useState } from 'react';
import { fetchUserStatus, markMessagesAsRead } from '../services/chatService';
import './ChatWindow.css';
import MessageInput from './MessageInput';
import { getChatFromLocal, deleteChatHistory, saveChatToLocal, fetchChatHistory, softDeleteMessage } from '../services/chatService';
import { ImageZoom } from './ImageZoom';
import 'react-medium-image-zoom/dist/styles.css';

import { socket, connectSocket } from '../services/socket';

export default function ChatWindow({ messages, selectedUser, currentUserId, onSend, onBack, setMessages }) {
  const [hoveredMessage, setHoveredMessage] = useState(null);
  const [localMessages, setLocalMessages] = useState([]);

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

  // Load messages when user is selected
  useEffect(() => {
    if (selectedUser && currentUserId) {
      const loadMessages = async () => {
        const history = await fetchChatHistory(currentUserId, selectedUser.id);
        setLocalMessages(history);

        // Mark messages as read
        await markMessagesAsRead(currentUserId, selectedUser.id);
      };
      loadMessages();
    }
  }, [selectedUser, currentUserId]);

  // Sync with parent messages prop
  useEffect(() => {
    if (selectedUser && messages) {
      const filtered = messages.filter(m =>
        (m.from === selectedUser.id && m.to === currentUserId) ||
        (m.to === selectedUser.id && m.from === currentUserId)
      );

      // Merge with local messages (avoid duplicates)
      const merged = [...localMessages];
      filtered.forEach(msg => {
        if (!merged.find(m => m.id === msg.id)) {
          merged.push(msg);
        }
      });

      merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setLocalMessages(merged);

      // Save to localStorage
      saveChatToLocal(currentUserId, selectedUser.id, merged);
    }
  }, [messages, selectedUser]);

  useEffect(() => {
    if (selectedUser) {
      scrollToBottom('auto');
    }
  }, [localMessages, scrollToBottom, selectedUser]);

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
      activeSocket.off('message-deleted', handleMessageDeleted);
      activeSocket.on('user-status-update', handleStatusUpdate);
      activeSocket.on('typing-private', handleTypingPrivate);
      activeSocket.on('user-typing', handleTypingPrivate);
      activeSocket.on('message-deleted', handleMessageDeleted);
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
        }, 3000);
      }
    }

    function handleMessageDeleted(data) {
      console.log('[ChatWindow] Received message-deleted event:', data);
      console.log('[ChatWindow] Current user:', currentUserId);
      console.log('[ChatWindow] Selected user:', selectedUser?.id);

      // Check if this message deletion affects the current conversation
      const isRelevant =
        (data.userId1 === currentUserId || data.userId2 === currentUserId) &&
        (data.userId1 === selectedUser?.id || data.userId2 === selectedUser?.id);

      console.log('[ChatWindow] Is relevant:', isRelevant);

      if (isRelevant) {
        console.log('[ChatWindow] Updating message as deleted:', data.messageId);

        // Update local messages state
        setLocalMessages(prev => {
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
          console.log('[ChatWindow] Local messages updated:', updated);
          return updated;
        });

        // Also update parent messages state if available
        if (setMessages) {
          setMessages(prev => prev.map(msg =>
            msg.id === data.messageId
              ? {
                ...msg,
                isDeleted: true,
                text: '',
                attachments: [],
                deletedAt: Date.now()
              }
              : msg
          ));
        }

        // Update localStorage
        const currentMessages = getChatFromLocal(currentUserId, selectedUser.id);
        const updatedMessages = currentMessages.map(msg =>
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
        saveChatToLocal(currentUserId, selectedUser.id, updatedMessages);
        console.log('[ChatWindow] localStorage updated');
      }
    }

    return () => {
      activeSocket.off('user-status-update', handleStatusUpdate);
      activeSocket.off('typing-private', handleTypingPrivate);
      activeSocket.off('message-deleted', handleMessageDeleted);
      activeSocket.offAny?.();
      clearTimeout(typingTimeout);
    };
  }, [selectedUser?.id, currentUserId]);

  const isTyping = usercurrentstatus.isTyping;
  const isOnline = usercurrentstatus.isOnline;
  const statusText = isTyping
    ? 'typing...'
    : isOnline
      ? 'Online'
      : usercurrentstatus.lastSeen
        ? `Last seen: ${new Date(usercurrentstatus.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Offline';
  const statusClass = isTyping ? 'typing' : isOnline ? 'online' : 'offline';

  const handleDeleteMessage = async (message) => {
    if (window.confirm('Delete this message for everyone?')) {
      try {
        const deletedMsg = {
          ...message,
          isDeleted: true,
          text: '',
          attachments: [],
          deletedAt: Date.now()
        };

        // Update local state immediately for instant feedback
        setLocalMessages(prev => prev.map(msg =>
          msg.id === message.id ? deletedMsg : msg
        ));

        // Update parent messages state
        if (setMessages) {
          setMessages(prev => prev.map(msg =>
            msg.id === message.id ? deletedMsg : msg
          ));
        }

        // Update localStorage immediately
        const updatedMessages = getChatFromLocal(currentUserId, selectedUser.id).map(msg =>
          msg.id === message.id ? deletedMsg : msg
        );
        saveChatToLocal(currentUserId, selectedUser.id, updatedMessages);

        // Perform soft delete in service
        const success = await softDeleteMessage(currentUserId, selectedUser.id, message.id);

        if (success) {
          // Emit socket event for real-time update to other user
          const deleteEvent = {
            messageId: message.id,
            userId1: currentUserId,
            userId2: selectedUser.id
          };

          console.log('[DELETE] Emitting delete-message event:', deleteEvent);
          console.log('[DELETE] Socket connected:', socket.connected);
          console.log('[DELETE] Socket ID:', socket.id);

          socket.emit('delete-message', deleteEvent);

          console.log('[DELETE] Message deleted successfully:', message.id);
        } else {
          console.error('[DELETE] Soft delete failed, but UI already updated');
        }
      } catch (error) {
        console.error('Error deleting message:', error);
        // Revert the UI change on error
        const revertedMessages = getChatFromLocal(currentUserId, selectedUser.id);
        setLocalMessages(revertedMessages);
        alert('Failed to delete message');
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
        <ImageZoom>
          <img
            src={selectedUser.photoURL}
            alt={selectedUser.displayName}
            className="header-avatar"
            onError={(e) => {
              const initials = (selectedUser.displayName || 'U').split(' ').slice(0, 2).map(s => s[0].toUpperCase()).join('');
              e.target.onerror = null;
              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random`;
            }}
          />
        </ImageZoom>
        <div className="header-info">
          <span className="name">{selectedUser.displayName}</span>
          <span className={`status ${statusClass}`}>
            {isTyping && <span className="typing-dots">
              <span>.</span><span>.</span><span>.</span>
            </span>}
            {statusText}
          </span>
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
              {localMessages.length === 0 ? (
                <div className="empty-chat-state">
                  <div className="empty-chat-content">
                    <h5>No messages yet</h5>
                    <p className="empty-chat-message">Send a message to start the conversation</p>
                  </div>
                </div>
              ) : (
                localMessages.map((m, i) => {
                  const isSent = m.from === currentUserId;
                  const isDeleted = m.isDeleted;

                  return (
                    <div
                      key={m.id || i}
                      className={`message-wrapper ${isSent ? 'sent' : 'received'}`}
                      onMouseEnter={() => !isDeleted && setHoveredMessage(m.id)}
                      onMouseLeave={() => setHoveredMessage(null)}
                    >
                      <div className={`message-content ${isSent ? 'sent' : 'received'}`}>
                        {!isDeleted && (
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
                        )}

                        <div className={`msg-bubble ${isSent ? 'sent' : 'received'} ${isDeleted ? 'deleted' : ''}`}>
                          {isDeleted ? (
                            <div className="deleted-message">
                              <i className="fas fa-ban"></i>
                              <span className="deleted-text">This message was deleted</span>
                            </div>
                          ) : (
                            <>
                              {m.attachments && m.attachments.length > 0 && (
                                <div className="msg-attachments">
                                  {m.attachments.map((att, idx) => (
                                    att.type?.startsWith('image/') ? (
                                      <ImageZoom key={idx}>
                                        <img src={att.url} alt={att.name} className="chat-img" />
                                      </ImageZoom>
                                    ) : (
                                      <a key={idx} href={att.url} target="_blank" rel="noreferrer" className="file-link">
                                        <i className="fas fa-file"></i> {att.name}
                                      </a>
                                    )
                                  ))}
                                </div>
                              )}
                              {m.text && (
                                <span className="msg-text">{m.text}</span>
                              )}
                            </>
                          )}

                          <span className="message-time">
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {isSent && !isDeleted && (
                              <span className="message-status-inline">
                                {m.status === 'read' ? (
                                  <i className="fas fa-check-double read-check"></i>
                                ) : m.status === 'delivered' ? (
                                  <i className="fas fa-check-double delivered-check"></i>
                                ) : (
                                  <i className="fas fa-check sent-check"></i>
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
                  <div className="typing-bubble">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
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