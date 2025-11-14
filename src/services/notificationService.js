// src/services/notificationService.js
import { apiUrl, API_CONFIG } from "../config/api";

/** Tạo thông báo (reused cho cả user & seller: truyền userId hoặc sellerId) */
export const createNotification = async (authFetch, { userId, sellerId, type = "MESSAGE", content }) => {
  // BE chấp nhận 1 trong 2: userId | sellerId
  const body = JSON.stringify({ userId, sellerId, type, content });
  const res = await authFetch(apiUrl(API_CONFIG.endpoints.notificationCreate), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.code && data.code !== 200)) throw new Error(data?.message || `HTTP ${res.status}`);
  return data?.result || data;
};

/** Lấy danh sách notify (phân trang từ BE) — truyền userId HOẶC sellerId */
export const fetchNotificationsByUser = async (authFetch, userOrSellerId, { page = 0, size = 50 } = {}) => {
  const url = apiUrl(API_CONFIG.endpoints.notificationsByUser(userOrSellerId, { page, size }));
  const res = await authFetch(url, { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  const pageObj = data?.result || data;
  return {
    items: Array.isArray(pageObj?.content) ? pageObj.content : [],
    total: pageObj?.totalElements ?? 0,
    totalPages: pageObj?.totalPages ?? 0,
  };
};

/** Đếm chưa đọc — truyền userId HOẶC sellerId */
export const fetchUnreadCount = async (authFetch, userOrSellerId) => {
  const url = apiUrl(API_CONFIG.endpoints.notificationUnreadCount(userOrSellerId));
  const res = await authFetch(url, { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return Number(data?.result?.unreadCount || 0);
};

/** Đánh dấu 1 thông báo đã đọc (PATCH 8888) — dùng chung theo notifId */
export const markNotificationRead = async (authFetch, notifId) => {
  const url = apiUrl(API_CONFIG.endpoints.notificationRead(notifId));
  const res = await authFetch(url, { method: "PATCH", headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data?.result || data;
};

/** Đánh dấu đã đọc hết — truyền userId HOẶC sellerId */
export const markAllAsRead = async (authFetch, userOrSellerId) => {
  const url = apiUrl(API_CONFIG.endpoints.notificationMarkAllRead(userOrSellerId));
  const res = await authFetch(url, { method: "POST", headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.code && data.code !== 200)) throw new Error(data?.message || `HTTP ${res.status}`);
  return data?.result || data;
};
