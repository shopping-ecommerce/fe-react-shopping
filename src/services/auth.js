// src/services/auth.js
import { API_CONFIG } from '../config/api';

const BASE = API_CONFIG.baseUrl;
const EP = API_CONFIG.endpoints;

const safeJson = async (res) => {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text }; }
};

const normalizeToken = (t) => {
  if (!t || typeof t !== 'string') return '';
  return t.startsWith('Bearer ') ? t.slice(7) : t;
};

const deepPickToken = (root) => {
  if (!root || typeof root !== 'object') return null;
  const stack = [root];
  const cand = new Set(['jwttoken', 'jwt_token', 'accesstoken', 'access_token', 'token', 'jwt', 'id_token']);
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object') continue;
    for (const [k, v] of Object.entries(cur)) {
      const lk = k.toLowerCase();
      if (cand.has(lk)) {
        if (typeof v === 'string' && v) return v;
        if (v && typeof v === 'object') stack.push(v);
      } else if (v && typeof v === 'object') {
        stack.push(v);
      }
    }
  }
  return null;
};

export const loginEmailPassword = async ({ email, password }) => {
  const url = `${BASE}${EP.login}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  const json = await safeJson(res);
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);

  const payload = json?.result ?? json;

  let token = deepPickToken(payload);
  if (!token && payload && payload.jwt_token) token = payload.jwt_token;

  if (!token) {
    const hAuth = res.headers.get('Authorization') || res.headers.get('authorization');
    const hAcc = res.headers.get('X-Access-Token') || res.headers.get('x-access-token') || res.headers.get('X-Auth-Token');
    const hTok = res.headers.get('X-Token') || res.headers.get('x-token');
    token = hAuth || hAcc || hTok || null;
  }

  token = normalizeToken(token);
  if (!token) throw new Error("No token found in login response");

  // 🔥 LƯU TOKEN VÀO STORAGE
  console.log('💾 Saving token to storage:', token.substring(0, 50) + '...');
  localStorage.setItem('jwtToken', token);
  localStorage.setItem('accessToken', token); // Backup key
  
  // Cũng lưu vào sessionStorage để đảm bảo
  sessionStorage.setItem('jwtToken', token);
  sessionStorage.setItem('accessToken', token);

  return { ...payload, jwtToken: token };
};

export const register = async (payload) => {
  const url = `${BASE}${EP.register}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const json = await safeJson(res);
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json?.result ?? json;
};

export const verifyOtp = async (payload) => {
  const url = `${BASE}${EP.verifyOtp}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const json = await safeJson(res);
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json?.result ?? json;
};

export const logout = async (authFetch) => {
  const doCall = async (withBody = false) => {
    const init = withBody
      ? {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          credentials: 'include',
        }
      : {
          method: 'POST',
          headers: { Accept: 'application/json' },
          credentials: 'include',
        };

    if (authFetch) {
      return authFetch(apiUrl(EP.logout), init);
    }
    // Fallback: tự gắn Authorization nếu không có authFetch
    const stored = normalizeToken(getStoredToken());
    const headers = new Headers(init.headers || {});
    if (stored) headers.set('Authorization', `Bearer ${stored}`);
    return fetch(apiUrl(EP.logout), { ...init, headers });
  };

  let res = await doCall(false);
  if (res.status === 400 || res.status === 415) {
    res = await doCall(true);
  }

  const json = await safeJson(res);

  // XÓA TOKEN SAU KHI GỌI API (kể cả fail vẫn dọn dẹp ở AuthContext)
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json?.result ?? json;
};

export { logout as doLogout };

export const createAuthFetch = (tokenFromParam) => {
  return async (url, options = {}) => {
    const stored =
      tokenFromParam ||
      localStorage.getItem('jwtToken') ||
      localStorage.getItem('accessToken') ||
      sessionStorage.getItem('jwtToken') ||
      sessionStorage.getItem('accessToken');

    console.log('🔍 createAuthFetch: Looking for token...');
    console.log('- tokenFromParam:', tokenFromParam ? 'provided' : 'null');
    console.log('- localStorage.jwtToken:', localStorage.getItem('jwtToken') ? 'found' : 'null');
    console.log('- localStorage.accessToken:', localStorage.getItem('accessToken') ? 'found' : 'null');
    console.log('- sessionStorage.jwtToken:', sessionStorage.getItem('jwtToken') ? 'found' : 'null');
    console.log('- sessionStorage.accessToken:', sessionStorage.getItem('accessToken') ? 'found' : 'null');

    if (!stored) {
      console.error('❌ No auth token available for request');
      throw new Error('No auth token available for request');
    }

    const bare = normalizeToken(stored);
    console.log('✅ authFetch: Using token', bare.substring(0, 50) + '...');
    
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${bare}`,
      'Accept': 'application/json',
    };

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
    return response;
  };
};