export default function ChatWindow({ messages, selectedUser, currentUserId }) {
    if (!selectedUser) return <div className="flex-grow-1 border rounded p-3 text-muted">Select a user to start chatting.</div>;
    return (
      <div className="chat-window">
                <div className="chat-header">
                    <img
            src={selectedUser.photoURL}
            alt={selectedUser.displayName}
            onError={(e)=>{
              const initials=(selectedUser.displayName||'U').split(' ').slice(0,2).map(s=>s[0].toUpperCase()).join('');
              e.target.onerror=null;
              e.target.src=`https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random`;
            }}
          />
                    <span className="name">{selectedUser.displayName}</span>
        </div>
        <div className="chat-messages">
          {messages
            .filter((m) =>
              (m.from === currentUserId && m.to === selectedUser.id) ||
              (m.from === selectedUser.id && m.to === currentUserId)
            )
            .map((m, i) => (
              <div key={i} className={`mb-2 ${m.from === currentUserId ? 'text-end' : 'text-start'}`}>
                <span className={`msg-bubble ${m.from === currentUserId ? 'sent' : 'received'}`}>{m.text}</span>
              </div>
            ))}
        </div>
      </div>
    );
  }