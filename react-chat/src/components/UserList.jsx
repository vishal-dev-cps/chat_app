export default function UserList({ users, selected, onSelect }) {
    return (
      <div>
        {users.map((u) => (
          <div
            key={u.id}
            className={`user-item ${selected?.id === u.id ? 'active' : ''}`}
            onClick={() => onSelect(u)}
          >
            <img
              src={u.photoURL}
              alt={u.displayName}
              className="user-avatar-sm"
              onError={(e)=>{
                const initials = (u.displayName||'U').split(' ').slice(0,2).map(s=>s[0].toUpperCase()).join('');
                e.target.onerror=null;
                e.target.src=`https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random`;
              }}
            />
            <span>{u.displayName}</span>
          </div>
        ))}
      </div>
    );
  }