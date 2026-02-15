import { useMemo } from 'react';
import { getLastMessage, getUnreadCount, getChatFromLocal } from '../services/chatService';
import './UserList.css';

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
  // Calculate last messages and unread counts
  const usersWithMetadata = useMemo(() => {
    const currentUserId = localStorage.getItem('current_user_id');
    
    return users.map(user => {
      const userId = user.userId || user.id;
      
      // Get all messages for this specific user conversation
      const allMessages = messages.filter(msg => 
        (msg.from === userId && msg.to === currentUserId) ||
        (msg.from === currentUserId && msg.to === userId)
      );
      
      // Only proceed if there are actual messages
      let lastMsg = null;
      if (allMessages.length > 0) {
        // Sort by timestamp descending to get the most recent
        const sortedMessages = [...allMessages].sort((a, b) => 
          (b.timestamp || 0) - (a.timestamp || 0)
        );
        const mostRecent = sortedMessages[0];
        
        lastMsg = {
          text: mostRecent.text || '',
          timestamp: mostRecent.timestamp,
          from: mostRecent.from,
          to: mostRecent.to,
          isDeleted: mostRecent.isDeleted || false,
          attachments: mostRecent.attachments || []
        };
      }
      // If no messages in state, check localStorage
      else {
        const localMessages = getChatFromLocal(currentUserId, userId);
        if (localMessages && localMessages.length > 0) {
          const sortedLocal = [...localMessages].sort((a, b) => 
            (b.timestamp || 0) - (a.timestamp || 0)
          );
          const mostRecent = sortedLocal[0];
          
          lastMsg = {
            text: mostRecent.text || '',
            timestamp: mostRecent.timestamp,
            from: mostRecent.from,
            to: mostRecent.to,
            isDeleted: mostRecent.isDeleted || false,
            attachments: mostRecent.attachments || []
          };
        }
      }
      
      // Get unread count - only for messages FROM this user TO current user
      const unreadCount = allMessages.filter(msg => 
        msg.from === userId && 
        msg.to === currentUserId && 
        msg.status !== 'read'
      ).length;
      
      return {
        ...user,
        lastMessage: lastMsg,
        unreadCount,
        lastMessageTime: lastMsg?.timestamp || 0
      };
    });
  }, [users, messages]);

  // Group users by role
  const groupedUsers = useMemo(() => {
    const groups = groupUsersByRole(usersWithMetadata);
    
    // Sort users within each group
    return groups.map(group => ({
      ...group,
      users: [...group.users].sort((a, b) => {
        // 1. Unread messages first
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        
        // 2. Sort by most recent message timestamp
        if (a.lastMessageTime !== b.lastMessageTime) {
          return b.lastMessageTime - a.lastMessageTime;
        }
        
        // 3. Online users next
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        
        // 4. Alphabetical as final tiebreaker
        return (a.displayName || '').localeCompare(b.displayName || '');
      })
    }));
  }, [usersWithMetadata]);

  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const msgDate = new Date(timestamp);
    const diffMs = now - msgDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d`;
    
    return msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const truncateText = (text, maxLength = 30) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="user-list">
      {groupedUsers.map((group) => (
        <div key={group.key} className="user-group">
          <div className="user-group-header">
            <span className="group-label">{group.label}</span>
            <span className="group-count">({group.users.length})</span>
          </div>
          
          {group.users.map(user => {
            const userId = user.userId || user.id;
            const isSelected = selected?.id === userId || selected?.userId === userId;
            const lastMsg = user.lastMessage;
            
            // Determine last message display text - ONLY if lastMsg exists
            let lastMessageText = '';
            let messagePrefix = '';
            
            if (lastMsg) {
              const currentUserId = localStorage.getItem('current_user_id');
              
              if (lastMsg.isDeleted) {
                lastMessageText = 'This message was deleted';
                messagePrefix = '🚫 ';
              } else if (lastMsg.text && lastMsg.text.trim()) {
                // Show who sent the message
                if (lastMsg.from === currentUserId) {
                  messagePrefix = 'You: ';
                }
                lastMessageText = lastMsg.text;
              } else if (lastMsg.attachments && lastMsg.attachments.length > 0) {
                // Show who sent the attachment
                if (lastMsg.from === currentUserId) {
                  messagePrefix = 'You: ';
                }
                
                const attachment = lastMsg.attachments[0];
                if (attachment.type?.startsWith('image/')) {
                  lastMessageText = '📷 Photo';
                } else if (attachment.type?.startsWith('video/')) {
                  lastMessageText = '🎥 Video';
                } else if (attachment.type?.startsWith('audio/')) {
                  lastMessageText = '🎵 Audio';
                } else {
                  lastMessageText = `📎 ${attachment.name || 'File'}`;
                }
              }
            }

            return (
              <div
                key={userId}
                onClick={() => onSelect(user)}
                className={`user-item ${isSelected ? 'active' : ''} ${user.unreadCount > 0 ? 'has-unread' : ''}`}
              >
                <div className="user-avatar-wrapper">
                  <img
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=random`}
                    alt={user.displayName}
                    className="user-avatar"
                    onError={(e) => {
                      const initials = (user.displayName || 'U')
                        .split(' ')
                        .slice(0, 2)
                        .map(s => s[0].toUpperCase())
                        .join('');
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random`;
                    }}
                  />
                  {user.status === 'online' && (
                    <span className="online-indicator"></span>
                  )}
                </div>
                
                <div className="user-info">
                  <div className="user-header">
                    <span className="user-name">{user.displayName}</span>
                    {lastMsg?.timestamp && (
                      <span className="last-message-time">
                        {formatLastMessageTime(lastMsg.timestamp)}
                      </span>
                    )}
                  </div>
                  
                  <div className="user-preview">
                    {lastMsg ? (
                      <>
                        <span className={`last-message ${lastMsg?.isDeleted ? 'deleted' : ''}`}>
                          {messagePrefix}
                          {truncateText(lastMessageText)}
                        </span>
                        
                        {user.unreadCount > 0 && (
                          <span className="unread-badge">
                            {user.unreadCount > 99 ? '99+' : user.unreadCount}
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