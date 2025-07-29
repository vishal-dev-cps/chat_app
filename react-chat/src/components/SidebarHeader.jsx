import { useState, useEffect } from 'react';
import api from '../services/api';

export default function SidebarHeader({ onSearch, currentUser }) {
  const [query, setQuery] = useState('');
  const [userDetails, setUserDetails] = useState(null);
  
  // Get securityId from URL
  const getSecurityIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('securityId');
  };
  
  const securityId = getSecurityIdFromUrl();

  useEffect(() => {
    console.log('useEffect triggered, securityId:', securityId);
    
    const fetchUserDetails = async () => {
      if (!securityId) {
        console.log('No securityId found in URL');
        return;
      }

      console.log('fetchUserDetails called with securityId:', securityId);
      try {
        console.log('Making API call to /api/chat/user/' + securityId);
        const response = await api.get(`/api/chat/user/${securityId}`);
        console.log('API response:', response);
        
        if (response.data?.success) {
          console.log('Setting user details:', response.data.user);
          setUserDetails(response.data.user);
        } else {
          console.log('API call was not successful:', response.data);
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
      }
    };

    fetchUserDetails();
  }, [currentUser]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onSearch?.(val);
  };

  return (
    <>
      <div className="sidebar-header">
        <div className="d-flex align-items-center gap-2">
          {(() => {
            const name = userDetails?.name || currentUser?.displayName || 'Me';
            const initials = name.split(' ').slice(0,2).map(s=>s[0].toUpperCase()).join('');
            const avatar = userDetails?.photoURL || currentUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
            return (
              <img
                src={avatar}
                alt={name}
                className="user-avatar-sm"
                onError={(e)=>{
                  e.target.onerror=null;
                  e.target.src=`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
                }}
              />
            );
          })()}
          <span className="title">{userDetails?.name || currentUser?.displayName || 'Me'}</span>
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
