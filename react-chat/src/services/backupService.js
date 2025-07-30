// backupService.js
// Handles posting chat backups to backend API

const BACKUP_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/chat/message`;

/**
 * Send messages array to backup endpoint.
 * @param {Array<Object>} messages - array of message objects already in API schema
 * @returns {Promise<any>} response json
 */
export async function backupMessages(messages) {
  const body = { messages };
  const res = await fetch(BACKUP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Backup failed: ${res.status} ${err}`);
  }
  return res.json();
}

export default { backupMessages };
