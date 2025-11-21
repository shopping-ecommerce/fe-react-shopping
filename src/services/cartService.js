import { API_CONFIG, apiUrl } from "../config/api";
import { createAuthFetch } from "./auth";

/* =========================
   COMMON HELPERS
========================= */

/** Chuẩn hoá key options về chuẩn VI: size→"Kích cỡ", color→"Màu sắc", giữ nguyên các key khác */
function normalizeOptionKeysVI(opts) {
  if (!opts || typeof opts !== "object") return null;
  const out = {};
  for (const [k, vRaw] of Object.entries(opts)) {
    const val = String(vRaw ?? "").trim();
    if (!val) continue;
    const kk = String(k).trim().toLowerCase();
    if (["size", "kích cỡ", "kích thước"].includes(kk)) out["Kích cỡ"] = val;
    else if (["color", "màu", "màu sắc"].includes(kk)) out["Màu sắc"] = val;
    else out[k] = val; // các option khác: "Dung tích", "Chất liệu", ...
  }
  return Object.keys(out).length ? out : null;
}

async function fetchProfileIds(authFetch) {
  const doFetch = authFetch || createAuthFetch();
  const profileUrl = apiUrl(API_CONFIG.endpoints.getMyProfile);
  const res = await doFetch(profileUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.message || `HTTP ${res.status}: Không lấy được profile`
    );
  }
  const result = data?.result ?? data ?? {};
  const profileId = result?.id ?? data?.id ?? null;
  const accountId = result?.account_id ?? data?.account_id ?? null;
  if (!profileId && !accountId) {
    throw new Error("Không tìm thấy id/account_id trong profile");
  }
  return { profileId, accountId };
}

async function fetchCurrentUserId(authFetch) {
  const { profileId, accountId } = await fetchProfileIds(authFetch);
  return profileId || accountId;
}

export async function getCurrentUserId() {
  const authFetch = createAuthFetch();
  return fetchCurrentUserId(authFetch);
}

/** Lấy size & color từ options (khoá chuẩn "Kích cỡ", "Màu sắc") */
function extractSizeColor(options) {
  const opt = options || {};
  const size = opt["Kích cỡ"] ?? opt["Size"] ?? opt["size"] ?? "";
  const color = opt["Màu sắc"] ?? opt["Color"] ?? opt["color"] ?? "";
  return { size: String(size || ""), color: String(color || "") };
}

function makeKey({ sellerId, productId, color, size }) {
  return `${sellerId}-${productId}-${color || "NA"}-${size || "FREE"}`;
}

/* =========================
   MAPPERS
========================= */

function mapItemsArrayToUI(result) {
  const items = (result?.items || []).map((it) => {
    const { size, color } = extractSizeColor(it.options);
    const uniqueKey =
      it.uniqueKey ||
      makeKey({
        sellerId: it.sellerId,
        productId: it.productId,
        color,
        size,
      });

    return {
      uniqueKey,
      sellerId: it.sellerId,
      sellerName: it.sellerName || "Shop",
      productId: it.productId,
      productName: it.productName || "Sản phẩm",
      productImage: it.productImage,
      options: it.options || null,
      size,
      color,
      quantity: Number(it.quantity ?? 1),
      unitPrice: Number(it.unitPrice ?? 0),
      totalPrice: Number(it.totalPrice ?? 0),
    };
  });

  const subtotal = Number(
    result?.subtotal ?? items.reduce((s, i) => s + i.totalPrice, 0)
  );
  const totalDiscount = Number(result?.totalDiscount ?? 0);
  const totalShipping = Number(
    result?.estimatedShipping ?? result?.totalShipping ?? 0
  );
  const finalAmount = Number(
    result?.totalAmount ?? subtotal + totalShipping - totalDiscount
  );

  const mapped = {
    items,
    totals: {
      totalItems: Number(
        result?.totalItems ?? items.reduce((s, i) => s + i.quantity, 0)
      ),
      totalSellers: new Set(items.map((i) => i.sellerId)).size,
      subtotal,
      totalShipping,
      totalDiscount,
      finalAmount,
      canCheckout: items.length > 0,
      checkoutMessage: result?.checkoutMessage ?? "Ready to checkout",
    },
  };
  mapped.flatItems = mapped.items;
  return mapped;
}

