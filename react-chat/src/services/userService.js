import apiClient from './api';
import { filterRegularUsers } from './userFilters';

/**
 * Fetch site personnel for the current security user.
 * Mirrors legacy chat.js logic but kept pure (no globals).
 */
async function fetchSitePersonnel(currentUser) {
  try {
    const personnelResponse = await apiClient.get('/api/security/personnel/internal');
    if (!personnelResponse.data.success) return [];

    const personnel = personnelResponse.data.personnel || [];
    const matchingPersonnel = personnel.find(
      (p) => p.id === currentUser?.userId || p.id === currentUser?.id
    );
    if (!matchingPersonnel || !matchingPersonnel.assignedSites?.length) return [];

    const sitePersonnel = [];
    for (const site of matchingPersonnel.assignedSites) {
      try {
        const siteResp = await apiClient.get(`/api/security/sites/${site.siteId}/personnel`);
        if (siteResp.data.success) {
          (siteResp.data.personnel || []).forEach((person) => {
            if (!sitePersonnel.find((p) => p.id === person.id)) {
              sitePersonnel.push({
                ...person,
                siteId: site.siteId,
                role: 'security',
                status: person.status || 'offline',
                unreadCount: 0,
                displayName:
                  person.name || person.email || `Security ${person.id.substring(0, 4)}`,
                photoURL:
                  person.photoURL ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    person.name || 'S'
                  )}&background=random`,
              });
            }
          });
        }
      } catch {
        /* continue */
      }
    }
    return sitePersonnel;
  } catch {
    return [];
  }
}

/**
 * Load users combining chat users, security users and role-based filtering.
 * Returns an array of user objects ready for UI.
 */
export async function loadUsers(currentUser) {
  const roleLower = (currentUser?.role || '').toLowerCase();
  console.log('[userService] loadUsers for role:', roleLower);

  console.log('[userService] currentUser', currentUser);
  // 1. chat users from API
  console.log('[userService] Loading chat users...');
  const chatUsersResp = await apiClient.get('/api/chat/users');
  console.log('[userService] /api/chat/users response', chatUsersResp.data);
  const chatUsers = (chatUsersResp.data?.data || []).map((u) => ({
    ...u,
    userId: u.userId || u.id,
    displayName: u.displayName || u.name || u.email || 'User',
    photoURL:
      u.photoURL ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || u.name || 'U')}&background=random`,
  }));

    // 2. fetch ALL personnel (security) for everyone
  const allPersonnelResp = await apiClient.get('/api/security/personnel/internal');
  let securityUsers = [];
  if (allPersonnelResp.data.success) {
    securityUsers = (allPersonnelResp.data.personnel || []).map((p) => ({
      ...p,
      userId: p.id,
      role: 'security',
      displayName: p.displayName || p.name || p.email || 'Security',
      photoURL: p.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent((p.displayName||p.name||'S'))}&background=random`,

    }));
  }
  console.log('[userService] securityUsers(all)', securityUsers);

  let additionalPersonnel = [];

  // merge unique by userId
  const mergedById = new Map();
  [...securityUsers, ...additionalPersonnel, ...chatUsers].forEach((u) => {
    mergedById.set(u.userId || u.id, u);
  });
  let users = Array.from(mergedById.values());
  console.log('[userService] merged users', users);

  // ----- SECTION: SUPERADMIN -----
  if (roleLower === 'superadmin') {
    users = users.filter((u) => ['admin', 'security', 'superAdmin'].includes(u.role));
  }
  // ----- SECTION: ADMIN -----
  else if (roleLower === 'admins') { 
    try {
      // Fetch admin's sites
      const adminSitesResponse = await apiClient.get(`/api/security/sites/admin/${currentUser.id}`);
      const siteIds = adminSitesResponse.data?.sites?.map(site => site.id) || [];
      console.log('[userService] Admin sites:', siteIds);
      
      // Fetch personnel for each site
      const allPersonnel = [];
      for (const siteId of siteIds) {
        try {
          const personnelResponse = await apiClient.get(`/api/security/sites/${siteId}/personnel`);
          const sitePersonnel = personnelResponse.data?.personnel || [];
          console.log(`[userService] Personnel for site ${siteId}:`, sitePersonnel);
          allPersonnel.push(...sitePersonnel);
        } catch (personnelError) {
          console.error(`[userService] Error fetching personnel for site ${siteId}:`, personnelError);
        }
      }
      
      console.log('[userService] All personnel across sites:', allPersonnel);
      
      // Get unique personnel IDs from all sites
      const personnelIds = [...new Set(allPersonnel.map(p => p.id))];
      
      // Filter users to include:
      // 1. Superadmins
      // 2. The current admin
      // 3. Personnel from the admin's sites
      users = users.filter(u => 
        u.role === 'superAdmin' || 
        u.id === currentUser.id || 
        personnelIds.includes(u.id)
      );
      
      console.log('[userService] Filtered users for admin:', users);
    } catch (error) {
      console.error('[userService] Error in admin section:', error);
      // Fallback to original filter if API call fails
      users = users.filter((u) => ['admin', 'security', 'superAdmin'].includes(u.role));
    }
  }
  // ----- SECTION: REGULAR USER (ELSE) -----
  else {
    console.log('[userService] Regular user logged in - applying filters');
    users = await filterRegularUsers(users, currentUser);
    console.log('[userService] Combined users for regular user:', users);
  }

  // exclude self
  users = users.filter((u) => (u.userId || u.id) !== (currentUser.userId || currentUser.id));

  // Define role priority (higher number = higher priority)
  const rolePriority = {
    'superAdmin': 3,
    'admin': 2,
    'security': 1,
    '': 0
  };

  // Sort by role (superAdmin > admin > security), then online status, then name
  users.sort((a, b) => {
    // First sort by role priority (descending)
    const roleDiff = (rolePriority[b.role] || 0) - (rolePriority[a.role] || 0);
    if (roleDiff !== 0) return roleDiff;
    
    // If same role, sort by online status (online first)
    if (a.status === 'online' && b.status !== 'online') return -1;
    if (a.status !== 'online' && b.status === 'online') return 1;
    
    // If same status, sort by name
    return (a.displayName || '').localeCompare(b.displayName || '');
  });

  return users;
}
