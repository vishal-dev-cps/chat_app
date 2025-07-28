export default function UserList({ users, selected, onSelect }) {
    return (
      <ul className="list-group">
        {users.map((u) => (
          <li
            key={u.id}
            className={`list-group-item ${selected?.id === u.id ? 'active' : ''}`}
            onClick={() => onSelect(u)}
            style={{ cursor: 'pointer' }}
          >
            {u.name}
          </li>
        ))}
      </ul>
    );
  }