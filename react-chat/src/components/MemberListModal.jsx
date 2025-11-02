import React, { useMemo } from 'react';
import { Modal } from 'react-bootstrap';

export default function MemberListModal({ show, onHide, members = [], allUsers = [] }) {

  // Map users by ID (backup lookup)
  const userMap = useMemo(() => {
    const map = {};
    allUsers.forEach(u => {
      if (!u) return;
      map[u.id] = u;
      map[u._id] = u; // Mongo support
    });
    return map;
  }, [allUsers]);

  // Build final consistent member objects
  const list = members.map(m => {
    if (!m) return {};

    // ✅ New API format (object)
    if (typeof m === "object" && m.id) {
      return {
        id: m.id,
        name: m.name || m.displayName || m.email || m.id,
        role: m.role,
        email: m.email
      };
    }

    // ✅ Old format (ID string)
    const u = userMap[m];
    return {
      id: m,
      name: u?.name || u?.displayName || u?.email || m,
      email: u?.email,
      role: u?.role
    };
  });

  return (
    <Modal show={show} onHide={onHide} centered dialogClassName="whatsapp-modal">
      <div style={{
        background: "#121B22",
        color: "#EDEDED",
        padding: "20px",
        borderRadius: "12px",
        maxHeight: "80vh",
        overflowY: "auto"
      }}>
        <div style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "10px" }}>
          Group Members
        </div>

        {list.map((u, i) => (
          <div key={i} style={{
            padding: "10px",
            borderBottom: "1px solid #2a3942",
            display: "flex",
            alignItems: "center"
          }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "#2a3942",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginRight: "10px",
              fontSize: "14px",
              fontWeight: "bold",
              textTransform: "uppercase"
            }}>
              {(u.name || "?")[0]}
            </div>

            <div>
              <div style={{ fontWeight: 500 }}>{u.name}</div>
              <div style={{ fontSize: "12px", opacity: .7 }}>{u.email}</div>
              <div style={{ fontSize: "11px", opacity: .5 }}>{u.role}</div>
            </div>
          </div>
        ))}

        <div style={{ textAlign: "center", marginTop: "10px" }}>
          <button
            onClick={onHide}
            style={{
              background: "#2a3942",
              color: "#EDEDED",
              border: "none",
              padding: "8px 16px",
              borderRadius: "8px",
              cursor: "pointer"
            }}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
