// src/services/orders.js
import { API_CONFIG, apiUrl } from "../config/api";

const BASE = API_CONFIG.baseUrl;
const EP   = API_CONFIG.endpoints;

const safeJson = async (res) => {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text }; }
};

/* ===== Helpers: chuẩn hoá options + size/color ===== */
function objFromMaybeArrayOptions(raw) {
  // Một số BE có thể trả options dạng mảng [{name,label,value}] → convert sang object
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (Array.isArray(raw)) {
    const out = {};
    for (const it of raw) {
      const k = it?.name ?? it?.label;
      const v = it?.value ?? it?.selected ?? it?.optionValue;
      if (k) out[String(k)] = v;
    }
    return out;
  }
  return {};
}
function pickFirst(obj, keys = []) {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") {
      return obj[k];
    }
  }
  return undefined;
}
function normalizeOrderItem(it) {
  const optionsRaw =
    it?.options !== undefined ? it.options : it?.selectedOptions || {};
  const options = objFromMaybeArrayOptions(optionsRaw);

  const size =
    pickFirst(options, ["Kích cỡ", "Size", "size", "SIZE"]) ??
    it?.size ??
    it?.variantSize ??
    "";

  const color =
    pickFirst(options, ["Màu sắc", "Color", "color", "COLOUR", "colour"]) ??
    it?.color ??
    it?.colour ??
    it?.colorName ??
    "";

  return {
    ...it,
    options,                  // luôn là object: { "Kích cỡ": "...", "Màu sắc": "..." }
    size:  size ? String(size) : "",   // thuận tiện cho UI cũ
    color: color ? String(color) : "",
  };
}

/**
 * Lấy danh sách đơn theo userId.
 * - authFetch: từ AuthContext (tự gắn Bearer + credentials)
 * - status: 1 trong ["PENDING","PROCESSING","SHIPPED","DELIVERED","CANCELLED","CONFIRMED"]
 *           hoặc null/undefined để lấy tất cả
 */
export async function fetchOrdersByUser(authFetch, userId, status) {
  if (!authFetch) throw new Error("authFetch is required");
  if (!userId) throw new Error("userId is required");

  const base = `${BASE}${EP.getOrdersByUser(userId)}`;
  const url  = status ? `${base}?statuses=${encodeURIComponent(status)}` : base;

  const res  = await authFetch(url, { method: "GET" });
  const json = await safeJson(res);
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);

  const arr = json?.result ?? [];
  // ✅ Chuẩn hoá để mỗi orderItem có options/size/color theo API mới
  const normalized = Array.isArray(arr)
    ? arr.map((order) => ({
        ...order,
        orderItems: Array.isArray(order?.orderItems)
          ? order.orderItems.map(normalizeOrderItem)
          : [],
      }))
    : [];

  return normalized;
}

/**
 * Hủy đơn hàng
 * - authFetch: từ AuthContext (tự gắn Bearer + credentials)
 * - params: { orderId, userId, reason }
 * Endpoint: POST http://localhost:8888/shopping/api/order/cancelOrder
 * Body: { orderId, userId, reason }
 */
export async function cancelOrder(authFetch, { orderId, userId, reason }) {
  if (!authFetch) throw new Error("authFetch is required");
  if (!orderId) throw new Error("orderId is required");
  if (!userId) throw new Error("userId is required");
  if (!reason || !reason.trim()) throw new Error("reason is required");

  const url = apiUrl(EP.cancelOrder);

  const res = await authFetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId, userId, reason }),
  });

  const json = await safeJson(res);
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);

  return json?.result ?? json;
}
