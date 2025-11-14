// src/services/violationService.js
import { apiUrl, API_CONFIG } from "../config/api";

/** Helper lấy token giống các nơi khác */
const getToken = () =>
  localStorage.getItem("token") || localStorage.getItem("access_token") || "";

/** Safe parse JSON (đề phòng BE trả text) */
const safeJson = async (res) => {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

/**
 * Lấy sellerId hiện tại:
 * - Nếu có sellerIdFromCaller: trả ngay.
 * - Nếu không: gọi /me -> userId -> /seller/searchByUserId/{userId} -> sellerId
 */
export async function getCurrentSellerId(sellerIdFromCaller) {
  const token = getToken();
  if (!token) throw new Error("Không có token đăng nhập");

  if (sellerIdFromCaller) return sellerIdFromCaller;

  // 1) /me
  const pRes = await fetch(apiUrl(API_CONFIG.endpoints.getMyProfile), {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  const pData = await safeJson(pRes);
  if (!pRes.ok) throw new Error(pData?.message || `HTTP ${pRes.status}`);
  const userId =
    (pData?.result ?? pData)?.id || (pData?.result ?? pData)?.userId;
  if (!userId) throw new Error("Không xác định được userId");

  // 2) /seller/searchByUserId/{userId}
  const sRes = await fetch(
    apiUrl(API_CONFIG.endpoints.searchSellerByUserId(userId)),
    { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } }
  );
  const sData = await safeJson(sRes);
  if (!sRes.ok) throw new Error(sData?.message || `HTTP ${sRes.status}`);
  const sellerId = sData?.result?.id;
  if (!sellerId) throw new Error("Chưa có tài khoản nhà bán hoặc thiếu dữ liệu");

  return sellerId;
}

/**
 * Lấy danh sách vi phạm theo sellerId (API trả mảng).
 * - Nếu truyền sellerIdFromCaller -> dùng trực tiếp.
 * - Nếu không truyền -> tự lấy từ profile -> map sang sellerId.
 */
export async function fetchSellerViolations(sellerIdFromCaller) {
  const token = getToken();
  if (!token) throw new Error("Không có token đăng nhập");

  const sellerId = await getCurrentSellerId(sellerIdFromCaller);

  // 3) Gọi API violations
  const url = apiUrl(`/info/sellers/${encodeURIComponent(sellerId)}/violations`);
  const vRes = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  const vData = await safeJson(vRes);
  if (!vRes.ok) throw new Error(vData?.message || `HTTP ${vRes.status}`);

  // Chuẩn hóa theo mẫu trả về { code:200, result:[ ... ] }
  const items = Array.isArray(vData?.result)
    ? vData.result
    : (Array.isArray(vData) ? vData : []);

  return { items, sellerId };
}

/**
 * Gửi khiếu nại cho 1 báo cáo vi phạm
 * @param {Object} params
 * @param {string} params.violationRecordId  - ID báo cáo vi phạm (bắt buộc)
 * @param {string} params.productId          - ID sản phẩm liên quan (bắt buộc)
 * @param {string} params.reason             - Lý do khiếu nại (bắt buộc)
 * @param {File[]} [params.evidences=[]]     - Danh sách file bằng chứng (tuỳ chọn)
 * @param {string} [params.sellerId]         - SellerId (tuỳ chọn, nếu không truyền sẽ tự lấy)
 * @param {Function} [params.authFetch]      - fetch đã inject token (nếu có)
 * @returns {Promise<{code?:number,message?:string,result?:any}>}
 */
export async function submitAppeal({
  violationRecordId,
  productId,
  reason,
  evidences = [],
  sellerId: sellerIdFromCaller,
  authFetch,
}) {
  if (!violationRecordId) throw new Error("Thiếu violationRecordId.");
  if (!productId) throw new Error("Thiếu productId.");
  if (!reason || !reason.trim()) throw new Error("Vui lòng nhập lý do khiếu nại.");

  // Lấy sellerId (truyền vào hoặc tự tìm)
  const sellerId = await getCurrentSellerId(sellerIdFromCaller);

  // Chuẩn bị form-data
  const form = new FormData();
  form.append("sellerId", String(sellerId));
  form.append("reason", String(reason));
  form.append("violationRecordId", String(violationRecordId));
  form.append("productId", String(productId));
  (evidences || []).forEach((f) => f && form.append("evidences", f, f.name));

  const endpoint =
    (API_CONFIG?.endpoints && API_CONFIG.endpoints.submitAppeal) ||
    "/info/appeals/submit";
  const url = apiUrl(endpoint);

  // Nếu có authFetch (context) thì dùng; nếu không, tự gắn Authorization
  const token = getToken();
  const doFetch = authFetch || fetch;
  const headers =
    authFetch ? undefined : { Authorization: `Bearer ${token}` }; // KHÔNG set Content-Type cho multipart

  const res = await doFetch(url, { method: "POST", body: form, headers });
  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return data; // { code, message, result? }
}

/**
 * Lấy các khiếu nại đang ở trạng thái PENDING của seller hiện tại.
 * Trả về mảng, mỗi item có violation_record_id, status = "PENDING"...
 */
export async function fetchPendingAppeals(authFetch) {
  const token = getToken();
  if (!token) throw new Error("Không có token đăng nhập");

  const url = apiUrl(`/info/appeals/pending`);
  const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };

  const doFetch = authFetch
    ? (u, opt) =>
        authFetch(u, {
          ...(opt || {}),
          headers: { ...(opt?.headers || {}), ...headers },
        })
    : (u, opt) => fetch(u, { ...(opt || {}), headers });

  const res = await doFetch(url, { method: "GET" });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

  return Array.isArray(data?.result) ? data.result : [];
}
export async function fetchAppealsBySeller(authFetch) {
  const token = getToken();
  if (!token) throw new Error("Không có token đăng nhập");

  const sellerId = await getCurrentSellerId();
  const url = apiUrl(`/info/appeals/seller/${encodeURIComponent(sellerId)}`);
  const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };

  const doFetch = authFetch
    ? (u, opt) => authFetch(u, { ...(opt || {}), headers: { ...(opt?.headers || {}), ...headers } })
    : (u, opt) => fetch(u, { ...(opt || {}), headers });

  const res = await doFetch(url, { method: "GET" });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

  // data.result là mảng giống JSON bạn đưa
  return Array.isArray(data?.result) ? data.result : [];
}
