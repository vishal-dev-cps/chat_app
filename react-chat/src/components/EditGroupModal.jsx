import { useEffect, useState, useMemo } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import PropTypes from 'prop-types';

/**
 * Modal dialog to edit an existing chat group (e.g. add/remove members or rename).
 * Props:
 *  - show (bool): whether modal is visible
 *  - onHide (func): called to close modal
 *  - onSave (func): async (groupId, updateFields) => void, performs PATCH via API
 *  - group (object): current group { id, name, members }
 *  - users (array): list of all users { id, displayName }
 *  - currentUserId (string): id of logged in user
 */
export default function EditGroupModal({ show, onHide, onSave, group, users = [], currentUserId }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  // Map of id -> display label
  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[u.id] = u.displayName || u.name || u.email || u.id;
    });
    // also ensure members present
    if (group?.members) {
      group.members.forEach((id) => {
        if (!map[id]) map[id] = id;
      });
    }
    return map;
  }, [users, group]);

  // build combined list of user objects (existing users array first)
  const allUsers = useMemo(() => {
    const combined = [...users];
    if (group?.members) {
      group.members.forEach((id) => {
        if (!combined.find((u) => u.id === id)) combined.push({ id });
      });
    }
    return combined;
  }, [users, group]);

  // initialise when modal opens or group changes
  useEffect(() => {
    if (group) {
      setName(group.name || '');
      setSelected(Array.isArray(group.members) ? group.members : []);
    }
  }, [group]);

  const toggleUser = (userId) => {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const membersSet = new Set(selected);
    if (!name.trim() || membersSet.size < 2) return;
    try {
      setSaving(true);
      await onSave(group.id, { name: name.trim(), members: Array.from(membersSet) });
      onHide();
    } catch (err) {
      console.error('Error updating group:', err);
      alert(err.message || 'Failed to update group');
    } finally {
      setSaving(false);
    }
  };

  const canSave = name.trim() && new Set(selected).size >= 2 && !saving;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Group</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3" controlId="groupName">
            <Form.Label>Group Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Form.Group>

          {selected.length > 0 && (
            <div className="mb-3 small text-muted">
              Current members: {selected.map((id) => userMap[id] || id).join(', ')}
            </div>
          )}
          

          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {allUsers.map((u) => (
              <Form.Check
                key={u.id}
                type="checkbox"
                id={`member-${u.id}`}
                label={u.displayName || u.name || u.email || u.id}
                checked={selected.includes(u.id)}
                onChange={() => toggleUser(u.id)}
                disabled={u.id === currentUserId}
              />
            ))}
          </div>
          <small className="text-muted">Select at least two members. You cannot remove yourself.</small>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={!canSave}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

EditGroupModal.propTypes = {
  show: PropTypes.bool,
  onHide: PropTypes.func,
  onSave: PropTypes.func,
  group: PropTypes.object,
  users: PropTypes.array,
  currentUserId: PropTypes.string,
};
