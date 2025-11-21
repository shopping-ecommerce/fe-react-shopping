// src/utils/authUtils.js
import { jwtDecode } from "jwt-decode";

/**
 * Kiểm tra token có hết hạn không (với buffer 5 phút)
 */
export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    const payload = jwtDecode(token);
    if (!payload.exp) return false; // Token không có thời hạn
    
    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 5 * 60; // 5 phút buffer
    
    return payload.exp < (now + bufferTime);
  } catch (error) {
    console.error("Error decoding token:", error);
    return true;
  }
};

/**
 * Lấy thời gian còn lại của token (tính bằng giây)
 */
export const getTokenTimeRemaining = (token) => {
  if (!token) return 0;
  
  try {
    const payload = jwtDecode(token);
    if (!payload.exp) return Infinity; // Token không có thời hạn
    
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, payload.exp - now);
  } catch (error) {
    return 0;
  }
};

/**
 * Lấy thông tin user từ token
 */
export const getUserFromToken = (token) => {
  if (!token) return null;
  
  try {
    const payload = jwtDecode(token);
    const roles = Array.isArray(payload.roles) 
      ? payload.roles.map(r => r.replace(/^ROLE_/, '')) 
      : [];
      
    return {
      id: payload.uid || payload.sub || null,
      email: payload.email || payload.user_email || payload.preferred_username || '',
      roles,
      exp: payload.exp
    };
  } catch (error) {
    console.error("Error extracting user from token:", error);
    return null;
  }
};

/**
 * Clear tất cả tokens từ storage
 */
export const clearAllTokens = () => {
  const tokenKeys = ["access_token", "jwtToken", "accessToken"];
  
  tokenKeys.forEach(key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  
  console.log("🗑️ Cleared all tokens from storage");
};

/**
 * Lưu token vào tất cả storage locations
 */
export const saveToken = (token) => {
  if (!token) return;
  
  const tokenKeys = ["access_token", "jwtToken", "accessToken"];
  
  tokenKeys.forEach(key => {
    localStorage.setItem(key, token);
  });
  
  console.log("💾 Saved token to all storage locations");
};

/**
 * Lấy token từ bất kỳ storage location nào
 */
export const getStoredToken = () => {
  const tokenKeys = ["jwtToken", "accessToken", "access_token"];
  
  // Thử localStorage trước
  for (const key of tokenKeys) {
    const token = localStorage.getItem(key);
    if (token) return token;
  }
  
  // Sau đó thử sessionStorage
  for (const key of tokenKeys) {
    const token = sessionStorage.getItem(key);
    if (token) return token;
  }
  
  return null;
};