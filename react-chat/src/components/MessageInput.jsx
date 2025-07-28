import { useState } from 'react';

export default function MessageInput({ disabled, onSend }) {
  const [text, setText] = useState('');
  const handleSend = () => {
    onSend(text);
    setText('');
  };
  return (
    <div className="input-group">
      <input
        className="form-control"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        placeholder={disabled ? 'Select a user first' : 'Type a message'}
      />
      <button className="btn btn-primary" onClick={handleSend} disabled={disabled || !text}>
        Send
      </button>
    </div>
  );
}