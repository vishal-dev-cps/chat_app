import { useEffect, useState, useMemo } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import PropTypes from 'prop-types';

export default function EditGroupModal({
  show,
  onHide,
  onSave,
  group,
  users = [],
  currentUserId,
}) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  // 🔥 Normalize group member IDs (handles object or string)
  const groupMemberIds = useMemo(() => {
    if (!Array.isArray(group?.members)) return [];
    return group.members.map((m) => (typeof m === 'string' ? m : m.id));
  }, [group]);

  // 🔹 Map userId → display name
  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[u.id] = u.displayName || u.name || u.email || u.id;
    });

    // Ensure group members always exist in map
    if (group?.members) {
      group.members.forEach((m) => {
        const id = typeof m === 'string' ? m : m.id;
        if (!map[id]) map[id] = m.name || id;
      });
    }

    return map;
  }, [users, group]);

  // 🔹 Build unified user list
  const allUsers = useMemo(() => {
    const combined = [...users];

    groupMemberIds.forEach((id) => {
      if (!combined.find((u) => u.id === id)) {
        combined.push({ id });
      }
    });

    return combined;
  }, [users, groupMemberIds]);

  // 🔹 Initialize state on open
  useEffect(() => {
    if (group) {
      setName(group.name || '');
      setSelected(groupMemberIds);
    }
  }, [group, groupMemberIds]);

  const toggleUser = (userId) => {
    setSelected((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim() || selected.length < 2) return;

    try {
      setSaving(true);
      await onSave(group.id, {
        name: name.trim(),
        members: selected, // ✅ SEND IDS ONLY
      });
      onHide();
    } catch (err) {
      console.error('Error updating group:', err);
      alert(err.message || 'Failed to update group');
    } finally {
      setSaving(false);
    }
  };

  const canSave = name.trim() && selected.length >= 2 && !saving;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Group</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Group Name</Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Form.Group>

          {selected.length > 0 && (
            <div className="mb-3 small text-muted">
              Current members:{' '}
              {selected.map((id) => userMap[id]).join(', ')}
            </div>
          )}

          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {allUsers.map((u) => (
              <Form.Check
                key={u.id} // ✅ STRING ID ONLY
                type="checkbox"
                id={`member-${u.id}`}
                label={userMap[u.id]} // ✅ STRING LABEL ONLY
                checked={selected.includes(u.id)}
                onChange={() => toggleUser(u.id)}
                disabled={u.id === currentUserId}
              />
            ))}
          </div>

          <small className="text-muted">
            Select at least two members. You cannot remove yourself.
          </small>
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
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  group: PropTypes.object,
  users: PropTypes.array,
  currentUserId: PropTypes.string.isRequired,
};
