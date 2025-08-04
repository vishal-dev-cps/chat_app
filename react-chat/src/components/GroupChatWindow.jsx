import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import MessageInput from './MessageInput';
import './ChatWindow.css';

export default function GroupChatWindow({ currentUserId, group, messages = [], onSend }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!group) {
    return null;
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="header-info">
          <span className="name">{group.name}</span>
          <span className="status">{Array.isArray(group.members) ? group.members.length : 0} members</span>
        </div>
      </div>
      <div className="chat-messages-container">
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="empty-chat-state">
              <div className="empty-chat-content">
                <h5>No messages yet</h5>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`message ${m.from === currentUserId ? 'sent' : 'received'}`}>
                <div className="text">{m.text}</div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
      </div>
      <MessageInput onSend={({ text, attachments }) => onSend(text, attachments)} disabled={!group} />
    </div>
  );
}

GroupChatWindow.propTypes = {
  currentUserId: PropTypes.string,
  group: PropTypes.object,
  messages: PropTypes.array,
  onSend: PropTypes.func,
};
