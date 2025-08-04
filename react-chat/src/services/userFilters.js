// userFilters.js
import apiClient from './api';

/**
 * Filters users for regular users to show only superadmins, site admin, and site personnel
 * @param {Array} users - Original users array
 * @param {Object} currentUser - Current logged in user
 * @returns {Promise<Array>} - Filtered users array
 */
export async function filterRegularUsers(users, currentUser) {
  console.log('[userFilters] Filtering users for regular user');
  try {
    const personnelResponse = await apiClient.get(`/api/security/personnel/${currentUser.id}`);
    console.log('[userFilters] Personnel details response:', personnelResponse.data.personnel);
    
    const siteId = personnelResponse.data?.personnel?.assignedSiteId || 
                 personnelResponse.data?.personnel?.assignedSite?.id;
    
    if (!siteId) {
      console.log('[userFilters] No site ID found in personnel details');
      return users;
    }

    console.log('[userFilters] Fetching personnel for site ID:', siteId);
    try {
      // 1. Get site personnel
      const sitePersonnelResponse = await apiClient.get(`/api/security/sites/${siteId}/personnel`);
      const sitePersonnel = sitePersonnelResponse.data?.personnel || [];
      console.log('[userFilters] Site personnel response:', sitePersonnel);
      
      // 2. Get site admin details
      const siteDetailsResponse = await apiClient.get(`/api/security/sites/${siteId}/internal`);
      const createdByAdmin = siteDetailsResponse.data?.site?.createdByAdmin;
      
      if (!createdByAdmin) {
        console.log('[userFilters] No createdByAdmin found in site details');
        return users;
      }

      console.log('[userFilters] Site admin details:', createdByAdmin);
      const siteAdminInfo = {
        id: createdByAdmin.id,
        name: createdByAdmin.name,
        email: createdByAdmin.email,
        role: 'admin',
        displayName: createdByAdmin.name,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(createdByAdmin.name || 'A')}&background=random`
      };
      
      // 3. Create filtered users array
      const sitePersonnelIds = new Set(sitePersonnel.map(p => p.id));
      const superAdmins = users.filter(u => u.role === 'superAdmin');
      
      const filteredUsers = [
        ...superAdmins,  // Include all superadmins
        siteAdminInfo,   // Include the site admin
        ...users.filter(u => sitePersonnelIds.has(u.id))  // Include site personnel
      ];
      
      console.log('[userFilters] Filtered users (superadmins, site admin, and personnel):', filteredUsers);
      
      // Remove duplicates by ID
      const uniqueUsersMap = new Map();
      filteredUsers.forEach(user => {
        uniqueUsersMap.set(user.id, user);
      });
      
      return Array.from(uniqueUsersMap.values());
      
    } catch (error) {
      console.error('[userFilters] Error fetching site data:', error);
      return users;
    }

  } catch (error) {
    console.error('[userFilters] Error fetching user personnel details:', error);
    return users;
  }
}