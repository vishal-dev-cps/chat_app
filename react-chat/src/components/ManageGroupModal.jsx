import { useState, useMemo } from "react";
import { Modal, Button, Form, InputGroup } from "react-bootstrap";
import PropTypes from "prop-types";

export default function ManageGroupModal({
  show,
  onHide,
  onSubmit, // { name, members }
  users = [],
  currentUserId,
  mode = "add", // "add" | "edit" | "view"
  initialGroupName = "",
  initialMembers = [],
}) {
  const isView = mode === "view";

  const [groupName, setGroupName] = useState(initialGroupName);
  const [selected, setSelected] = useState(
    initialMembers.length ? initialMembers : [currentUserId]
  );
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleUser = (userId) => {
    if (isView) return;
    setSelected((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSave = async () => {
    if (!groupName.trim() || selected.length < 2) return;
    setSaving(true);
    try {
      await onSubmit({
        name: groupName.trim(),
        members: Array.from(new Set(selected.concat(currentUserId))),
      });
      onHide();
    } catch (e) {
      alert("Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) =>
      (u.displayName || u.name || u.email || "")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [users, search]);

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          {mode === "add"
            ? "Create Group"
            : mode === "edit"
            ? "Edit Group"
            : "Group Members"}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {!isView && (
          <Form.Group className="mb-3">
            <Form.Label><strong>Group Name</strong></Form.Label>
            <Form.Control
              placeholder="Enter group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </Form.Group>
        )}

        <InputGroup className="mb-2">
          <Form.Control
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>

        <div style={{ maxHeight: "350px", overflowY: "auto" }}>
          {filteredUsers.map((u) => {
            const checked = selected.includes(u.id);
            const label = u.displayName || u.name || u.email || u.id;

            return (
              <div
                key={u.id}
                onClick={() => toggleUser(u.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px",
                  borderRadius: "8px",
                  cursor: isView ? "default" : "pointer",
                  background: checked ? "#f0f7ff" : "white",
                  border: checked ? "1px solid #0d6efd" : "1px solid #e9ecef",
                  marginBottom: "6px",
                  transition: "0.2s",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "#0d6efd33",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontWeight: "600",
                    textTransform: "uppercase",
                  }}
                >
                  {label.charAt(0)}
                </div>

                <div style={{ flex: 1 }}>{label}</div>

                {!isView && (
                  <Form.Check
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleUser(u.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>
            );
          })}
        </div>

        {!isView && (
          <small className="text-muted">Select at least two members.</small>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={saving}>
          Close
        </Button>

        {!isView && (
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || selected.length < 2 || !groupName.trim()}
          >
            {saving ? "Saving..." : mode === "edit" ? "Update" : "Create"}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}

ManageGroupModal.propTypes = {
  show: PropTypes.bool,
  onHide: PropTypes.func,
  onSubmit: PropTypes.func,
  users: PropTypes.array,
  currentUserId: PropTypes.string,
  mode: PropTypes.oneOf(["add", "edit", "view"]),
  initialGroupName: PropTypes.string,
  initialMembers: PropTypes.array,
};
