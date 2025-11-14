// src/services/ordersSeller.js
import { API_CONFIG, apiUrl } from "../config/api";

/** Build query ?statuses=...&statuses=... */
const buildStatusesQuery = (statuses) => {
  if (!statuses || (Array.isArray(statuses) && statuses.length === 0)) return "";
  const arr = Array.isArray(statuses) ? statuses : [statuses];
  const qs = arr.map((s) => `statuses=${encodeURIComponent(s)}`).join("&");
  return `?${qs}`;
};

/**
 * Lấy danh sách đơn theo sellerId (lọc theo 1 hoặc nhiều status)
 */
export async function fetchOrdersBySeller(authFetch, sellerId, statuses) {
  const url = apiUrl(
    API_CONFIG.endpoints.ordersBySeller(sellerId) + buildStatusesQuery(statuses)
  );

  const res = await authFetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return Array.isArray(data?.result) ? data.result : [];
}

/**
 * Lấy chi tiết đơn theo orderId
 */
export async function fetchOrderDetail(authFetch, orderId) {
  // Ưu tiên dùng endpoint trong API_CONFIG nếu có, fallback về /order/{id}
  const endpoint = API_CONFIG?.endpoints?.orderDetail
    ? API_CONFIG.endpoints.orderDetail(orderId)
    : `/order/${orderId}`;

  const url = apiUrl(endpoint);

  const res = await authFetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

  // BE trả về { code, message, result }, trả thẳng result
  return data?.result ?? null;
}
