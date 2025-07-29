import { useEffect, useState } from 'react';
import './UserList.css';
import MessageStatus from './MessageStatus';

// Group users by their role
const groupUsersByRole = (users) => {
  const groups = {
    superAdmin: { label: 'Super Admins (SA)', users: [] },
    admin: { label: 'Admins (A)', users: [] },
    security: { label: 'Security Personnel (SP)', users: [] },
    other: { label: 'Other', users: [] }
  };

  users.forEach(user => {
    const role = user.role || 'other';
    if (groups[role]) {
      groups[role].users.push(user);
    } else {
      groups.other.users.push(user);
    }
  });

  // Filter out empty groups and return as array
  return Object.entries(groups)
    .filter(([_, group]) => group.users.length > 0)
    .map(([key, group]) => ({
      ...group,
      key,
      // Sort users within each group by online status and then by name
      users: [...group.users].sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        return (a.displayName || '').localeCompare(b.displayName || '');
      })
    }));
};

// Format message preview text
const formatMessagePreview = (text) => {
  if (!text) return '';
  return text.length > 30 ? `${text.substring(0, 30)}...` : text;
};

// Get last message for a user
const getLastMessage = (userId, messages) => {
  if (!messages || !messages.length) return null;
  
  const userMessages = messages
    .filter(m => m.from === userId || m.to === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
  return userMessages[0] || null;
};

// Unread badge component
const UnreadBadge = ({ count }) => {
  if (!count || count <= 0) return null;
  
  return (
    <span className="unread-badge">
      {count > 9 ? '9+' : count}
    </span>
  );
};

export default function UserList({ users, selected, onSelect, messages = [] }) {
  const groupedUsers = groupUsersByRole(users);

  return (
    <div className="user-list">
      {groupedUsers.map((group) => (
        <div key={group.key} className="user-group">
          <div className="user-group-header">
            {group.label}
          </div>
          {group.users.map((user) => {
            const lastMessage = getLastMessage(user.id, messages);
            const isCurrentUser = lastMessage && lastMessage.from === user.id;
            const messagePreview = lastMessage ? lastMessage.text : 'No messages yet';
            
            return (
              <div
                key={user.id}
                className={`user-item ${selected?.id === user.id ? 'active' : ''}`}
                onClick={() => onSelect(user)}
              >
                <UnreadBadge count={user.unreadCount} />
                <div className="user-avatar-container">
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="user-avatar-sm"
                    onError={(e) => {
                      const initials = (user.displayName || 'U').split(' ').slice(0, 2).map(s => s[0].toUpperCase()).join('');
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random`;
                    }}
                  />
                  {user.status === 'online' && <span className="status-dot online"></span>}
                </div>
                <div className="user-info">
                  <div className="user-name">
                    {user.displayName}
                    {lastMessage && (
                      <span className="last-message-time">
                        {new Date(lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="last-message-preview">
                    {lastMessage && (
                      <span className={`message-sender ${isCurrentUser ? 'sent' : ''}`}>
                        {isCurrentUser ? 'You: ' : ''}
                      </span>
                    )}
                    {formatMessagePreview(messagePreview)}
                    {lastMessage && lastMessage.status && (
                      <span className="message-status-preview">
                        <MessageStatus status={lastMessage.status} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}