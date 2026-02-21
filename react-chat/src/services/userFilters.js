import apiClient from './api';

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

