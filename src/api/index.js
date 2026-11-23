import { httpApi, getToken, setToken } from './http.js';
import { demoApi } from './demo.js';

export const api = import.meta.env.VITE_DEMO === 'true' ? demoApi : httpApi;
export { getToken, setToken };
