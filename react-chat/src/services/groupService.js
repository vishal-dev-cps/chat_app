import apiClient from './api';

// Group Service: handles CRUD operations for chat groups without touching existing chatService.

/**
 * Create a new group.
 * @param {Object} options
 * @param {string} options.name - Group name
 * @param {Array<string>} options.members - Array of user IDs (must include at least two)
 * @param {string} options.createdBy - ID of the user who created the group
 */
export async function createGroup({ name, members, createdBy }) {
  if (!name || !Array.isArray(members) || members.length < 2) {
    throw new Error('Group name and at least two members are required');
  }
  const res = await apiClient.post('/api/groups', {
    name,
    members,
    createdBy,
  });
  return res.data;
}

/**
 * Fetch list of groups visible to current user
 */
export async function fetchGroups() {
  try {
    console.log('Fetching groups from API...');
    const res = await apiClient.get('/api/groups');
    console.log('API Response:', res);
    console.log('Groups data:', res.data);

    return res.data || [];
  } catch (error) {
    console.error('Error fetching groups:', error);
    console.error('Error response:', error.response);
    return [];
  }
}

export async function updateGroup(id, updateFields = {}, userId) {
  if (!id) throw new Error('Group id is required');
  try {
    const payload = userId ? { userId, ...updateFields } : updateFields;
  const res = await apiClient.patch(`/api/groups/${id}`, payload);
    return res.data;
  } catch (error) {
    console.error('Error updating group:', error);
    throw error;
  }
}

export default { createGroup, fetchGroups, updateGroup };
