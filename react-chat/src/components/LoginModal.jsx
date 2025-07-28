import { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

export default function LoginModal({ show, onSubmit }) {
  const [id, setId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (id.trim()) onSubmit(id.trim());
  };

  return (
    <Modal show={show} backdrop="static" keyboard={false} centered>
      <Modal.Header>
        <Modal.Title>Enter Security ID</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Form.Group controlId="securityId">
            <Form.Label>Your unique Security/User ID</Form.Label>
            <Form.Control
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              autoFocus
              placeholder="e.g. FuXtwE81SxfyV0ITSudl"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" type="submit" disabled={!id.trim()}>
            Continue
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
