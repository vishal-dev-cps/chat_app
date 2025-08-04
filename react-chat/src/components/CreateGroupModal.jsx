import { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import PropTypes from 'prop-types';

/**
 * Modal dialog to create a new chat group.
 * Props:
 *  - show (bool): whether modal is visible
 *  - onHide (func): called to close modal
 *  - onCreate (func): async ({ name, members }) => void, should create group via API
 *  - users (array): list of users to choose from, each { id, displayName }
 */
export default function CreateGroupModal({ show, onHide, onCreate, users = [], currentUserId }) {
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState(currentUserId ? [currentUserId] : []);
  const [saving, setSaving] = useState(false);

  const toggleUser = (userId) => {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const membersSet = new Set([...selected, currentUserId]);
    if (!groupName.trim() || membersSet.size < 2) return;
    try {
      setSaving(true);
      await onCreate({ name: groupName.trim(), members: Array.from(membersSet), createdBy: currentUserId });
      setGroupName('');
      setSelected([]);
      onHide();
    } catch (err) {
      console.error('Error creating group:', err);
      alert(err.message || 'Failed to create group');
    } finally {
      setSaving(false);
    }
  };

  const canSave = groupName.trim() && new Set([...selected, currentUserId]).size >= 2 && !saving;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Create Group</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3" controlId="groupName">
            <Form.Label>Group Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              autoFocus
            />
          </Form.Group>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {users.map((u) => (
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
          <small className="text-muted">Select at least two members.</small>
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
  show: PropTypes.bool,
  onHide: PropTypes.func,
  onCreate: PropTypes.func,
  users: PropTypes.array,
  currentUserId: PropTypes.string,
};
