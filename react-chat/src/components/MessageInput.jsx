import { useState, useRef } from 'react';
import './MessageInput.css';

export default function MessageInput({ disabled, onSend }) {
  const [text, setText] = useState('');
  const fileInput = useRef();

  const handleSend = () => {
    onSend(text);
    setText('');
  };
  return (
    <div className="message-input-bar">
      <button type="button" className="icon-btn" onClick={()=>{}} disabled={disabled} aria-label="Emoji">
        <i className="far fa-smile"></i>
      </button>
      <button type="button" className="icon-btn" onClick={()=>fileInput.current.click()} disabled={disabled} aria-label="Attach file">
        <i className="fas fa-paperclip"></i>
      </button>
      <input
        className="form-control"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        placeholder={disabled ? 'Select a user first' : 'Type a message'}
        aria-label="Type a message"
      />
      <button 
        type="button" 
        className="icon-btn send" 
        onClick={handleSend} 
        disabled={disabled || !text}
        aria-label="Send message"
      >
        <i className="fas fa-paper-plane"></i>
      </button>
      <input type="file" ref={fileInput} style={{ display: 'none' }} aria-label="File input" />
    </div>
  );
}