import apiClient from './api';

// Fetch messages for a group
export async function fetchGroupMessages(groupId) {
  const res = await apiClient.get(`/api/groups/${groupId}/messages`);
  return res.data?.messages || [];
}

// Send a message to a group
export async function sendGroupMessage(groupId, { from, text, attachments = [] }) {
  const res = await apiClient.post(`/api/groups/${groupId}/messages`, {
    from,
    text,
    attachments,
  });
  return res.data;
}

export default { fetchGroupMessages, sendGroupMessage };
