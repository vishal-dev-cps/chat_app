
//const BACKUP_URL = 'https://us-central1-securityerp.cloudfunctions.net/api/chat/conversations';
const BACKUP_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/chat/conversations`;

export async function backupAllChats() {
  try {
    const currentUserId = localStorage.getItem('current_user_id');
    if (!currentUserId) return;

    const conversations = [];

    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('chat_')) {
        const messages = JSON.parse(localStorage.getItem(key) || '[]');

        if (Array.isArray(messages) && messages.length > 0) {
          conversations.push({
            chatKey: key,
            messages
          });
        }
      }
    });

    if (conversations.length === 0) return;

    await fetch(
      `${BACKUP_URL}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId,
          conversations
        })
      }
    );

  } catch (error) {
    console.error('Backup failed:', error);
  }
}

export async function restoreChatsIfEmpty(userId) {
  try {
    if (!userId) return;

    // 🔍 Check if any chat_ key exists in localStorage
    const hasLocalChats = Object.keys(localStorage).some(key =>
      key.startsWith('chat_')
    );

    if (hasLocalChats) {
      console.log('[RESTORE] Local chats found. Skipping restore.');
      return;
    }


    const response = await fetch(
      `${BACKUP_URL}/user/${userId}`
    );

    const data = await response.json();

    if (!data.success || !data.conversations) {
      console.log('[RESTORE] No backup found.');
      return;
    }

    // Save each conversation into localStorage
    data.conversations.forEach(convo => {
      if (convo.chatKey && Array.isArray(convo.messages)) {
        localStorage.setItem(
          convo.chatKey,
          JSON.stringify(convo.messages)
        );
      }
    });


  } catch (error) {
    console.error('[RESTORE] Failed to restore chats:', error);
  }
}


export default { backupAllChats };
