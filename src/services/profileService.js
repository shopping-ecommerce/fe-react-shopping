// src/services/profileService.js
import { API_CONFIG, apiUrl } from '../config/api';
import { createAuthFetch } from './auth';

/**
 * Lấy thông tin profile của user hiện tại
 * @returns {Promise<object>} Profile data
 */
export async function getMyProfile() {
  try {
    const endpoint = apiUrl(API_CONFIG.endpoints.getMyProfile);
    const authFetch = createAuthFetch();
    
    const res = await authFetch(endpoint, {
      method: 'GET',
    });

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      throw new Error(data?.message || `HTTP ${res.status}: Không thể lấy thông tin profile`);
    }
    
    return data;
  } catch (error) {
    console.error('❌ Lỗi trong getMyProfile:', error);
    throw error;
  }
}