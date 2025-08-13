// src/config/api.js
export const API_CONFIG = {
  baseUrl: 'http://localhost:8080',
  endpoints: {
    register: '/authentication/register',
    verifyOtp: '/authentication/verifyOTP',
    login: '/authentication/login-email-password', // Thêm nếu cần
    // Thêm các endpoint khác khi cần
  },
};