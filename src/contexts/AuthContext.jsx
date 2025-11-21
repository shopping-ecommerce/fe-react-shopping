// src/contexts/AuthContext.jsx
"use client";

import { createContext, useState, useMemo, useCallback, useEffect } from 'react';
import { jwtDecode } from "jwt-decode";
import { logout as apiLogout } from "../services/auth";
import { 
  isTokenExpired, 
  getUserFromToken, 
  clearAllTokens, 
  saveToken, 
  getStoredToken,
  getTokenTimeRemaining 
} from "../utils/authUtils";

export const AuthContext = createContext(null);

// helper: xác định token chỉ-Admin (không có quyền buyer/seller/user)
const isAdminOnlyRoles = (roles = []) => {
  const norm = (Array.isArray(roles) ? roles : []).map(r => String(r).toUpperCase());
  const hasAdmin = norm.includes("ADMIN");
  const hasBuyerLike = norm.includes("BUYER") || norm.includes("SELLER") || norm.includes("USER");
  return hasAdmin && !hasBuyerLike;
};

export function AuthProvider({ children }) {
  const initialToken = getStoredToken();
  const initialUser  = initialToken && !isTokenExpired(initialToken)
    ? getUserFromToken(initialToken)
    : null;

  const [token, setToken] = useState(getStoredToken());
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser]   = useState(initialUser);

  // ===== AUTO LOGOUT khi token hết hạn =====
  useEffect(() => {
    if (!token || !authReady) return;
    const timeRemaining = getTokenTimeRemaining(token);
    if (timeRemaining <= 0) {
      console.warn("⏰ Token expired, logging out...");
      logout();
      return;
    }
    const logoutTimer = setTimeout(() => {
      console.warn("⏰ Token expired, auto logout");
      logout();
    }, timeRemaining * 1000);

    console.log(`⏱️ Token expires in ${Math.floor(timeRemaining / 60)} minutes`);
    return () => clearTimeout(logoutTimer);
  }, [token, authReady]);

  const forceLogoutToLogin = useCallback(() => {
    // Xóa và chuyển về /login (tránh loop nếu đang ở /login)
    clearAllTokens();
    setToken(null);
    setUser(null);
    setAuthReady(true);
    if (typeof window !== "undefined") {
      if (!/^\/login(?:\?|#|$)/.test(window.location.pathname)) {
        window.location.replace("/login");
      }
    }
  }, []);

  const applyToken = useCallback((jwtToken, fallbackUser) => {
    if (!jwtToken) {
      setToken(null);
      setUser(null);
      clearAllTokens();
      setAuthReady(true);
      return;
    }

    // ✅ kiểm tra hết hạn trước
    if (isTokenExpired(jwtToken)) {
      console.warn("Token đã hết hạn khi apply");
      setToken(null);
      setUser(null);
      clearAllTokens();
      setAuthReady(true);
      return;
    }

    try {
      const userFromToken = getUserFromToken(jwtToken);
      if (!userFromToken) throw new Error("Cannot extract user from token");

      // Nếu là admin-only token → xóa & đẩy về /login
      if (isAdminOnlyRoles(userFromToken.roles)) {
        console.warn("⚠️ Phát hiện admin-only token trên app buyer → clear & redirect /login");
        forceLogoutToLogin();
        return;
      }

      // merge fallback
      const merged = {
        ...userFromToken,
        ...(fallbackUser || {}),
        id: (fallbackUser && fallbackUser.id) || userFromToken.id,
        email: (fallbackUser && fallbackUser.email) || userFromToken.email,
      };

      setToken(jwtToken);
      setUser(merged);
      saveToken(jwtToken);
      setAuthReady(true);

      console.log("✅ Applied token, user:", merged);
      console.log(`⏱️ Token expires in ${Math.floor(getTokenTimeRemaining(jwtToken) / 60)} minutes`);
    } catch (e) {
      console.error("Failed to apply token:", e);
      setToken(null);
      setUser(null);
      clearAllTokens();
      setAuthReady(true);
    }
  }, [forceLogoutToLogin]);

  // Khởi tạo auth state khi app load
  useEffect(() => {
    const storedToken = getStoredToken();
    console.log("🔍 AuthContext init - found token:", storedToken ? storedToken.substring(0, 30) + '...' : 'null');

    if (storedToken) {
      // decode nhanh để chặn admin-only trước khi set
      try {
        const decoded = getUserFromToken(storedToken);
        if (decoded && isAdminOnlyRoles(decoded.roles)) {
          console.warn("⚠️ Init: admin-only token → clear & redirect /login");
          forceLogoutToLogin();
          return;
        }
      } catch {
        // ignore, applyToken sẽ handle
      }
      applyToken(storedToken);
    } else {
      setAuthReady(true);
    }
  }, [applyToken, forceLogoutToLogin]);

  const authFetch = useCallback(async (input, init = {}) => {
    const headers = new Headers(init.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      console.log("authFetch: Using token", token);
    } else {
      console.warn("authFetch: No token available");
    }
    return fetch(input, { ...init, headers, credentials: 'include' });
  }, [token]);

  const login = useCallback((userData, jwtToken) => {
    applyToken(jwtToken, userData);
  }, [applyToken]);

  const logout = useCallback(async () => {
    try {
      // 👇 QUAN TRỌNG: truyền authFetch để API có Bearer
      await apiLogout(authFetch);
      console.log("✅ Logged out successfully");
    } catch (e) {
      console.error("Logout failed:", e);
    } finally {
      clearAllTokens();
      setToken(null);
      setUser(null);
      setAuthReady(true);
      // đảm bảo về /login
      if (typeof window !== "undefined") {
        if (!/^\/login(?:\?|#|$)/.test(window.location.pathname)) {
          window.location.replace("/login");
        }
      }
    }
  }, [authFetch]);

  useEffect(() => {
    console.log('Auth state → token?', !!token, 'user:', user, 'authReady:', authReady);
  }, [token, user, authReady]);

  const roles = user?.roles || [];
  const isAdminOnly = isAdminOnlyRoles(roles);

  // Chỉ authenticated khi có token + user + ready + KHÔNG phải admin-only
  const isAuthenticated = authReady && !!token && !!user && !isAdminOnly;

  const value = useMemo(() => ({
    user,
    token,
    roles,
    authReady,
    isAuthenticated,
    isAdmin: roles.includes('ADMIN'),
    isSeller: roles.includes('SELLER'),
    login,
    logout,
    authFetch
  }), [user, token, roles, authReady, isAuthenticated, login, logout, authFetch]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
