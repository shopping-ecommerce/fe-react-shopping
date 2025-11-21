import { apiUrl, API_CONFIG } from "../config/api";

/**
 * Lấy danh sách báo cáo của user và trạng thái xử lý
 * @param {Function} authFetch - fetch đã kèm token từ AuthContext
 * @param {string} userId
 * @returns {Promise<Array>} result[]
 */
export async function fetchUserReports(authFetch, userId) {
  const url = apiUrl(API_CONFIG.endpoints.reportsByUserSafe(userId));
  const res = await authFetch(url, {
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.code && data.code !== 200)) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return Array.isArray(data?.result) ? data.result : [];
}
