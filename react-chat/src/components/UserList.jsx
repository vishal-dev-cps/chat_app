import {  useEffect, useMemo, useState } from 'react';
import {  getChatFromLocal } from '../services/chatService';
import './UserList.css';
import { ImageZoom } from './ImageZoom';
import 'react-medium-image-zoom/dist/styles.css';

// Group users by their role
const groupUsersByRole = (users) => {
  const groups = {
    superadmin: { label: 'Super Admins', users: [], priority: 1 },
    admin: { label: 'Admins', users: [], priority: 2 },
    security: { label: 'Security Personnel', users: [], priority: 3 },
    other: { label: 'Other', users: [], priority: 4 }
  };

  users.forEach(user => {
    const role = (user.role || 'other').toLowerCase();
    const groupKey = role === 'superadmins' ? 'superadmin' :
      role === 'admins' ? 'admin' :
        role in groups ? role : 'other';

    if (groups[groupKey]) {
      groups[groupKey].users.push(user);
    } else {
      groups.other.users.push(user);
    }
  });

  // Filter out empty groups and return as array, sorted by priority
  return Object.entries(groups)
    .filter(([_, group]) => group.users.length > 0)
    .sort(([_, a], [__, b]) => a.priority - b.priority)
    .map(([key, group]) => ({
      ...group,
      key
    }));
};

export default function UserList({ users, selected, onSelect, messages }) {
  const [forceUpdate, setForceUpdate] = useState(0);

  // Force update when selected changes
  useEffect(() => {
    if (selected) {
      // Small delay to ensure localStorage is written
      const timer = setTimeout(() => {
        setForceUpdate(prev => prev + 1);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selected]);

  // Also listen for custom storage events
  useEffect(() => {
    const handleStorageUpdate = () => {
      setForceUpdate(prev => prev + 1);
    };

    window.addEventListener('localStorageUpdated', handleStorageUpdate);
    return () => window.removeEventListener('localStorageUpdated', handleStorageUpdate);
  }, []);

  // Calculate last messages and unread counts
  const usersWithMetadata = useMemo(() => {
    const currentUserId = localStorage.getItem('current_user_id');

    return users.map(user => {
      const userId = user.userId || user.id;
      const localMessages = getChatFromLocal(currentUserId, userId) || [];

      let lastMsg = null;
      let unreadCount = 0;

      if (localMessages.length > 0) {
        const sorted = [...localMessages].sort(
          (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
        );

        const mostRecent = sorted[0];

        lastMsg = {
          text: mostRecent.text || '',
          timestamp: mostRecent.timestamp,
          from: mostRecent.from,
          to: mostRecent.to,
          isDeleted: mostRecent.isDeleted || false,
          attachments: mostRecent.attachments || []
        };

        unreadCount = localMessages.filter(msg =>
          msg.from === userId &&
          msg.to === currentUserId &&
          msg.status !== 'read'
        ).length;
      }

      return {
        ...user,
        lastMessage: lastMsg,
        unreadCount
      };
    });
  }, [users, messages, selected, forceUpdate]);

  // Group users by role and sort by last message timestamp
  const groupedUsers = useMemo(() => {
    const groups = groupUsersByRole(usersWithMetadata);

    return groups.map(group => ({
      ...group,
      users: [...group.users].sort((a, b) => {
        const aTimestamp = a.lastMessage?.timestamp || 0;
        const bTimestamp = b.lastMessage?.timestamp || 0;

        // Sort by most recent message first
        if (bTimestamp !== aTimestamp) {
          return bTimestamp - aTimestamp;
        }

        // If no messages or same timestamp, sort alphabetically
        return (a.displayName || '').localeCompare(b.displayName || '');
      })
    }));
  }, [usersWithMetadata]);

  return (
    <div className="user-list">
      {groupedUsers.map(group => (
        <div key={group.key} className="user-group">

          <div className="user-group-header">
            <span className="group-label">{group.label}</span>
            <span className="group-count">({group.users.length})</span>
          </div>

          {group.users.map(user => {
            const userId = user.userId || user.id;
            const isSelected =
              selected?.id === userId ||
              selected?.userId === userId;

            const lastMsg = user.lastMessage;

            return (
              <div
                key={userId}
                onClick={() => onSelect(user)}
                className={`user-item ${isSelected ? 'active' : ''}`}
              >
                <div className="user-avatar-wrapper">
                  <ImageZoom>
                    <img
                      src={user.photoURL}
                      alt={user.displayName}
                      className="user-avatar"
                    />
                  </ImageZoom>
                  {user.status === 'online' && (
                    <span className="online-indicator"></span>
                  )}
                </div>

                <div className="user-info">
                  <div className="user-header">
                    <span className="user-name">
                      {user.displayName}
                    </span>
                  </div>

                  <div className="user-preview">
                    {lastMsg ? (
                      <>
                        <span className="last-message">
                          {lastMsg.from === localStorage.getItem('current_user_id')
                            ? 'You: '
                            : ''}
                          {lastMsg.isDeleted
                            ? 'This message was deleted'
                            : lastMsg.text}
                        </span>

                        {user.unreadCount > 0 && (
                          <span className="unread-badge">
                            {user.unreadCount > 99
                              ? '99+'
                              : user.unreadCount}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="last-message no-messages">
                        No messages yet
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