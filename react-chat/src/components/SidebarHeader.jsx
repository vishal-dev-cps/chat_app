import { useState, useEffect } from 'react';
import CreateGroupModal from './CreateGroupModal';
import { createGroup as apiCreateGroup } from '../services/groupService';
import api from '../services/api';
import { backupAllChats } from '../services/backupService';

export default function SidebarHeader({ users = [], onSearch, currentUser, currentUserId, onGroupCreated }) {
  const [query, setQuery] = useState('');
  const [userDetails, setUserDetails] = useState(null);
  const [setSitePersonnel] = useState([]);
  const [setSiteAdmin] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  // When user details are available and role is not admin/superadmin, fetch site data
  useEffect(() => {
    const loadSiteInfo = async () => {
      const roleRaw = (userDetails?.role || '').toLowerCase();
      if (!userDetails || roleRaw === 'superadmin' || roleRaw === 'superadmins' || roleRaw === 'admin' || roleRaw === 'admins') {
        return; // only run for non-admin users
      }
      const siteId = userDetails?.assignedSites?.[0]?.siteId;
      console.log('[SidebarHeader] Derived siteId:',);
      if (!siteId) return;
      try {
        // fetch site details to get admin
        const siteRes = await api.get(`/api/security/sites/${siteId}`);
        if (siteRes.data?.success) {
          const adminObj = siteRes.data.site?.createdByAdmin;
          setSiteAdmin(adminObj);
        }
        // fetch personnel of site
        const personnelRes = await api.get(`/api/security/sites/${siteId}/personnel`);
        console.log('[SidebarHeader] Personnel API response:', personnelRes.data);
        if (personnelRes.data?.success) {
          setSitePersonnel(personnelRes.data.personnel || []);
        }
      } catch (err) {
        console.error('Error fetching site info/personnel:', err);
      }
    };
    loadSiteInfo();
  }, [userDetails]);

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
            // Persist my display name for other components (e.g. group chat) to retrieve
            try {
              localStorage.setItem('current_user_name', name);
            } catch {/* ignore quota */ }
            const avatar = userDetails?.photoURL || currentUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
            return (
              <img
                src={avatar}
                alt={name}
                className="user-avatar-sm"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
                }}
              />
            );
          })()}
          <span className="title">{userDetails?.name || currentUser?.displayName || 'Me'}</span>
        </div>
        <div className="icons d-flex gap-3">
          <button
            type="button"
            className="btn btn-sm btn-outline-success"
            title="Backup All Chats"
            onClick={async () => {
              try {
                await backupAllChats();
                alert('All chats backed up successfully ✅');
              } catch (e) {
                alert('Backup failed ❌',e);
              }
            }}
          >
            <i className="fas fa-cloud-upload-alt"></i>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            title="Create Group"
            onClick={() => setShowCreateModal(true)}
          >
            <i className="fas fa-users"></i>
          </button>
          {/* <i className="fas fa-pen"></i>
          <i className="fas fa-ellipsis-v"></i> */}
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
      <CreateGroupModal
        currentUserId={currentUserId}
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        users={users}
        onCreate={async (payload) => {
          await apiCreateGroup(payload);
          onGroupCreated?.();
        }}
      />
    </>
  );
}
