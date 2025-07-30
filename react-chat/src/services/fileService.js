import axios from 'axios';

// Upload file to server
export const uploadFile = async (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post('/api/chat/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// Get file icon class based on MIME type
export const getFileIcon = (mimeType, fileName = '') => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (mimeType.includes('image/')) return 'far fa-file-image';
  if (mimeType.includes('pdf')) return 'far fa-file-pdf';
  if (mimeType.includes('word') || ['doc', 'docx'].includes(extension)) return 'far fa-file-word';
  if (mimeType.includes('excel') || ['xls', 'xlsx'].includes(extension)) return 'far fa-file-excel';
  if (mimeType.includes('powerpoint') || ['ppt', 'pptx'].includes(extension)) return 'far fa-file-powerpoint';
  if (mimeType.includes('text/') || ['txt', 'md', 'js', 'html', 'css', 'json'].includes(extension)) return 'far fa-file-code';
  if (mimeType.includes('zip') || mimeType.includes('rar') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return 'far fa-file-archive';
  if (mimeType.includes('video/')) return 'far fa-file-video';
  if (mimeType.includes('audio/')) return 'far fa-file-audio';
  
  return 'far fa-file';
};

// Format file size
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};