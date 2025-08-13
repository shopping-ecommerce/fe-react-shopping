// src/services/api.js
import { API_CONFIG } from '../config/api';

const apiCall = async (endpoint, method = 'POST', data = null) => {
  const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints[endpoint]}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Request failed');
    }

    return result;
  } catch (error) {
    throw new Error(error.message);
  }
};

export const register = (data) => apiCall('register', 'POST', data);
export const verifyOtp = (data) => apiCall('verifyOtp', 'POST', data);
// Thêm các hàm API khác khi cần, ví dụ: login, logout, etc.

export default apiCall;