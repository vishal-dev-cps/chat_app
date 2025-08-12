import axios from 'axios';

// Base URL can be configured via Vite env var: VITE_API_URL
// const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const baseURL = import.meta.env.VITE_API_URL || 'https://us-central1-securityerp.cloudfunctions.net';

const apiClient = axios.create({
  baseURL,
  // withCredentials disabled unless needed
});

export default apiClient;
