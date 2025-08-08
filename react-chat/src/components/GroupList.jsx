import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import EditGroupModal from './EditGroupModal';
import { updateGroup } from '../services/groupService';
import './GroupList.css';

export default function GroupList({ groups = [], selected, onSelect, onUpdated, users = [], currentUserId }) {
  const [editingGroup, setEditingGroup] = useState(null);
  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[u.id] = u.displayName || u.name || u.email || u.id;
    });
    return map;
  }, [users]);
const [showEdit, setShowEdit] = useState(false);

const openEdit = (g, e) => {
  e.stopPropagation(); // prevent select
  setEditingGroup(g);
  setShowEdit(true);
};

const handleSave = async (groupId, updateFields) => {
  await updateGroup(groupId, updateFields, currentUserId);
  setShowEdit(false);
  setEditingGroup(null);
  onUpdated?.();
};

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
          style={{ position: 'relative' }}
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
              {/* {Array.isArray(g.members) && g.members.length > 0 && (
                <span className="d-block text-truncate" style={{ maxWidth: '160px' }}>
                  {g.members
                    .map((id) => userMap[id] || id)
                    .slice(0, 3)
                    .join(', ')}
                  {g.members.length > 3 ? '…' : ''}
                </span>
              )} */}
              {g.createdBy === currentUserId && (
              <button
                className="btn btn-sm btn-link position-absolute top-0 end-0 me-1 mt-1"
                onClick={(e) => openEdit(g, e)}
                title="Edit group"
              >✎</button>
            )}
            </div>
          </div>
        </div>
      ))}
      {editingGroup && (
        <EditGroupModal
          show={showEdit}
          onHide={() => setShowEdit(false)}
          onSave={handleSave}
          group={editingGroup}
          users={users}
          currentUserId={currentUserId}
        />
      )}

    </div>
  );
}

GroupList.propTypes = {
  groups: PropTypes.array,
  selected: PropTypes.object,
  onSelect: PropTypes.func,
  onUpdated: PropTypes.func,
  users: PropTypes.array,
  currentUserId: PropTypes.string,
};

// util – simple hash to color (same as earlier stringToColor from vanilla script)
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return `#${'00000'.substring(0, 6 - c.length) + c}`;
}