export function mapCartSummaryToUI(summary) {
  const items = [];
  (summary?.sellerSummaries || []).forEach((seller) => {
    (seller.items || []).forEach((it) => {
      const { size, color } = extractSizeColor(it.options);
      items.push({
        uniqueKey: makeKey({
          sellerId: seller.sellerId,
          productId: it.productId,
          color,
          size,
        }),
        sellerId: seller.sellerId,
        sellerName: seller.sellerName || "Shop",
        productId: it.productId,
        productName: it.productName || "Sản phẩm",
        productImage: it.productImage,
        options: it.options || null,
        size,
        color,
        quantity: Number(it.quantity ?? 1),
        unitPrice: Number(it.unitPrice ?? 0),
        totalPrice: Number(
          it.totalPrice ?? Number(it.unitPrice ?? 0) * Number(it.quantity ?? 1)
        ),
      });
    });
  });

  const subtotal = Number(
    summary?.subtotal ?? items.reduce((s, i) => s + i.totalPrice, 0)
  );
  const totalShipping = Number(summary?.totalShipping ?? 0);
  const totalDiscount = Number(summary?.totalDiscount ?? 0);
  const finalAmount = Number(
    summary?.finalAmount ?? subtotal + totalShipping - totalDiscount
  );

  const mapped = {
    items,
    totals: {
      totalItems: Number(
        summary?.totalItems ?? items.reduce((s, i) => s + i.quantity, 0)
      ),
      totalSellers: Number(
        summary?.totalSellers ?? new Set(items.map((i) => i.sellerId)).size
      ),
      subtotal,
      totalShipping,
      totalDiscount,
      finalAmount,
      canCheckout: summary?.canCheckout ?? items.length > 0,
      checkoutMessage: summary?.checkoutMessage ?? "Ready to checkout",
    },
  };
  mapped.flatItems = mapped.items;
  return mapped;
}

export function mapCartResultToUI(result) {
  if (Array.isArray(result?.sellerSummaries)) return mapCartSummaryToUI(result);
  if (Array.isArray(result?.items)) return mapItemsArrayToUI(result);
  return {
    items: [],
    flatItems: [],
    totals: {
      totalItems: 0,
      totalSellers: 0,
      subtotal: 0,
      totalShipping: 0,
      totalDiscount: 0,
      finalAmount: 0,
      canCheckout: false,
      checkoutMessage: "Giỏ trống",
    },
  };
}
export const mapCartResponseToUI = mapCartResultToUI;

/* =========================
   API CALLS
========================= */

export async function getCartSummary(userId) {
  const authFetch = createAuthFetch();
  let uid = userId;
  let aid = null;

  if (!uid) {
    const ids = await fetchProfileIds(authFetch);
    uid = ids.profileId || ids.accountId;
    aid = ids.accountId;
  }

  const tryIds = [uid, aid].filter(Boolean);
  let lastErr = null;

  for (const id of tryIds) {
    const endpoint = apiUrl(
      API_CONFIG.endpoints.cartSummary(encodeURIComponent(id))
    );
    const res = await authFetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data?.code === 200 || data?.result || data?.code === 0)) {
      return data;
    }
    lastErr = new Error(
      data?.message || `HTTP ${res.status}: Không thể lấy giỏ hàng`
    );
  }
  throw lastErr || new Error("Không thể lấy giỏ hàng");
}

/** PUT/update: dùng VI cho options */
function buildOptionsPayloadVI({ size, color }) {
  const opt = {};
  const s = String(size || "").trim();
  const c = String(color || "").trim();
  if (s && s !== "FREE") opt["Kích cỡ"] = s;
  if (c && c !== "NA") opt["Màu sắc"] = c;
  return Object.keys(opt).length ? opt : null;
}

/** PUT /cart/{uid}/update */
async function putUpdateCartOnce({ uid, body, authFetch }) {
  const endpoint = apiUrl(
    API_CONFIG.endpoints.cartUpdateByUser(encodeURIComponent(uid))
  );
  return authFetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
}

