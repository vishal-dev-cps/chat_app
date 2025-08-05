import PropTypes from 'prop-types';
import './GroupList.css';

export default function GroupList({ groups = [], selected, onSelect }) {
  return (
    <div className="group-list">
      <div className="group-list-header">Groups</div>
      {groups.length === 0 && (
        <div className="subtitle-group">No groups yet</div>
      )}
      {groups.map((g) => (
        <div
          key={g.id}
          className={`group-item ${selected?.id === g.id ? 'active' : ''}`}
          onClick={() => onSelect?.(g)}
        >
          <div
            className="group-avatar"
            style={{ backgroundColor: stringToColor(g.id) }}
          >
            {g.name.charAt(0).toUpperCase()}
          </div>
          <div className="group-info">
            <div className="group-name">{g.name}</div>
            <div className="group-meta small members-preview">
              {Array.isArray(g.members) ? g.members.length : g.membersCount || 0} members
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

GroupList.propTypes = {
  groups: PropTypes.array,
  selected: PropTypes.object,
  onSelect: PropTypes.func,
};

// util – simple hash to color (same as earlier stringToColor from vanilla script)
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return `#${'00000'.substring(0, 6 - c.length) + c}`;
}
