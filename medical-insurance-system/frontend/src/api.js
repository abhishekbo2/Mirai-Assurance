import axios from 'axios';
import {
  getLocalSession,
  getOidcAccessToken,
  isOidcRegistrationFlowActive,
} from './auth/keycloak';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL is not configured.');
}

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

const API = axios.create({ baseURL: API_BASE_URL });

API.interceptors.request.use(async (req) => {
  if (isOidcRegistrationFlowActive()) return req;

  const token = await getOidcAccessToken() || getLocalSession()?.token;
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export default API;
