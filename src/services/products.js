// src/services/products.js
import { API_CONFIG, apiUrl } from "../config/api";

const safeJson = async (res) => {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

/* =========================
   Helpers chung
   ========================= */
function normalizeMediaByOption(mediaByOption = []) {
  if (!Array.isArray(mediaByOption)) return [];
  return mediaByOption.map((m) => {
    const raw = m?.image;
    let outImage = "";
    if (typeof raw === "number" || /^\d+$/.test(String(raw))) {
      outImage = String(Number(raw));
    } else if (typeof raw === "string" && /^https?:\/\//i.test(raw)) {
      outImage = raw.trim();
    } else {
      // không hợp lệ -> để rỗng (BE sẽ bỏ qua)
      outImage = "";
    }
    return {
      optionName: m?.optionName,
      optionValue: m?.optionValue,
      image: outImage,
    };
  });
}

/**
 * Lấy categories
 * @param {Function} authFetch - fetch đã inject token (tùy chọn)
 * @returns {Array} danh sách category
 */
export async function fetchCategories(authFetch) {
  const doFetch = authFetch || fetch;
  const res = await doFetch(apiUrl(API_CONFIG.endpoints.categories), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  const list = data.result ?? data ?? [];
  return Array.isArray(list) ? list : [];
}

/**
 * Tạo product (multipart/form-data) — THEO API MỚI
 * - product gồm: sellerId, name, description, status, categoryId, percentDiscount,
 *   optionDefs[], variants[], mediaByOption[] (image là CHUỖI chỉ số "0","1",...)
 * - images: File[] theo thứ tự để tham chiếu mediaByOption.image
 */
export async function createProduct(authFetch, product, images = []) {
  const doFetch = authFetch || fetch;

  // Chuẩn hoá mediaByOption.image -> string chỉ số ("0","1",...)
  const normalized = { ...product };
  if (Array.isArray(normalized.mediaByOption)) {
    normalized.mediaByOption = normalizeMediaByOption(normalized.mediaByOption);
  }

  // Validate index ảnh (nếu có mapping)
  if (Array.isArray(normalized.mediaByOption) && images?.length) {
    const max = images.length - 1;
    const bad = normalized.mediaByOption.find((m) => {
      const i = Number(m.image);
      return !Number.isInteger(i) || i < 0 || i > max;
    });
    if (bad) {
      throw new Error(
        `mediaByOption.image không hợp lệ: "${bad.image}" (tổng ảnh = ${images.length}).`
      );
    }
  }

  const formData = new FormData();
  formData.append("product", JSON.stringify(normalized));
  (images || []).forEach((file) => formData.append("images", file));

  const res = await doFetch(apiUrl(API_CONFIG.endpoints.createProduct), {
    method: "POST",
    body: formData,
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data; // { code, message, result: {...} }
}

/**
 * Lấy toàn bộ sản phẩm
 * @param {Function} authFetch - fetch đã inject token (tùy chọn)
 * @returns {Array} danh sách sản phẩm (data.result)
 */
export async function fetchProducts(authFetch) {
  const doFetch = authFetch || fetch;
  const res = await doFetch(apiUrl(API_CONFIG.endpoints.getProducts), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  return data?.result ?? [];
}

/**
 * Lấy chi tiết 1 sản phẩm từ danh sách getProducts (lọc theo id)
 * (Nếu BE có endpoint /product/{id} thì nên dùng trực tiếp endpoint đó)
 * @param {String} id
 * @param {Function} authFetch
 */
export async function fetchProductById(id, authFetch) {
  const list = await fetchProducts(authFetch);
  return list.find((p) => p.id === id) || null;
}

/**
 * (MỚI) Lấy sản phẩm theo sellerId: /product/searchBySeller/{sellerId}
 */
export async function fetchProductsBySeller(authFetch, sellerId) {
  if (!sellerId) return [];
  const doFetch = authFetch || fetch;
  const url = `${
    API_CONFIG.baseUrl
  }/product/searchBySeller/${encodeURIComponent(sellerId)}`;
  const res = await doFetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return Array.isArray(data?.result) ? data.result : [];
}

/**
 * (Giữ tương thích cũ) Tạo map productId -> sizes[] từ VARIANTS
 * Kết quả dùng để hiển thị nhanh: size là nhãn ghép từ options
 * { [productId]: [{ size: "Color:Black / Size:41", price, quantity }] }
 */
export async function getSizesMapFor(productIds = [], authFetch) {
  const all = await fetchProducts(authFetch);
  const set = new Set(productIds);
  const map = {};
  all.forEach((p) => {
    if (!set.has(p.id)) return;
    const variants = Array.isArray(p.variants) ? p.variants : [];
    map[p.id] = variants.map((v) => ({
      size: Object.entries(v?.options || {})
        .map(([k, val]) => `${k}:${val}`)
        .join(" / "),
      price: Number(v?.price ?? 0),
      quantity: Number(v?.quantity ?? 0),
    }));
  });
  return map;
}

/**
 * (MỚI) Map productId -> variants[] (đầy đủ fields)
 * { [productId]: [{ options, price, compareAtPrice, quantity, available }] }
 */
export async function getVariantsMapFor(productIds = [], authFetch) {
  const all = await fetchProducts(authFetch);
  const set = new Set(productIds);
  const map = {};
  all.forEach((p) => {
    if (!set.has(p.id)) return;
    const variants = Array.isArray(p.variants) ? p.variants : [];
    map[p.id] = variants.map((v) => ({
      options: v?.options || {},
      price: Number(v?.price ?? 0),
      compareAtPrice: Number(v?.compareAtPrice ?? 0),
      quantity: Number(v?.quantity ?? 0),
      available: Boolean(v?.available ?? true),
    }));
  });
  return map;
}

/**
 * Xoá sản phẩm bởi seller (multipart/form-data)
 * @param {Function} authFetch  - fetch đã inject token (bắt buộc)
 * @param {string} productId    - id sản phẩm cần xoá
 * @param {string} reason       - lý do xoá
 * @returns {{code:number,message?:string,result?:any}}
 */
export async function deleteProductBySeller(authFetch, productId, reason = "") {
  const doFetch = authFetch || fetch;

  const form = new FormData();
  form.append("productId", String(productId));
  if (reason) form.append("reason", String(reason));

  const res = await doFetch(
    apiUrl(API_CONFIG.endpoints.deleteProductBySeller),
    {
      method: "POST",
      body: form,
    }
  );

  const data = await safeJson(res);
  if (!res.ok) {
    const msg =
      data?.message || (typeof data === "string" ? data : `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return data;
}

/**
 * Cập nhật sản phẩm (multipart/form-data) — THEO API MỚI
 * - product: object theo schema mới (BẮT BUỘC có "id")
 * - newImages: File[] ảnh mới để upload thêm
 * - LƯU Ý: mediaByOption.image phải là chuỗi chỉ số ("0","1",...) theo thứ tự file mới (nếu có)
 *
 * BE yêu cầu:
 *   form.append('product', JSON.stringify(product));
 *   form.append('images', file) // nhiều lần
 */
export async function updateProduct(authFetch, product, newImages = []) {
  if (!product?.id) throw new Error("Thiếu product.id để cập nhật.");

  const doFetch = authFetch || fetch;

  // Chuẩn hoá mediaByOption giống createProduct
  const normalized = { ...product };
  if (Array.isArray(normalized.mediaByOption)) {
    normalized.mediaByOption = normalizeMediaByOption(normalized.mediaByOption);
  }

  // (KHÔNG ép validate chặt số ảnh ở update để tránh case tham chiếu ảnh cũ/mới khác nhau)
  const formData = new FormData();
  formData.append("product", JSON.stringify(normalized));
  (newImages || []).forEach((file) => formData.append("images", file));

  const res = await doFetch(apiUrl(API_CONFIG.endpoints.updateProduct), {
    method: "POST",
    body: formData,
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data;
}

/**
 * Gửi duyệt lại sản phẩm (re-register) — multipart/form-data
 * - product: object (BẮT BUỘC có "id"); KHÔNG cần gửi status nếu BE không yêu cầu
 * - newImages: File[] ảnh mới để upload thêm (tuỳ chọn)
 *
 * Endpoint:
 *   POST /product/reregister
 *   form.append('product', JSON.stringify(product));
 *   form.append('images', file) // nhiều lần
 */
export async function reregisterProduct(authFetch, product, newImages = []) {
  if (!product?.id) throw new Error("Thiếu product.id để gửi duyệt lại.");

  const doFetch = authFetch || fetch;

  // Chuẩn hoá mediaByOption như các API khác
  const normalized = { ...product };
  if (Array.isArray(normalized.mediaByOption)) {
    normalized.mediaByOption = normalizeMediaByOption(normalized.mediaByOption);
  }

  const formData = new FormData();
  formData.append("product", JSON.stringify(normalized));
  (newImages || []).forEach((file) => formData.append("images", file));

  // Cho phép dùng endpoints.reregisterProduct nếu bạn có cấu hình; nếu không sẽ fallback
  const endpointPath =
    (API_CONFIG?.endpoints && API_CONFIG.endpoints.reregisterProduct) ||
    "/product/reregister";

  const res = await doFetch(apiUrl(endpointPath), {
    method: "POST",
    body: formData,
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data; // { code, message, result? }
}

/** Lấy chi tiết sản phẩm qua /product/searchByProduct/{id} */
export async function fetchProductDetail(authFetch, id) {
  if (!id) throw new Error("Thiếu id sản phẩm.");
  const doFetch = authFetch || fetch;
  const res = await doFetch(apiUrl(API_CONFIG.endpoints.productById(id)), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  // BE trả về { code, message, result: {...} }
  return data?.result || data;
}
/**
/**
 * Lấy danh sách sản phẩm bán chạy
 */
export async function fetchBestSellingProducts(authFetch) {
  const doFetch = authFetch || fetch;
  const res = await doFetch(
    apiUrl(API_CONFIG.endpoints.getBestSellingProducts),
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );
  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return Array.isArray(data?.result) ? data.result : [];
}