/** PUT với fallback ID */
async function putUpdateCartWithFallback({ prefUid, altUid, body, authFetch }) {
  const first = await putUpdateCartOnce({ uid: prefUid, body, authFetch });
  if (first.ok) return first;

  let needsRetry = first.status === 404;
  if (!needsRetry) {
    try {
      const errData = await first.clone().json();
      const msg = String(errData?.message || "").toLowerCase();
      if (msg.includes("user not found")) needsRetry = true;
    } catch {}
  }

  if (!needsRetry || !altUid || altUid === prefUid) return first;

  const body2 = { ...body, userId: altUid };
  const second = await putUpdateCartOnce({
    uid: altUid,
    body: body2,
    authFetch,
  });
  return second;
}

/** Cập nhật số lượng */
export async function updateCartQuantity({
  productId,
  sellerId,
  quantity,
  userId,
  options, // 👈 thêm
  size = "", // legacy fallback
  color = "", // legacy fallback
}) {
  const authFetch = createAuthFetch();

  let prefUid = userId || null;
  let altUid = null;
  const ids = await fetchProfileIds(authFetch);
  if (!prefUid) prefUid = ids.profileId || ids.accountId;
  altUid =
    ids.accountId && ids.accountId !== prefUid ? ids.accountId : ids.profileId;

  const body = {
    userId: prefUid,
    productId,
    sellerId,
    quantity: Number(quantity) || 1,
    // ✅ ưu tiên options hiện có; nếu thiếu thì mới fallback size/color
    options:
      options && Object.keys(options).length
        ? options
        : buildOptionsPayloadVI({ size, color }),
  };

  const res = await putUpdateCartWithFallback({
    prefUid,
    altUid,
    body,
    authFetch,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data?.code !== 200 && !data?.result && data?.code !== 0)) {
    throw new Error(
      data?.message || `HTTP ${res.status}: Cập nhật giỏ hàng thất bại`
    );
  }
  return data;
}

/** Đổi size (chuẩn hoá về originalOptions/options) */
export async function updateCartSize({
  productId,
  sellerId,
  fromSize,
  toSize,
  quantity,
  userId,
  color = "",
}) {
  const originalOptions = buildOptionsPayloadVI({
    size: fromSize || "FREE",
    color,
  });
  const options = buildOptionsPayloadVI({ size: toSize || "FREE", color });
  return updateCartVariant({
    userId,
    productId,
    sellerId,
    quantity,
    originalOptions,
    options,
  });
}

/** Đổi biến thể (color/size) theo chuẩn Postman: originalOptions + options) */
export async function updateCartVariant({
  userId,
  productId,
  sellerId,
  quantity,
  // ưu tiên truyền trực tiếp originalOptions/options
  originalOptions,
  options,
  // hoặc có thể truyền các field rời (sẽ được gom lại):
  size,
  color,
  originalSize,
  originalColor,
}) {
  const authFetch = createAuthFetch();

  // Lấy userId ưu tiên từ tham số; fallback profile/account id
  const ids = await fetchProfileIds(authFetch);
  const prefUid = userId || ids.profileId || ids.accountId;
  const altUid =
    ids.accountId && ids.accountId !== prefUid ? ids.accountId : ids.profileId;

  // Nếu chưa có original/options thì build từ các field rời
  const origOpts =
    originalOptions ??
    buildOptionsPayloadVI({
      size: originalSize ?? size ?? "FREE",
      color: originalColor ?? color ?? "",
    });
  const nextOpts =
    options ??
    buildOptionsPayloadVI({ size: size ?? "FREE", color: color ?? "" });

  const body = {
    userId: prefUid,
    productId,
    sellerId,
    quantity: Number(quantity) || 1,
    originalOptions: origOpts,
    options: nextOpts,
  };

  const res = await putUpdateCartWithFallback({
    prefUid,
    altUid,
    body,
    authFetch,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data?.code !== 200 && !data?.result && data?.code !== 0)) {
    throw new Error(
      data?.message || `HTTP ${res.status}: Cập nhật biến thể thất bại`
    );
  }
  return data;
}

