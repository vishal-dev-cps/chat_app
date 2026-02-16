import React from 'react';
import './MessageStatus.css';

const MessageStatus = ({ status, timestamp }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'read':
        return (
          <span className="message-status read">
            <i className="fas fa-check-double"></i>
          </span>
        );
      case 'delivered':
        return (
          <span className="message-status delivered">
            <i className="fas fa-check-double"></i>
          </span>
        );
      case 'sent':
        return (
          <span className="message-status sent">
            <i className="fas fa-check"></i>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="message-status-container">
      {timestamp && (
        <span className="message-time">
          {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      {getStatusIcon()}
    </div>
  );
};

export default MessageStatus;