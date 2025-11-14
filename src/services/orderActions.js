// src/services/orderActions.js
import { API_CONFIG, apiUrl } from "../config/api";

/**
 * Cập nhật trạng thái đơn hàng (dùng chung cho xác nhận/hủy/...).
 * @param {Function} authFetch - hàm fetch có đính kèm token
 * @param {Object} payload - { orderId, sellerId, status, reason? }
 * @returns {Promise<any>}
 */
export async function updateOrder(authFetch, payload) {
  const res = await authFetch(apiUrl(API_CONFIG.endpoints.updateOrder), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  try { return JSON.parse(text); } catch { return { message: text }; }
}
