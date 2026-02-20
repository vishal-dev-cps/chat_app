import apiClient from './api';

// export async function filterRegularUsers(users, currentUser) {
//   console.log('[userFilters] Filtering users for regular user');

//   try {
//     console.log('[userFilters] Fetching chat users via new endpoint');

//     const chatUserResponse = await apiClient.get(
//       `/api/chat/users/by-user/${currentUser.id}`,
//       {
//         headers: {
//           'x-chat-internal-key':
//             '54OD6H0UIpwP9uYv2xGfMct7mdkSdwLQ9vUJYrI004WWl9kRPRiOGGY3QlzYK1JHdWcjq6xQrldZsfqvVuXf9JV3SKp61gx3uCcucZ86Xb5Su1kf',
//         },
//       }
//     );

//     const data = chatUserResponse.data;
//     console.log('[userFilters] API response:', data);

//     const baseUser = data.baseUser;
//     const admin = data.admin;
//     const superAdmin = data.superAdmin;
//     const sameSiteUsers = data.sameSiteUsers || [];

//     if (!baseUser?.assignedSites?.length) {
//       console.log('[userFilters] No assigned sites found for user');
//       // fallback: ALL users go in MAIN, none in OTHER
//       return {
//         mainUsers: users,
//         otherUsers: [],
//       };
//     }

//     // --- Format ADMIN ---
//     const formattedAdmin = admin
//       ? {
//           id: admin.id,
//           name: admin.name,
//           email: admin.email,
//           role: 'admin',
//           displayName: admin.name,
//           photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(
//             admin.name || 'A'
//           )}&background=random`,
//         }
//       : null;

//     // --- Format SUPERADMIN ---
//     const formattedSuperAdmin = superAdmin
//       ? {
//           id: superAdmin.id,
//           name: superAdmin.name,
//           email: superAdmin.email,
//           role: 'superAdmin',
//           displayName: superAdmin.name,
//           photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(
//             superAdmin.name || 'A'
//           )}&background=random`,
//         }
//       : null;

//     // --- Format SAME-SITE Personnel ---
//     const formattedSameSite = sameSiteUsers.map((p) => ({
//       id: p.id,
//       name: p.name,
//       email: p.email,
//       role: p.role,
//       siteIds: p.siteIds,
//       displayName: p.name,
//       photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(
//         p.name || 'U'
//       )}&background=random`,
//     }));

//     // ---- MAIN USERS (same-site + admin + superAdmin) ----
//     const mainUsers = [
//       ...(formattedSuperAdmin ? [formattedSuperAdmin] : []),
//       ...(formattedAdmin ? [formattedAdmin] : []),
//       ...formattedSameSite,
//     ];

//     // Remove duplicates
//     const mainIds = new Set(mainUsers.map((u) => u.id));

//     // ---- OTHER USERS (Everyone else BUT NOT removed) ----
//     const otherUsers = users.filter((u) => !mainIds.has(u.id));

//     console.log('[userFilters] mainUsers:', mainUsers);
//     console.log('[userFilters] otherUsers:', otherUsers);

//     return {
//       mainUsers,
//       otherUsers,
//     };
//   } catch (error) {
//     console.error('[userFilters] Error fetching filtered chat users:', error);

//     // fallback: don't break UI
//     return {
//       mainUsers: users,
//       otherUsers: [],
//     };
//   }
// }

