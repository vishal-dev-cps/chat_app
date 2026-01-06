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

  console.log('[userService] securityUsers(all)', securityUsers);

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

    // Keep highest priority role
    const newRole = rolePriority[u.role] || 0;
    const oldRole = rolePriority[existing.role] || 0;

    if (newRole > oldRole) {
      mergedById.set(id, u);
    }
  }

  [...chatUsers, ...securityUsers].forEach(mergeUser);

  let users = Array.from(mergedById.values());
  console.log('[userService] merged users', users);

  // ---- 4. SUPERADMIN ACCESS ----
  if (roleLower === 'superadmin') {
    users = users.filter((u) => ['security', 'admin', 'superAdmin'].includes(u.role));
  }

  // ---- 5. ADMIN ACCESS ----
  else if (roleLower === 'admin' || roleLower === 'admins') {
    try {
      console.log('[userService] Fetching personnel via new admin endpoint');

      const resp = await apiClient.get(
        `/api/security/personnel/by-admin/${currentUser.id}`,
        {
          headers: {
            'x-chat-internal-key':
              '54OD6H0UIpwP9uYv2xGfMct7mdkSdwLQ9vUJYrI004WWl9kRPRiOGGY3QlzYK1JHdWcjq6xQrldZsfqvVuXf9JV3SKp61gx3uCcucZ86Xb5Su1kf',
          },
        }
      );

      const personnel = resp.data?.personnel || [];
      console.log('[userService] Admin personnel:', personnel);

      // Map personnel with proper formatting
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

      // Merge again (preserve highest priority)
      formattedPersonnel.forEach(mergeUser);
      users = Array.from(mergedById.values());

      // Admin sees ALL admins + ALL superadmins + ALL security
      users = users.filter((u) =>
        ['security', 'admin', 'superAdmin'].includes(u.role)
      );

    } catch (error) {
      console.error('[userService] Error loading admin personnel:', error);
      users = users.filter((u) =>
        ['security', 'admin', 'superAdmin'].includes(u.role)
      );
    }
  }

  // ---- 6. REGULAR USER ACCESS ----
  else {
    console.log('[userService] Regular user logged in - applying filters');

    // Get filtered grouping
    const { mainUsers, otherUsers } = await filterRegularUsers(users, currentUser);

    // Keep all users but ordered by relevance
    users = [...mainUsers, ...otherUsers];
  }

  // ---- 7. REMOVE SELF ----
  users = users.filter(
    (u) => (u.userId || u.id) !== (currentUser.userId || currentUser.id)
  );

  // ---- 8. SORT USERS (role > status > name) ----
  users.sort((a, b) => {
    const roleDiff = (rolePriority[b.role] || 0) - (rolePriority[a.role] || 0);
    if (roleDiff !== 0) return roleDiff;

    if (a.status === 'online' && b.status !== 'online') return -1;
    if (a.status !== 'online' && b.status === 'online') return 1;

    return (a.displayName || '').localeCompare(b.displayName || '');
  });

  return users;
}

// Old code with filters
// import apiClient from './api';
// import { filterRegularUsers } from './userFilters';

// /**
//  * Fetch site personnel for the current security user.
//  * Mirrors legacy chat.js logic but kept pure (no globals).
//  */
// async function fetchSitePersonnel(currentUser) {
//   try {
//     const personnelResponse = await apiClient.get('/api/security/personnel/internal');
//     if (!personnelResponse.data.success) return [];

//     const personnel = personnelResponse.data.personnel || [];
//     const matchingPersonnel = personnel.find(
//       (p) => p.id === currentUser?.userId || p.id === currentUser?.id
//     );
//     if (!matchingPersonnel || !matchingPersonnel.assignedSites?.length) return [];

//     const sitePersonnel = [];
//     for (const site of matchingPersonnel.assignedSites) {
//       try {
//         const siteResp = await apiClient.get(`/api/security/sites/${site.siteId}/personnel`);
//         if (siteResp.data.success) {
//           (siteResp.data.personnel || []).forEach((person) => {
//             if (!sitePersonnel.find((p) => p.id === person.id)) {
//               sitePersonnel.push({
//                 ...person,
//                 siteId: site.siteId,
//                 role: 'security',
//                 status: person.status || 'offline',
//                 unreadCount: 0,
//                 displayName:
//                   person.name || person.email || `Security ${person.id.substring(0, 4)}`,
//                 photoURL:
//                   person.photoURL ||
//                   `https://ui-avatars.com/api/?name=${encodeURIComponent(
//                     person.name || 'S'
//                   )}&background=random`,
//               });
//             }
//           });
//         }
//       } catch {
//         /* continue */
//       }
//     }
//     return sitePersonnel;
//   } catch {
//     return [];
//   }
// }

// /**
//  * Load users combining chat users, security users and role-based filtering.
//  * Returns an array of user objects ready for UI.
//  */
// export async function loadUsers(currentUser) {
//   const roleLower = (currentUser?.role || '').toLowerCase();
//   console.log('[userService] loadUsers for role:', roleLower);

