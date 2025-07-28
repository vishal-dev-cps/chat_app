export default function ChatWindow({ messages, selectedUser, currentUserId }) {
    if (!selectedUser) return <div className="flex-grow-1 border rounded p-3 text-muted">Select a user to start chatting.</div>;
    return (
      <div className="flex-grow-1 border rounded p-3 overflow-auto mb-2">
        {messages
          .filter((m) =>
            (m.from === currentUserId && m.to === selectedUser.id) ||
            (m.from === selectedUser.id && m.to === currentUserId)
          )
          .map((m, i) => (
            <div key={i} className={`mb-2 ${m.from === currentUserId ? 'text-end' : 'text-start'}`}>
              <span className={`badge bg-${m.from === currentUserId ? 'primary' : 'secondary'}`}>{m.text}</span>
            </div>
          ))}
      </div>
    );
  }