import { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import PropTypes from 'prop-types';

export default function CreateGroupModal({
  show,
  onHide,
  onCreate,
  users = [],
  currentUserId,
}) {
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (show) {
      setGroupName('');
      setSelected([]);
      setSaving(false);
    }
  }, [show]);

  const toggleUser = (userId) => {
    setSelected((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selected.length < 1) return;

    try {
      setSaving(true);

      await onCreate({
        name: groupName.trim(),
        members: [currentUserId, ...selected],
        createdBy: currentUserId,
      });

      onHide();
    } catch (err) {
      console.error('Error creating group:', err);
      alert(err.message || 'Failed to create group');
    } finally {
      setSaving(false);
    }
  };

  const canSave = groupName.trim() && selected.length >= 1 && !saving;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Create Group</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Group Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              autoFocus
            />
          </Form.Group>

          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {users
              .filter((u) => u.id !== currentUserId) // 🔥 EXCLUDE SELF
              .map((u) => (
                <Form.Check
                  key={u.id}
                  type="checkbox"
                  id={`member-${u.id}`}
                  label={u.displayName || u.name || u.email || u.id}
                  checked={selected.includes(u.id)}
                  onChange={() => toggleUser(u.id)}
                />
              ))}
          </div>

          <small className="text-muted">
            Select at least one member (you are added automatically).
          </small>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={!canSave}>
            {saving ? 'Creating...' : 'Create'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

CreateGroupModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
  users: PropTypes.array,
  currentUserId: PropTypes.string.isRequired,
};
