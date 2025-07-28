import { useState } from 'react';

export default function SidebarHeader({ onSearch, currentUser }) {
  const [query, setQuery] = useState('');

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onSearch && onSearch(val);
  };

  return (
    <>
      <div className="sidebar-header">
        <div className="d-flex align-items-center gap-2">
          {(() => {
            const initials=(currentUser?.displayName||'U').split(' ').slice(0,2).map(s=>s[0].toUpperCase()).join('');
            const avatar=currentUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random`;
            return (
              <img
                src={avatar}
                alt={currentUser?.displayName}
                className="user-avatar-sm"
                onError={(e)=>{
                  e.target.onerror=null;
                  e.target.src=`https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random`;
                }}
              />
            );
          })()}
          <span className="title">{currentUser?.displayName||'Me'}</span>
        </div>
        <div className="icons d-flex gap-3">
          <i className="fas fa-pen"></i>
          <i className="fas fa-ellipsis-v"></i>
        </div>
      </div>
      <div className="sidebar-search">
        <div className="input-group">
          <span className="input-group-text bg-transparent border-0"><i className="fas fa-search"></i></span>
          <input
            type="text"
            className="form-control border-0"
            placeholder="Search or start a new chat"
            value={query}
            onChange={handleChange}
          />
        </div>
      </div>
    </>
  );
}
