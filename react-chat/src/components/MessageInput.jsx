import { useState, useRef, useEffect } from 'react';
import { createFilePreview, uploadFile, formatFileSize, getFileIconClass } from '../services/attachmentService';
import EmojiPicker from 'emoji-picker-react';
import './MessageInput.css';

export default function MessageInput({ disabled, onSend }) {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const fileInput = useRef();
  const emojiPickerRef = useRef();

  const handleSend = async () => {
    if (text.trim() || attachments.length) {
      let uploadedAttachments = [];
      if (attachments.length) {
        // Optionally you can add auth token retrieval here
        uploadedAttachments = await Promise.all(
          attachments.map(async (att) => {
            try {
              const res = await uploadFile(att);
              return { name: att.name, url: res.url || res.path || res.location || '#', type: att.type, size: att.size };
            } catch (e) {
              console.error('Upload failed for', att.name, e);
              return null;
            }
          })
        ).then(arr => arr.filter(Boolean));
      }
      onSend({ text, attachments: uploadedAttachments });
      setText('');
      setAttachments([]);
      setShowEmojiPicker(false);
    }
  };

  const handleEmojiClick = (emojiData) => {
    setText(prevText => prevText + emojiData.emoji);
  };

  // Send on Enter even if focus is not on text input
  useEffect(()=>{
    const handler = (e)=>{
      if(e.key==='Enter' && !e.shiftKey){
        // only trigger if no text but we have attachments
        if(text.trim()==='' && attachments.length>0){
          e.preventDefault();
          handleSend();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return ()=> document.removeEventListener('keydown', handler);
  }, [text, attachments]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="message-input-bar">
      <div className="emoji-picker-container" ref={emojiPickerRef}>
        <button 
          type="button" 
          className="icon-btn" 
          onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
          disabled={disabled} 
          aria-label="Emoji"
        >
          <i className="far fa-smile"></i>
        </button>
        {showEmojiPicker && (
          <div className="emoji-picker">
            <EmojiPicker 
              onEmojiClick={handleEmojiClick}
              width={300}
              height={350}
              previewConfig={{ showPreview: false }}
            />
          </div>
        )}
      </div>
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="attachments-bar">
          {attachments.map(att => (
            <div key={att.id} className="attachment-preview">
              {att.preview ? (
                <img src={att.preview} alt={att.name} className="img-thumb" />
              ) : (
                <div className="file-icon"><i className={getFileIconClass(att.type, att.name)}></i></div>
              )}
              <div className="file-info">
                <span className="file-name" title={att.name}>{att.name}</span>
                <span className="file-size">{formatFileSize(att.size)}</span>
              </div>
              <button className="remove-attachment" onClick={(e)=>{e.stopPropagation(); setAttachments(prev=>prev.filter(a=>a.id!==att.id));}} aria-label="Remove attachment">&times;</button>
            </div>
          ))}
        </div>
      )}

      <button 
        type="button" 
        className="icon-btn" 
        onClick={() => fileInput.current.click()} 
        disabled={disabled} 
        aria-label="Attach file"
      >
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
        disabled={disabled || !text.trim()}
        aria-label="Send message"
      >
        <i className="fas fa-paper-plane"></i>
      </button>
      <input type="file" ref={fileInput} style={{ display: 'none' }} aria-label="File input" multiple onChange={async (e)=>{
          const files = Array.from(e.target.files);
          const previews = await Promise.all(files.map(createFilePreview));
          setAttachments(prev => [...prev, ...previews]);
          e.target.value = '';
        }}/>
    </div>
  );
}