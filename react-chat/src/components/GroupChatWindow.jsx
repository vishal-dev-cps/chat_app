import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import MessageInput from './MessageInput';
import './ChatWindow.css';
import { socket, connectSocket } from '../services/socket';
import MemberListModal from './MemberListModal'; 

//const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_BASE = import.meta.env.VITE_API_URL || 'https://us-central1-securityerp.cloudfunctions.net';

const USER_CACHE_KEY = 'chat_user_cache';

// Function to get user from cache or fetch if not exists
const getUserDetails = async (userId, currentUserId) => {
  if (!userId) return null;

  // Check if user is the current user
  if (userId === currentUserId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (currentUser.id) return { ...currentUser, name: 'You' };
  }

  // Check cache
  const cache = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || '{}');
  if (cache[userId]) {
    return cache[userId];
  }

  // If not in cache, fetch from API
  try {
    const response = await fetch(`${API_BASE}/api/chat/user/${userId}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // First check if the response is OK
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Then check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Response is not JSON:', await response.text());
      return { id: userId, name: 'Someone' };
    }

    const data = await response.json();

    // Check if the response has the expected structure
    if (data?.success && data.user) {
      // Update cache
      const updatedCache = { ...cache, [userId]: data.user };
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(updatedCache));
      return data.user;
    } else if (data?.user) {
      // Handle case where success flag might be missing but user data exists
      const updatedCache = { ...cache, [userId]: data.user };
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(updatedCache));
      return data.user;
    }

    console.error('Unexpected API response:', data);
    return { id: userId, name: 'Someone' };

  } catch (error) {
    console.error('Error fetching user details:', error);
    return { id: userId, name: 'Someone' };
  }
};

export default function GroupChatWindow({ currentUserId, group, messages = [], onSend, onBack }) {
  const [groupMessages, setGroupMessages] = useState(messages);
  const [showMembersModal, setShowMembersModal] = useState(false);

  // ---------- LocalStorage helpers ----------
  const getStorageKey = (gid) => `group_chat_${String(gid)}`;

  const loadFromLocal = (gid) => {
    try {
      const raw = localStorage.getItem(getStorageKey(gid));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveToLocal = (gid, msgs) => {
    try {
      localStorage.setItem(getStorageKey(gid), JSON.stringify(msgs));
    } catch {/* ignore quota errors */ }
  };

  const [typingUserId, setTypingUserId] = useState(null);
  const [userCache, setUserCache] = useState({});
  const endRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupMessages]);

  // Ensure socket is connected with the current userId (singleton)
  useEffect(() => {
    if (currentUserId) {
      connectSocket(currentUserId);
    }
  }, [currentUserId]);

  // Join the active group room whenever it changes
  useEffect(() => {
    if (group?.id && currentUserId) {
      socket.emit('join-group', { groupId: group.id, userId: currentUserId });
    }
  }, [group?.id, currentUserId]);

  // Load cached messages & fetch latest from API when group changes
  useEffect(() => {
    async function loadHistory() {
      if (!group?.id) return;
      // 1. load from localStorage immediately for fast UI
      const cached = loadFromLocal(group.id);
      if (cached?.length) setGroupMessages(cached);

      // Skipping API fetch – rely solely on localStorage cache
      // If you need server sync in the future, re-enable the block below.
      /*
      if (!cached.length) {
        try {
          const history = await fetchGroupMessages(group.id);
          if (Array.isArray(history)) {
            const merged = [...cached];
            history.forEach((srv) => {
              if (!merged.some((m) => (m.id && m.id === srv.id) || m.timestamp === srv.timestamp)) {
                merged.push(srv);
              }
            });
            setGroupMessages(merged);
            saveToLocal(group.id, merged);
          }
        } catch (err) {
          console.error('Failed to load group history', err);
        }
      }
      */
    }
    loadHistory();
  }, [group?.id]);

  // Listen for new messages and typing events
  useEffect(() => {
    const handleNewMessage = (msg) => {
      if (msg.groupId !== group?.id) return;
      // Ignore echo of our own optimistically-added message
      if (msg.senderId === currentUserId) return;

      // If server didn't include senderName, enrich from our local member list
      if (!msg.senderName && Array.isArray(group?.members)) {
        const s = group.members.find(m => (m._id ?? m.id) === msg.senderId);
        if (s?.name) msg.senderName = s.name;
      }

      setGroupMessages((prev) => {
        // avoid duplicates by id or timestamp
        if (prev.some((m) => (m.id && m.id === msg.id) || m.timestamp === msg.timestamp)) {
          return prev;
        }
        const updated = [...prev, msg];
        saveToLocal(group.id, updated);
        return updated;
      });
    };

    const handleTyping = ({ userId }) => {
      if (userId !== currentUserId) {
        setTypingUserId(userId);
        setTimeout(() => setTypingUserId(null), 2000);
      }
    };

    const handleSeenUpdate = ({ groupId, messageId, userId }) => {
      if (groupId !== group?.id) return;
      setGroupMessages((prev) => prev.map((m) => {
        const mid = m.id ?? m.timestamp;
        if (mid === messageId) {
          const seenSet = new Set(m.seenBy || []);
          seenSet.add(userId);
          return { ...m, seenBy: Array.from(seenSet) };
        }
        return m;
      }));
    };

    socket.on('new-group-message', handleNewMessage);
    socket.on('message-seen', handleSeenUpdate);
    socket.on('user-typing', handleTyping);
    return () => {
      socket.off('new-group-message', handleNewMessage);
      socket.off('message-seen', handleSeenUpdate);
      socket.off('user-typing', handleTyping);
    };
  }, [group?.id, currentUserId]);

  // Observer for read receipts (seen)
  useEffect(() => {
    if (!endRef.current || !group?.id) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const lastMsg = groupMessages[groupMessages.length - 1];
        if (lastMsg) {
          socket.emit('seen', {
            groupId: group.id,
            userId: currentUserId,
            messageId: lastMsg.id,
          });
        }
      }
    });
    observer.observe(endRef.current);
    return () => observer.disconnect();
  }, [groupMessages, group?.id, currentUserId]);

  // Persist whenever messages change for the current group
  useEffect(() => {
    if (group?.id) {
      saveToLocal(group.id, groupMessages);
    }
  }, [groupMessages, group?.id]);

  // Local helper to send message via socket
  const handleSendMessage = ({ text, attachments }) => {
    // derive senderName from group members or fallback to 'You'
    const senderObj = group?.members?.find(m => (m._id ?? m.id) === currentUserId);
    const lsName = typeof localStorage !== 'undefined' ? localStorage.getItem('current_user_name') : null;
    const senderName = senderObj?.name || lsName || 'You';

    const msg = {
      groupId: group.id,
      senderId: currentUserId,
      senderName, // include for easier display on other clients
      content: text,
      attachments,
      timestamp: new Date().toISOString(),
      seenBy: [],
    };
    socket.emit('group-message', msg);
    setGroupMessages((prev) => {
      const updated = [...prev, msg];
      saveToLocal(group.id, updated);
      return updated;
    });
    // Call optional callback so parent can persist to DB if needed
    onSend?.(msg);
  };

  // Load user details when typingUserId changes
  useEffect(() => {
    if (!typingUserId) return;

    const loadUser = async () => {
      const user = await getUserDetails(typingUserId, currentUserId);
      setUserCache(prev => ({
        ...prev,
        [typingUserId]: user
      }));
    };

    loadUser();
  }, [typingUserId, currentUserId]);

  // Clean up typing indicator after delay
  useEffect(() => {
    if (!typingUserId) return;

    const timer = setTimeout(() => {
      setTypingUserId(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [typingUserId]);

  // Listen for typing events
  useEffect(() => {
    if (!group?.id) return;

    const handleTyping = (data) => {
      if (data.groupId === group.id && data.userId !== currentUserId) {
        setTypingUserId(data.userId);
      }
    };

    window.socket?.on('user-typing', handleTyping);
    return () => window.socket?.off('user-typing', handleTyping);
  }, [group?.id, currentUserId]);

  if (!group) {
    return null;
  }

  return (
    <div className="chat-window">
      <div className="chat-header" onClick={() => setShowMembersModal(true)} style={{ cursor: 'pointer' }}>
        {onBack && (
          <button className="back-button" onClick={onBack}>
            <i className="fas fa-arrow-left"></i>
          </button>
        )}
        <div className="header-info">
          <span className="name">{group.name}</span>
          <span className="members-preview">{Array.isArray(group.members) ? group.members.length : 0} members</span>
        </div>
      </div>
      
      <MemberListModal
        show={showMembersModal}
        onHide={() => setShowMembersModal(false)}
        members={group?.members || []}
      />

      <div className="chat-messages-container">
        <div className="chat-messages">
          {groupMessages.length === 0 ? (
            <div className="empty-chat-state">
              <div className="empty-chat-content">
                <h5>No messages yet</h5>
              </div>
            </div>
          ) : (
            [...(groupMessages || [])].sort((a, b) => {
              const aTime = new Date(a.timestamp || a.createdAt || a.time || 0);
              const bTime = new Date(b.timestamp || b.createdAt || b.time || 0);
              return aTime - bTime;
            }).map((m, idx) => {
              const senderNameLookup = group?.members?.find(mem => (mem._id ?? mem.id) === m.senderId)?.name;
              const lsName = typeof localStorage !== 'undefined' ? localStorage.getItem('current_user_name') : null;
              const senderName = m.sender?.name || m.senderName || senderNameLookup || lsName;
              const namePalette = ['#e57373', '#ba68c8', '#64b5f6', '#4db6ac', '#81c784', '#ffd54f', '#ffb74d', '#a1887f'];
              const nameColor = namePalette[Math.abs((senderName || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % namePalette.length];
              const rawTime = m.timestamp || m.createdAt || m.time;
              const timeString = rawTime ? new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              const isSent = m.senderId === currentUserId;
              return (
                <div key={m.id || m.timestamp || idx} className={`message-wrapper ${isSent ? 'sent' : 'received'}`}>
                  <div className={`message-content ${isSent ? 'sent' : 'received'}`}>
                    <div className={`msg-bubble ${isSent ? 'sent' : 'received'}`} style={{ textAlign: 'left' }}>
                      {/* Sender name for group messages (only show for received messages) */}
                      {!isSent && senderName && (
                        <span className="sender-name" style={{ fontWeight: 600, display: 'block', marginBottom: 2, color: nameColor }}>
                          {senderName}
                        </span>
                      )}
                      {/* Message text */}
                      {(m.content ?? m.text) && (
                        <span className="msg-text">{m.content ?? m.text}</span>
                      )}
                      {/* File attachments */}
                      {m.attachments?.map((file, fileIdx) => {
                        const isImage = file.type?.startsWith('image/');
                        return (
                          <div key={fileIdx} className="file-attachment" style={{ marginTop: '8px', maxWidth: '300px' }}>
                            {isImage ? (
                              <a href={file.url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={file.url}
                                  alt={file.name || 'Image'}
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '200px',
                                    borderRadius: '8px',
                                    border: '1px solid #e0e0e0'
                                  }}
                                />
                              </a>
                            ) : (
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '8px',
                                  backgroundColor: '#f5f5f5',
                                  borderRadius: '8px',
                                  textDecoration: 'none',
                                  color: '#333',
                                  border: '1px solid #e0e0e0'
                                }}
                              >
                                <i className="fas fa-file" style={{ marginRight: '8px' }}></i>
                                <span style={{
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {file.name || 'Download file'}
                                </span>
                              </a>
                            )}
                          </div>
                        );
                      })}
                      {/* Timestamp + read/unread badge */}
                      <span className="message-time" style={{ marginLeft: 4 }}>

                        {timeString}
                        {Array.isArray(m.seenBy) && m.seenBy.length > 0 ? (
                          <i className="fas fa-check-double text-primary"></i>
                        ) : (
                          <i className="fas fa-check"></i>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>
      </div>

      {onSend && (
        <div className="chat-input-container">
          {typingUserId && (
            <div className="typing-indicator" style={{
              display: 'flex',
              alignItems: 'center',
              background: 'transparent',
              borderRadius: '18px',
              padding: '10px 12px',
              marginBottom: '8px',
              width: 'fit-content',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              fontSize: '13px',
              color: '#54656f',
              fontFamily: 'Segoe UI, system-ui, -apple-system, sans-serif',
              transition: 'all 0.2s ease-in-out'
            }}>
              <div className="typing-dots" style={{
                display: 'flex',
                alignItems: 'center',
                marginRight: '8px',
                height: '20px'
              }}>
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#8696a0',
                  margin: '0 2px',
                  animation: 'bounce 1.5s infinite ease-in-out',
                  animationDelay: '0s'
                }}></span>
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#8696a0',
                  margin: '0 2px',
                  animation: 'bounce 1.5s infinite ease-in-out',
                  animationDelay: '0.2s'
                }}></span>
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#8696a0',
                  margin: '0 2px',
                  animation: 'bounce 1.5s infinite ease-in-out',
                  animationDelay: '0.4s'
                }}></span>
              </div>
              <span style={{ fontWeight: 500 }}>{userCache[typingUserId]?.name || 'Someone'}</span> <span style={{ padding: '0 5px' }}>is typing...</span>
              <style>{
                `@keyframes bounce {
                  0%, 60%, 100% { transform: translateY(0); }
                  30% { transform: translateY(-4px); }
                }`
              }</style>
            </div>
          )}
          <MessageInput
            onSend={handleSendMessage}
            disabled={!group}
            groupId={group?.id}
            currentUserId={currentUserId}
          />
        </div>
      )}
    </div>
  );
}

GroupChatWindow.propTypes = {
  currentUserId: PropTypes.string,
  group: PropTypes.object,
  messages: PropTypes.array,
  onSend: PropTypes.func,
  onBack: PropTypes.func,
};