export async function filterRegularUsers(users, currentUser) {
  console.log('[userFilters] Filtering users for regular user');

  try {
    const chatUserResponse = await apiClient.get(
      `/api/chat/users/by-user/${currentUser.id}`,
      {
        headers: {
          'x-chat-internal-key':
            '54OD6H0UIpwP9uYv2xGfMct7mdkSdwLQ9vUJYrI004WWl9kRPRiOGGY3QlzYK1JHdWcjq6xQrldZsfqvVuXf9JV3SKp61gx3uCcucZ86Xb5Su1kf',
        },
      }
    );

    const data = chatUserResponse.data;
    console.log('[userFilters] API response:', data);

    const admin = data.admin;
    const superAdmin = data.superAdmin;
    const sameSiteUsers = data.sameSiteUsers || [];

    // ---- FORMAT SUPERADMIN ----
    const formattedSuperAdmin = superAdmin
      ? {
          id: superAdmin.id,
          userId: superAdmin.id,
          name: superAdmin.name,
          email: superAdmin.email,
          role: 'superAdmin',
          displayName: superAdmin.name,
          __fromByUser: true,
          photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(
            superAdmin.name || 'A'
          )}&background=random`,
        }
      : null;

    // ---- FORMAT ADMIN ----
    const formattedAdmin = admin
      ? {
          id: admin.id,
          userId: admin.id,
          name: admin.name,
          email: admin.email,
          role: 'admin',
          displayName: admin.name,
          __fromByUser: true,
          photoURL: admin.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(
            admin.name || 'A'
          )}&background=random`,
        }
      : null;

    // ---- FORMAT SAME SITE USERS ----
    const formattedSameSite = sameSiteUsers.map((p) => ({
      id: p.id,
      userId: p.id,
      name: p.name,
      email: p.email,
      role: p.role, // keep backend role
      siteIds: p.siteIds,
      status: p.status || 'offline',
      displayName: p.name,
      photoURL: p.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(
        p.name || 'U'
      )}&background=random`,
    }));

    // ✅ MAIN USERS = EXACT BACKEND RESPONSE
    const mainUsers = [
      ...(formattedSuperAdmin ? [formattedSuperAdmin] : []),
      ...(formattedAdmin ? [formattedAdmin] : []),
      ...formattedSameSite,
    ];

    return {
      mainUsers,
      otherUsers: [], // ✅ IMPORTANT: NO EXTRA USERS
    };
  } catch (error) {
    console.error('[userFilters] Error fetching filtered chat users:', error);

    return {
      mainUsers: [],
      otherUsers: [],
    };
  }
}


// OLD one with filters
// import apiClient from './api';

// export async function filterRegularUsers(users, currentUser) {
//   console.log('[userFilters] Filtering users for regular user');

//   try {
//     console.log('[userFilters] Fetching chat users via new endpoint');

//     const chatUserResponse = await apiClient.get(
//       `/api/chat/users/by-user/${currentUser.id}`,
//       {
//         headers: {
//           'x-chat-internal-key': "54OD6H0UIpwP9uYv2xGfMct7mdkSdwLQ9vUJYrI004WWl9kRPRiOGGY3QlzYK1JHdWcjq6xQrldZsfqvVuXf9JV3SKp61gx3uCcucZ86Xb5Su1kf"
//         }
//       }
//     );
//     const data = chatUserResponse.data;

//     console.log('[userFilters] API response:', data);

//     const baseUser = data.baseUser;
//     const admin = data.admin;
//     const superAdmin = data.superAdmin;
//     const sameSiteUsers = data.sameSiteUsers || [];

//     if (!baseUser?.assignedSites?.length) {
//       console.log('[userFilters] No assigned sites found for user');
//       return users;
//     }

//     const siteAdminInfo = admin
//       ? {
//         id: admin.id,
//         name: admin.name,
//         email: admin.email,
//         role: 'admin',
//         displayName: admin.name,
//         photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(admin.name || 'A')}&background=random`
//       }
//       : null;

//     const formattedSuperAdmin = superAdmin
//       ? {
//         id: superAdmin.id,
//         name: superAdmin.name,
//         email: superAdmin.email,
//         role: 'superAdmin',
//         displayName: superAdmin.name,
//         photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(superAdmin.name || 'A')}&background=random`
//       }
//       : null;

//     const formattedSitePersonnel = sameSiteUsers.map(p => ({
//       id: p.id,
//       name: p.name,
//       email: p.email,
//       role: p.role,
//       siteIds: p.siteIds,
//       displayName: p.name,
//       photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || 'U')}&background=random`
//     }));

//     const filteredUsers = [
//       ...(formattedSuperAdmin ? [formattedSuperAdmin] : []),
//       ...(siteAdminInfo ? [siteAdminInfo] : []),
//       ...formattedSitePersonnel
//     ];

//     console.log('[userFilters] Filtered users list prepared:', filteredUsers);

//     const uniqueUsersMap = new Map();
//     filteredUsers.forEach(user => {
//       uniqueUsersMap.set(user.id, user);
//     });

//     return Array.from(uniqueUsersMap.values());

//   } catch (error) {
//     console.error('[userFilters] Error fetching filtered chat users:', error);
//     return users;
//   }
// }
