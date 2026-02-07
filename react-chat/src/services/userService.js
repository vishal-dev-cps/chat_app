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

  // ---- 1. LOAD CHAT USERS ----
  const chatUsersResp = await apiClient.get('/api/chat/users');
  const chatUsers = (chatUsersResp.data?.data || []).map((u) => ({
    ...u,
    userId: u.userId || u.id,
    displayName: u.displayName || u.name || u.email || 'User',
    photoURL:
      u.photoURL ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        u.displayName || u.name || 'U'
      )}&background=random`,
  }));

  // ---- 2. LOAD SECURITY PERSONNEL (ALL) ----
  const allPersonnelResp = await apiClient.get('/api/security/personnel/internal');
  let securityUsers = [];

  if (allPersonnelResp.data.success) {
    securityUsers = (allPersonnelResp.data.personnel || []).map((p) => ({
      ...p,
      userId: p.id,
      role: 'security',
      displayName: p.name || p.email || `Security ${p.id.slice(0, 4)}`,
      photoURL:
        p.photoURL ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          p.name || 'S'
        )}&background=random`,
    }));
  }

  // ---- 3. MERGE USERS WITHOUT LOSING ROLES ----
  const mergedById = new Map();

  const rolePriority = {
    superAdmin: 3,
    admin: 2,
    security: 1,
    user: 0,
    '': 0,
    null: 0,
  };

  function mergeUser(u) {
    const id = u.userId || u.id;
    const existing = mergedById.get(id);

    if (!existing) {
      mergedById.set(id, u);
      return;
    }

    // ✅ DO NOT override admin/superAdmin coming from by-user endpoint
    if (existing.__fromByUser) {
      return;
    }

    const newRole = rolePriority[u.role] || 0;
    const oldRole = rolePriority[existing.role] || 0;

    if (newRole > oldRole) {
      mergedById.set(id, u);
    }
  }

  [...chatUsers, ...securityUsers].forEach(mergeUser);

  let users = Array.from(mergedById.values());

  // ---- 4. SUPERADMIN ACCESS (unchanged) ----
  if (roleLower === 'superadmin') {
    users = users.filter((u) =>
      ['security', 'admin', 'superAdmin'].includes(u.role)
    );
  }

  // ---- 5. ADMIN ACCESS (unchanged) ----
  else if (roleLower === 'admin' || roleLower === 'admins') {
    try {
      const resp = await apiClient.get(
        `/api/security/personnel/by-admin/${currentUser.id}`,
        {
          headers: {
            'x-chat-internal-key':
              '54OD6H0UIpwP9uYv2xGfMct7mdkSdwLQ9vUJYrI004WWl9kRPRiOGGY3QlzYK1JHdWcjq6xQrldZsfqvVuXf9JV3SKp61gx3uCcucZ86Xb5Su1kf',
          },
        }
      );

      const superAdmins = resp.data?.superAdmin || [];
      const personnel = resp.data?.personnel || [];

      // ---- FORMAT SUPER ADMIN (FROM ADMIN API) ----
      superAdmins.forEach((sa) => {
        mergeUser({
          id: sa.id,
          userId: sa.id,
          role: 'superAdmin',
          displayName: sa.name,
          email: sa.email,
          status: sa.status || 'offline',
          photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(
            sa.name || 'SA'
          )}&background=random`,
        });
      });

      // ---- FORMAT PERSONNEL (SECURITY USERS) ----
      const formattedPersonnel = personnel.map((p) => ({
        ...p,
        userId: p.id,
        role: 'security',
        displayName: p.name || p.email || `Security ${p.id.slice(0, 4)}`,
        photoURL:
          p.photoURL ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(
            p.name || 'S'
          )}&background=random`,
        status: p.status || 'offline',
      }));

      formattedPersonnel.forEach(mergeUser);

      users = Array.from(mergedById.values());

      // ✅ Admin sees ONLY superAdmin + personnel
      users = users.filter((u) =>
        ['security', 'superAdmin'].includes(u.role)
      );
    } catch (error) {
      console.error('[userService] Error loading admin personnel:', error);
    }
  }

  // ---- 6. REGULAR USER ACCESS ----
  else {
    const { mainUsers, otherUsers } = await filterRegularUsers(users, currentUser);
    users = [...mainUsers, ...otherUsers];
  }

  // ---- 7. REMOVE SELF ----
  users = users.filter(
    (u) => (u.userId || u.id) !== (currentUser.userId || currentUser.id)
  );

  // ---- 8. SORT USERS (unchanged) ----
  users.sort((a, b) => {
    const roleDiff = (rolePriority[b.role] || 0) - (rolePriority[a.role] || 0);
    if (roleDiff !== 0) return roleDiff;

    if (a.status === 'online' && b.status !== 'online') return -1;
    if (a.status !== 'online' && b.status === 'online') return 1;

    return (a.displayName || '').localeCompare(b.displayName || '');
  });

  return users;
}
