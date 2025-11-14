// src/services/favorites.js
import { API_CONFIG, apiUrl } from "../config/api";

/** Parse JSON an toàn */
const safeJson = async (res) => {
  const txt = await res.text();
  if (!txt) return {};
  try { return JSON.parse(txt); } catch { return { message: txt }; }
};

/** Chuẩn hoá response từ BE (code: 0 hoặc 200) */
const ok = (json) => {
  const c = json?.code;
  return c === 0 || c === 200;
};

/** Lấy profile hiện tại (để lấy userId & favorite_products) */
export const getMyProfile = async (authFetch) => {
  const res = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (res.status === 401 || res.status === 403) {
    const err = new Error("Unauthorized");
    err.status = res.status;
    throw err;
  }
  const json = await safeJson(res);
  if (!ok(json)) throw new Error(json?.message || "getMyProfile failed");
  return json.result;
};

/** Trả mảng ID sản phẩm yêu thích */
export const getFavoriteIds = async (authFetch) => {
  const pf = await getMyProfile(authFetch);
  return Array.isArray(pf?.favorite_products) ? pf.favorite_products : [];
};

/** Lấy toàn bộ products (để join lọc theo favorite) */
export const getAllProducts = async (authFetch) => {
  const res = await authFetch(apiUrl(API_CONFIG.endpoints.getProducts), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (res.status === 401 || res.status === 403) {
    const err = new Error("Unauthorized");
    err.status = res.status;
    throw err;
  }
  const json = await safeJson(res);
  if (!ok(json)) throw new Error(json?.message || "getProducts failed");
  return Array.isArray(json.result) ? json.result : [];
};

/** Lấy danh sách sản phẩm yêu thích (đã join từ getProducts) */
export const getFavoriteProducts = async (authFetch) => {
  const [ids, all] = await Promise.all([getFavoriteIds(authFetch), getAllProducts(authFetch)]);
  if (!ids.length) return [];
  const set = new Set(ids);
  return all.filter((p) => set.has(p.id));
};

/** Thêm sản phẩm vào yêu thích — BE trả về profile mới */
export const addFavorite = async (authFetch, { userId, productId }) => {
  const res = await authFetch(apiUrl(API_CONFIG.endpoints.favoriteAdd), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ user_id: userId, product_id: productId }),
  });
  if (res.status === 401 || res.status === 403) {
    const err = new Error("Unauthorized");
    err.status = res.status;
    throw err;
  }
  const json = await safeJson(res);
  if (!ok(json)) throw new Error(json?.message || "favorite/add failed");
  const pf = json.result;
  return Array.isArray(pf?.favorite_products) ? pf.favorite_products : [];
};

/** (Tuỳ chọn) Bỏ yêu thích nếu BE có endpoint remove */
export const removeFavorite = async (authFetch, { userId, productId }) => {
  if (!API_CONFIG.endpoints.favoriteRemove) {
    throw new Error("favorite/remove endpoint is not configured");
  }
  const res = await authFetch(apiUrl(API_CONFIG.endpoints.favoriteRemove), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ user_id: userId, product_id: productId }),
  });
  if (res.status === 401 || res.status === 403) {
    const err = new Error("Unauthorized");
    err.status = res.status;
    throw err;
  }
  const json = await safeJson(res);
  if (!ok(json)) throw new Error(json?.message || "favorite/remove failed");
  const pf = json.result;
  return Array.isArray(pf?.favorite_products) ? pf.favorite_products : [];
};

/* ============================
   ẢNH SẢN PHẨM — CÁCH 2 (FIX)
   ============================ */

/**
 * Chuẩn hoá URL ảnh:
 * - Giữ nguyên data:/blob:
 * - Ép http:// → https:// để tránh mixed-content
 * - Encode an toàn khoảng trắng/ký tự đặc biệt trong path
 * - Hỗ trợ relative path qua VITE_FILE_BASE (nếu có)
 */
export const normalizeImageUrl = (raw) => {
  if (!raw) return "";

  // raw có thể là string hoặc object {url: "..."}
  let url = typeof raw === "string" ? raw : raw?.url || "";
  url = (url || "").trim();
  if (!url) return "";

  // Giữ nguyên data: / blob:
  if (/^(data:|blob:)/i.test(url)) return url;

  // Nếu là relative path → nối base (nếu bạn cấu hình)
  const FILE_BASE = import.meta?.env?.VITE_FILE_BASE || "";
  const isAbsolute = /^https?:\/\//i.test(url);
  if (!isAbsolute) {
    if (FILE_BASE) {
      url = `${String(FILE_BASE).replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
    } else if (url.startsWith("/")) {
      // fallback dùng origin hiện tại
      try {
        const origin = window?.location?.origin || "";
        if (origin) url = `${origin}${url}`;
      } catch {
        // bỏ qua nếu không có window (không xảy ra trên client)
      }
    }
  }

  // Ép https
  url = url.replace(/^http:\/\//i, "https://");

  // Encode phần pathname để tránh lỗi do khoảng trắng/ký tự đặc biệt
  try {
    const u = new URL(url, window.location?.origin);
    // encode từng segment trong pathname
    u.pathname = u.pathname
      .split("/")
      .map((seg) => (seg ? encodeURIComponent(decodeURIComponent(seg)) : seg))
      .join("/");
    return u.toString();
  } catch {
    // Fallback nhẹ nếu URL không parse được
    return url.replace(/ /g, "%20");
  }
};

/**
 * Chọn ảnh đầu tiên hợp lệ (không phải video).
 * Hỗ trợ:
 *  - mảng object {url: string}
 *  - mảng string
 *  - object đơn {url}
 *  - string đơn
 */
/** Trả về URL ảnh hợp lệ từ rất nhiều format khác nhau */
export const pickImageUrl = (images = []) => {
  // chấp nhận: string | object[] | string[]
  const list = Array.isArray(images) ? images : [images];

  // gom các candidate url
  const candidates = list
    .map((it) => {
      if (!it) return "";
      if (typeof it === "string") return it;
      if (typeof it?.url === "string") return it.url;
      if (typeof it?.src === "string") return it.src;
      if (typeof it?.imageUrl === "string") return it.imageUrl;
      return "";
    })
    .filter(Boolean)
    // bỏ video
    .filter((u) => !/\.(mp4|webm|mov)(\?|#|$)/i.test(u));

  const normalizeUrl = (u) => {
    if (!u) return "";
    // bỏ khoảng trắng & ký tự lạ trong path
    try {
      // nếu đã là URL tuyệt đối → encode path
      const url = new URL(u);
      url.pathname = url.pathname.split("/").map(encodeURIComponent).join("/");
      return url.toString();
    } catch {
      // tương đối hoặc thiếu protocol
      let out = u.trim().replace(/\s/g, "%20");
      if (out.startsWith("//")) out = "https:" + out;
      if (out.startsWith("http://")) out = "https://" + out.slice(7);
      return out;
    }
  };

  const picked = candidates[0] || "/img/default.png";
  return normalizeUrl(picked);
};
