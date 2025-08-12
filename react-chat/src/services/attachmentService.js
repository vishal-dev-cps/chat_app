// Attachment service: generate previews, upload files, helpers
// -------------------------------------------------------------
// This service is **framework-agnostic** so it can be imported from
// any React component (e.g. MessageInput / AttachmentPreview) to
// provide common functionality around attachments.
//
// 1. createFilePreview(file)  – asynchronously creates a preview object
//    with base64 preview for images and general metadata for other files.
// 2. uploadFile(fileInfo, authToken?) – uploads the file to the backend
//    `api/chat/upload` endpoint and returns the parsed server response.
// 3. formatFileSize(bytes) – human-readable file size helper.
// 4. getFileIconClass(mimeType, fileName) – resolves an appropriate
//    Font-Awesome icon class for the provided file.
//
// NOTE: All functions are exported individually for tree-shaking, plus a
// default export containing all helpers for convenience.

//const API_UPLOAD_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/chat/upload`;
const API_UPLOAD_URL = `${import.meta.env.VITE_API_URL || 'https://us-central1-securityerp.cloudfunctions.net'}/api/chat/upload`;

/**
 * Convert bytes to a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Decide which Font Awesome icon class to use for non-image files.
 * @param {string} mimeType
 * @param {string} fileName
 * @returns {string}
 */
export function getFileIconClass(mimeType = '', fileName = '') {
  const extension = (fileName.split('.').pop() || '').toLowerCase();

  // Office / document types
  if (mimeType.includes('pdf')) return 'far fa-file-pdf';
  if (mimeType.includes('word') || ['doc', 'docx'].includes(extension)) return 'far fa-file-word';
  if (mimeType.includes('excel') || ['xls', 'xlsx'].includes(extension)) return 'far fa-file-excel';
  if (mimeType.includes('powerpoint') || ['ppt', 'pptx'].includes(extension)) return 'far fa-file-powerpoint';
  if (mimeType.startsWith('text/') || ['txt', 'md', 'js', 'html', 'css', 'json'].includes(extension)) return 'far fa-file-code';

  // Archives
  if (mimeType.includes('zip') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return 'far fa-file-archive';

  // Media
  if (mimeType.startsWith('video/')) return 'far fa-file-video';
  if (mimeType.startsWith('audio/')) return 'far fa-file-audio';

  // Fallback
  return 'far fa-file';
}

/**
 * Build a preview information object for the selected file.
 * @param {File} file
 * @returns {Promise<AttachmentPreviewInfo>}
 */
export function createFilePreview(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const fileTypeRoot = file.type.split('/')[0];

    /** @type {AttachmentPreviewInfo} */
    const fileInfo = {
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: file.name,
      type: file.type,
      size: file.size,
      file,
      preview: undefined // will be set for images
    };

    if (fileTypeRoot === 'image') {
      reader.onload = (e) => {
        fileInfo.preview = e.target?.result;
        resolve(fileInfo);
      };
      reader.readAsDataURL(file);
    } else {
      resolve(fileInfo);
    }
  });
}

/**
 * Upload a file (or AttachmentPreviewInfo) to the server.
 * Returns the parsed JSON response from the API.
 * @param {File|AttachmentPreviewInfo} fileInput
 * @param {string|null} token Optional bearer token for auth.
 * @returns {Promise<any>} Parsed JSON response from backend.
 */
// progressCb(percent) called 0-100
export function uploadFile(fileInput, token = null, progressCb = null) {
  const fileObj = fileInput instanceof File ? fileInput : (fileInput.file ?? null);
  if (!fileObj) return Promise.reject(new Error('Invalid file provided to uploadFile'));

    const formData = new FormData();
  formData.append('file', fileObj);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_UPLOAD_URL, true);
    // auth header
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.responseType = 'json';

    xhr.upload.onprogress = (e)=>{
      if(progressCb && e.lengthComputable){
        progressCb(Math.round((e.loaded/e.total)*100));
      }
    };

    xhr.onload = () => {
      const res = xhr.response || {};
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log('Upload success:', res);
        resolve(res);
      } else {
        reject(new Error(res.message || xhr.statusText || 'Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.onabort = () => reject(new Error('Upload aborted'));
    xhr.send(formData);
  });
}

export default {
  formatFileSize,
  getFileIconClass,
  createFilePreview,
  uploadFile,
};

/**
 * @typedef {Object} AttachmentPreviewInfo
 * @property {string} id Unique id for UI tracking
 * @property {string} name
 * @property {string} type MIME type
 * @property {number} size
 * @property {File} file Original File instance
 * @property {string=} preview base64 preview for images
 */