/** Xoá nhiều item (batch) — chỉ gửi key tiếng Việt để match BE */
export async function removeCartItemsBatch({ userId, items }) {
  if (!Array.isArray(items) || items.length === 0)
    throw new Error("No items to remove");

  const authFetch = createAuthFetch();
  const ids = await fetchProfileIds(authFetch);

  // Giữ đầy đủ options: ưu tiên i.options, nếu trống ghép từ size/color
  const normalized = items.map((i) => {
    const raw =
      i.options && Object.keys(i.options).length
        ? i.options
        : {
            ...(i.size ? { "Kích cỡ": String(i.size) } : {}),
            ...(i.color ? { "Màu sắc": String(i.color) } : {}),
          };
    const hasOpts = raw && Object.keys(raw).length > 0;
    return {
      productId: i.productId,
      sellerId: i.sellerId,
      ...(hasOpts ? { options: raw } : {}), // ⬅️ rỗng thì bỏ hẳn
    };
  });

  const tryIds = [userId, ids.profileId, ids.accountId].filter(Boolean);
  let lastErr = null;

  // 1) Thử DELETE batch
  for (const id of tryIds) {
    const endpoint = apiUrl(
      API_CONFIG.endpoints.cartRemoveBatch(encodeURIComponent(id))
    );
    try {
      const res = await authFetch(endpoint, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ items: normalized }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;

      if (res.status === 404) {
        lastErr = new Error(
          data?.message || "Cart not found with this userId, thử ID khác…"
        );
        continue;
      }
      if (res.status === 405 || res.status === 501) {
        lastErr = new Error(data?.message || "Batch delete not implemented");
        break;
      }
      lastErr = new Error(
        data?.message || `HTTP ${res.status}: Xoá sản phẩm thất bại`
      );
      continue;
    } catch (e) {
      lastErr = e;
      continue;
    }
  }

  // 2) Fallback: PUT quantity=0 từng item
  const prefUid = tryIds[0];
  const altUid = tryIds.find((x) => x && x !== prefUid);

  for (const it of normalized) {
    try {
      const body = {
        userId: prefUid,
        productId: it.productId,
        sellerId: it.sellerId,
        quantity: 0,
        ...(it.options && Object.keys(it.options).length
          ? { options: it.options } // ⬅️ giữ nguyên full options (Dung tích/Khối lượng/…)
          : {
              options: buildOptionsPayloadVI({
                size: it?.options?.["Kích cỡ"],
                color: it?.options?.["Màu sắc"],
              }),
            }),
      };
      const res = await putUpdateCartWithFallback({
        prefUid,
        altUid,
        body,
        authFetch,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
    } catch (e) {
      lastErr = e;
    }
  }

  try {
    return await getCartSummary(prefUid);
  } catch {
    if (lastErr) throw lastErr;
    throw new Error("Xoá sản phẩm thất bại");
  }
}

/** Xoá 1 item: dùng batch */
export async function removeCartItem({
  userId,
  sellerId,
  productId,
  options,
  size,
  color,
}) {
  const opt =
    options && Object.keys(options).length
      ? options
      : {
          ...(size ? { "Kích cỡ": String(size) } : {}),
          ...(color ? { "Màu sắc": String(color) } : {}),
        };
  return removeCartItemsBatch({
    userId,
    items: [{ sellerId, productId, options: opt }],
  });
}

/** POST: thêm vào giỏ (FE) */
export async function addToCartFE({
  userId,
  product,
  quantity,
  options,
  authFetch,
}) {
  const doAuthFetch = authFetch || createAuthFetch();
  let uid = userId;
  if (!uid) {
    const ids = await fetchProfileIds(doAuthFetch);
    uid = ids.profileId || ids.accountId;
    if (!uid) throw new Error("Không tìm thấy id trong profile");
  }

  const pid = product?.id || product?._id;
  const sid = product?.sellerId || product?.seller_id;
  if (!pid || !sid) {
    throw new Error("Thiếu productId hoặc sellerId");
  }

  const body = {
    userId: uid,
    productId: pid,
    sellerId: sid,
    sellerName: product?.sellerName || product?.seller?.name || "",
    quantity: Number(quantity) || 1,
    options: options && Object.keys(options).length ? options : null,
  };

  const res = await doAuthFetch(apiUrl(API_CONFIG.endpoints.cartAdd), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn("addToCartFE request body:", body);
    throw new Error(
      data?.message || `HTTP ${res.status}: Invalid request body`
    );
  }
  return data;
}
