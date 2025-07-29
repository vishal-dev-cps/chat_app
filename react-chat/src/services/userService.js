import apiClient from './api';

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

  // role filter for superAdmin
  if (currentUser?.role === 'superAdmin') {
    users = users.filter((u) => ['admin', 'security', 'superAdmin'].includes(u.role));
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
