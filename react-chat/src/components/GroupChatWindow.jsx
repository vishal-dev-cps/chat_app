import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import MessageInput from './MessageInput';
import './ChatWindow.css';
import { fetchGroupMessages } from '../services/groupMessageService';

export default function GroupChatWindow({ currentUserId, group, messages = [], onSend }) {
  const [groupMessages, setGroupMessages] = useState(messages);
  const endRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupMessages]);

  // Long-polling to fetch latest group messages
  // useEffect(() => {
  //   let isActive = true;
  //   const POLL_INTERVAL_MS = 500; // adjust as needed (0.5s)
  //   let timeoutId;
  //   async function poll() {
  //     if (!group?.id) return;
  //     try {
  //       const latest = await fetchGroupMessages(group.id);
  //       if (isActive) setGroupMessages(latest);
  //     } catch (e) { console.error(e); }
  //     timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
  //   }
  //   poll();
  //   return () => { isActive = false; clearTimeout(timeoutId); };
  // }, [group]);

  if (!group) {
    return null;
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="header-info">
          <span className="name">{group.name}</span>
          <span className="members-preview">{Array.isArray(group.members) ? group.members.length : 0} members</span>
        </div>
      </div>

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
              const senderName = m.sender?.name || m.senderName || senderNameLookup;
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
                      {/* Timestamp + read/unread badge */}
                      <span className="message-time" style={{ marginLeft: 4 }}>
                        
                        {timeString}
                        {isSent && (
                          <span className="message-status" style={{ marginLeft: 4 }}>
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
          <div ref={endRef} />
        </div>
      </div>

      {onSend && (
        <div className="chat-input-container">
          <MessageInput onSend={({ text, attachments }) => onSend(text, attachments)} disabled={!group} />
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
};
