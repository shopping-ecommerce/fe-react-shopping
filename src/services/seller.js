// src/services/seller.js
import { API_CONFIG, apiUrl } from "../config/api";

const toJson = async (res) => {
  const t = await res.text();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch (e) {
    console.error("Lỗi parse JSON:", e, "Text gốc:", t);
    return { message: t };
  }
};

/**
 * Đăng ký seller (multipart/form-data)
 * - identifications: MẢNG File (bắt buộc khi REJECTED)
 * - avatar: File | null
 */
export async function registerSeller(
  authFetch,
  { userId, shopName, address, email, identifications, avatar }
) {
  const form = new FormData();

  if (userId) form.append("userId", userId);
  if (shopName) form.append("shopName", shopName);
  if (address) form.append("address", address);
  if (email) form.append("email", email);

  if (Array.isArray(identifications)) {
    identifications
      .filter((f) => f instanceof File || f instanceof Blob)
      .forEach((f) => form.append("identifications", f));
  } else if (
    identifications instanceof File ||
    identifications instanceof Blob
  ) {
    form.append("identifications", identifications);
  }

  if (avatar instanceof File || avatar instanceof Blob) {
    form.append("avatar", avatar);
  }

  // Debug form (dev)
  try {
    const dbg = [];
    for (const [k, v] of form.entries()) {
      dbg.push([
        k,
        v instanceof File
          ? `File(${v.name}, ${v.type}, ${v.size}B)`
          : String(v),
      ]);
    }
    console.log("registerSeller FormData:", dbg);
  } catch {}

  try {
    const res = await authFetch(apiUrl(API_CONFIG.endpoints.registerSeller), {
      method: "POST",
      body: form,
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error("Phiên đăng nhập hết hạn");
    }

    const data = await toJson(res);
    console.log(
      "registerSeller response nhận được:",
      JSON.stringify(data, null, 2)
    );

    if (!res.ok) {
      const message =
        data.message || data.error || `HTTP ${res.status} ${res.statusText}`;
      if (data.code === 1001 || res.status >= 500) {
        throw new Error(
          "Server gặp lỗi nội bộ. Có thể do: định dạng file không đúng, thiếu thông tin bắt buộc, hoặc lỗi xử lý dữ liệu trên server."
        );
      }
      throw new Error(
        message === "Unauthenticated" ? "Phiên đăng nhập hết hạn" : message
      );
    }

    if (data.code && data.code !== 200) {
      let message = data.message || data.error || `Lỗi API ${data.code}`;
      if (data.code === 1001) {
        message =
          "Server gặp lỗi nội bộ khi xử lý đăng ký seller. Vui lòng kiểm tra lại thông tin và thử lại.";
      }
      throw new Error(message);
    }

    return data.result ?? data;
  } catch (e) {
    console.error("registerSeller thất bại:", e);
    if (
      e.message.includes("Phiên đăng nhập hết hạn") ||
      e.message.includes("Yêu cầu hết thời gian chờ") ||
      e.message.includes("HTTP")
    ) {
      throw e;
    }
    throw new Error(`Lỗi đăng ký seller: ${e.message || "Lỗi không xác định"}`);
  }
}

/**
 * Lấy thông tin seller theo userId để biết trạng thái (PENDING/APPROVED/REJECTED)
 * GET /info/sellers/searchByUserId/{userId}
 */
export async function getSellerByUserId(authFetch, userId) {
  if (!userId) throw new Error("Thiếu userId");
  const url = `${
    API_CONFIG.baseUrl
  }/info/sellers/searchByUserId/${encodeURIComponent(userId)}`;

  const res = await authFetch(url, { method: "GET" });
  const data = await toJson(res);

  if (!res.ok) {
    const msg = data.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data?.result ?? null;
}

/**
 * ✅ Lấy thông tin seller theo sellerId (đúng với orders.sellerId)
 * GET /info/sellers/searchBySellerId/{sellerId}
 */
export async function getSellerBySellerId(authFetch, sellerId) {
  if (!sellerId) throw new Error("Thiếu sellerId");
  const url = `${
    API_CONFIG.baseUrl
  }/info/sellers/searchBySellerId/${encodeURIComponent(sellerId)}`;

  const res = await authFetch(url, { method: "GET" });
  const data = await toJson(res);

  if (!res.ok) {
    const msg = data.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data?.result ?? null;
}

/**
 * 🌟 Tiện ích: lấy tên shop theo sellerId, fallback qua userId nếu cần
 */
export async function getShopNameBySellerId(authFetch, sellerId) {
  const pickName = (obj) =>
    obj?.shopName || obj?.name || obj?.storeName || obj?.sellerName || null;

  try {
    const s = await getSellerBySellerId(authFetch, sellerId);
    const name = pickName(s);
    if (name) return name;
  } catch {}

  try {
    const s2 = await getSellerByUserId(authFetch, sellerId);
    const name2 = pickName(s2);
    if (name2) return name2;
  } catch {}

  return `Nhà bán #${(sellerId || "").slice(0, 8)}`;
}