//   console.log('[userService] currentUser', currentUser);
//   // 1. chat users from API
//   console.log('[userService] Loading chat users...');
//   const chatUsersResp = await apiClient.get('/api/chat/users');
//   console.log('[userService] /api/chat/users response', chatUsersResp.data);
//   const chatUsers = (chatUsersResp.data?.data || []).map((u) => ({
//     ...u,
//     userId: u.userId || u.id,
//     displayName: u.displayName || u.name || u.email || 'User',
//     photoURL:
//       u.photoURL ||
//       `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || u.name || 'U')}&background=random`,
//   }));

//   // 2. fetch ALL personnel (security) for everyone
//   const allPersonnelResp = await apiClient.get('/api/security/personnel/internal');
//   let securityUsers = [];
//   if (allPersonnelResp.data.success) {
//     securityUsers = (allPersonnelResp.data.personnel || []).map((p) => ({
//       ...p,
//       userId: p.id,
//       role: 'security',
//       displayName: p.displayName || p.name || p.email || 'Security',
//       photoURL: p.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent((p.displayName || p.name || 'S'))}&background=random`,

//     }));
//   }
//   console.log('[userService] securityUsers(all)', securityUsers);

//   let additionalPersonnel = [];

//   // merge unique by userId
//   const mergedById = new Map();
//   [...securityUsers, ...additionalPersonnel, ...chatUsers].forEach((u) => {
//     mergedById.set(u.userId || u.id, u);
//   });
//   let users = Array.from(mergedById.values());
//   console.log('[userService] merged users', users);

//   // ----- SECTION: SUPERADMIN -----
//   if (roleLower === 'superadmin') {
//     users = users.filter((u) => ['admin', 'security', 'superAdmin'].includes(u.role));
//   }
//   // ----- SECTION: ADMIN -----
//   else if (roleLower === 'admins' || roleLower === 'admin') {
//     try {
//       console.log('[userService] Fetching personnel via new admin endpoint');

//       const resp = await apiClient.get(
//         `/api/security/personnel/by-admin/${currentUser.id}`,
//         { headers: { "x-chat-internal-key": "54OD6H0UIpwP9uYv2xGfMct7mdkSdwLQ9vUJYrI004WWl9kRPRiOGGY3QlzYK1JHdWcjq6xQrldZsfqvVuXf9JV3SKp61gx3uCcucZ86Xb5Su1kf" } }
//       );

//       const personnel = resp.data?.personnel || [];
//       console.log("[userService] Admin personnel:", personnel);

//       const formattedPersonnel = personnel.map(p => ({
//         ...p,
//         userId: p.id,
//         role: 'security',                                       // ✅ keep role as security
//         displayName: p.name || p.email || `Security ${p.id.slice(0, 4)}`,
//         photoURL: p.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || 'S')}&background=random`,
//         status: p.status || 'offline'
//       }));

//       // Merge personnel + other chat users
//       const mergedById = new Map();
//       [...securityUsers, ...formattedPersonnel, ...chatUsers].forEach(u => {
//         mergedById.set(u.userId || u.id, u);
//       });

//       users = Array.from(mergedById.values());

//       // Filter: SuperAdmins + current admin + only admin site personnel
//       users = users.filter(u =>
//         u.role === 'superAdmin' ||
//         u.id === currentUser.id ||
//         formattedPersonnel.some(fp => fp.id === u.id)
//       );

//       console.log('[userService] Filtered users for admin:', users);

//     } catch (error) {
//       console.error('[userService] Error loading admin personnel:', error);
//       users = users.filter(u => ['admin', 'security', 'superAdmin'].includes(u.role));
//     }
//   }

//   // ----- SECTION: REGULAR USER (ELSE) -----
//   else {
//     console.log('[userService] Regular user logged in - applying filters');
//     users = await filterRegularUsers(users, currentUser);
//     console.log('[userService] Combined users for regular user:', users);
//   }

//   // exclude self
//   users = users.filter((u) => (u.userId || u.id) !== (currentUser.userId || currentUser.id));

//   // Define role priority (higher number = higher priority)
//   const rolePriority = {
//     'superAdmin': 3,
//     'admin': 2,
//     'security': 1,
//     '': 0
//   };

//   // Sort by role (superAdmin > admin > security), then online status, then name
//   users.sort((a, b) => {
//     // First sort by role priority (descending)
//     const roleDiff = (rolePriority[b.role] || 0) - (rolePriority[a.role] || 0);
//     if (roleDiff !== 0) return roleDiff;

//     // If same role, sort by online status (online first)
//     if (a.status === 'online' && b.status !== 'online') return -1;
//     if (a.status !== 'online' && b.status === 'online') return 1;

//     // If same status, sort by name
//     return (a.displayName || '').localeCompare(b.displayName || '');
//   });

//   return users;
// }
