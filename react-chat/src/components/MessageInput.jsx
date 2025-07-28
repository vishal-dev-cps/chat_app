import { useState } from 'react';

import { useRef } from 'react';

export default function MessageInput({ disabled, onSend }) {
  const [text, setText] = useState('');
  const fileInput = useRef();

  const handleSend = () => {
    onSend(text);
    setText('');
  };
  return (
    <div className="message-input-bar d-flex align-items-center px-2">
      <button type="button" className="icon-btn" onClick={()=>{}} disabled={disabled}>
        <i className="far fa-smile"></i>
      </button>
      <button type="button" className="icon-btn" onClick={()=>fileInput.current.click()} disabled={disabled}>
        <i className="fas fa-paperclip"></i>
      </button>
      <input
        className="form-control flex-grow-1 border-0 bg-transparent"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        placeholder={disabled ? 'Select a user first' : 'Type a message'}
      />
      <button type="button" className="icon-btn send" onClick={handleSend} disabled={disabled || !text}>
        <i className="fas fa-paper-plane"></i>
      </button>
      <input type="file" ref={fileInput} style={{ display: 'none' }} />
    </div>
  );
}