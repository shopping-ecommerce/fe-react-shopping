// src/config/api.js
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:8888/shopping/api",
  endpoints: {
    // Auth
    register: "/authentication/register",
    verifyOtp: "/authentication/verifyOTP",
    login: "/authentication/login-email-password",
    logout: "/authentication/logout",

    // Profile
    getMyProfile: "/info/profiles/getMyProfile",
    updateProfile: "/info/profiles/updateProfile",
    getUserByAccountId: (accountId) => `/users/search/${accountId}`,
    updateAvatar: "/info/profiles/updateAvatar",

    // Address
    addAddress: "/info/profiles/address/add",
    deleteAddress: "/info/profiles/address/delete",
    setDefaultAddress: "/info/profiles/address/default",
    updateAddress: "/info/profiles/address/update",

    // Seller
    registerSeller: "/info/sellers/registrationSeller",
    searchSellerByUserId: (userId) =>
      `/info/sellers/searchByUserId/${encodeURIComponent(userId)}`,
    searchSellerBySellerId: (sellerId) =>
      `/info/sellers/searchBySellerId/${sellerId}`,
    /** 👇 THÊM DÒNG NÀY */
    updateSellerInfo: "/info/sellers/updateInfSeller",

    // Product
    categories: "/product/categories",
    createProduct: "/product/create",
    getProducts: "/product/getProducts",
    searchBySeller: (sellerId) =>
      `/product/searchBySeller/${encodeURIComponent(sellerId)}`,
    fileValidateMany: "/file/s3/validate-many",
    deleteProductBySeller: "/product/deleteProductBySeller",
    updateProduct: "/product/update",
    productById: (id) => `/product/searchByProduct/${encodeURIComponent(id)}`,

    productView: (id) => `/product/view/${encodeURIComponent(id)}`,
    getBestSellingProducts: "/product/getBestSellingProducts",

    // Cart (đều ở cổng 8888)
    cartAdd: "/cart/add",
    cartUpdateByUser: (userId) => `/cart/${userId}/update`,
    cartSummary: (userId) => `/cart/${userId}/summary`,
    cartRemoveBatch: (userId) => `/cart/${userId}/items/batch`,

    // ★ Favorites
    favoriteAdd: "/info/profiles/favorite/add", // POST body { user_id, product_id }
    favoriteRemove: "/info/profiles/favorite/remove", // POST body { user_id, product_id }
    favoriteGetByUser: (userId) => `/info/profiles/favorite/${userId}`, // GET (Bearer token)

    // search
    /** ⭐️ Thêm dòng này: */
    searchByCategory: (categoryId) =>
      `/product/searchByCategory/${encodeURIComponent(categoryId)}`,
    searchProducts: (term) =>
      `/product/search?query=${encodeURIComponent(term)}`,
    searchSuggest: (prefix) =>
      `/product/suggest?prefix=${encodeURIComponent(prefix)}`,
    // 👇 NEW: public profile theo userId
    getPublicProfileByUserId: (userId) =>
      `/info/profiles/${encodeURIComponent(userId)}`,
    // search-by-image (multipart/form-data)
    searchByImageMulti: "/gemini/index/search-by-image-multi",

    // order
    // ⭐ Orders
    getOrdersByUser: (userId) => `/order/user/${encodeURIComponent(userId)}`,
    cancelOrder: "/order/cancelOrder",
    ordersBySeller: (sellerId) =>
      `/order/seller/${encodeURIComponent(sellerId)}`,
    updateOrder: "/order/updateOrder",
    getOrderById: (orderId) => `/order/${encodeURIComponent(orderId)}`,

    // chat
    chat: "/chat-ai/chat",

    // review
    reviewsByProduct: (productId) =>
      `/feedback/review/${encodeURIComponent(productId)}`, // GET (yêu cầu token)
    reviewCreate: "/feedback/review/create",

    // 💳 Wallet + VNPay (đã chuẩn hoá, không còn trùng key)
    walletBalance: (id) => `/payment/wallet/${encodeURIComponent(id)}/balance`,

    // Tạo ví – BE nhận ?userId=..., ta cho 2 alias để dễ dùng ở FE
    walletCreateByUser: (userId) =>
      `/payment/wallet/create?userId=${encodeURIComponent(userId)}`,
    walletCreateBySeller: (sellerId) =>
      `/payment/wallet/create?userId=${encodeURIComponent(sellerId)}`,

    // (Nếu muốn dùng 1 hàm duy nhất, dùng walletCreate và truyền id của user hoặc seller)
    walletCreate: (id) =>
      `/payment/wallet/create?userId=${encodeURIComponent(id)}`,

    // Lịch sử giao dịch (phân trang)
    walletTransactions: (id, { page = 0, size = 10 } = {}) =>
      `/payment/wallet/${encodeURIComponent(
        id
      )}/transactions?page=${encodeURIComponent(
        page
      )}&size=${encodeURIComponent(size)}`,

    // Rút tiền
    walletWithdraw: (id) =>
      `/payment/wallet/${encodeURIComponent(id)}/withdraw`,

    // VNPay – chỉ giữ 1 bản duy nhất
    vnPayUrl: ({ amount, userId, bankCode, orderId }) =>
      `/payment/vn-pay?amount=${encodeURIComponent(
        amount
      )}&userId=${encodeURIComponent(userId)}&bankCode=${encodeURIComponent(
        bankCode
      )}&orderId=${encodeURIComponent(orderId)}`,

    // voucher
    // 👇 CẬP NHẬT ENDPOINTS CHO VOUCHER
    createVoucher: "/voucher/create", // POST - Chính xác theo API bạn cung cấp
    vouchersBySeller: (sellerId) =>
      `/voucher/seller/${encodeURIComponent(sellerId)}`, // GET (Giả định)
    updateVoucher: (voucherId) => `/voucher/${encodeURIComponent(voucherId)}`, // PUT (Giả định)
    deleteVoucher: (voucherId) => `/voucher/${encodeURIComponent(voucherId)}`, // DELETE (Giả định)
    // 👇 NEW: lấy tất cả voucher của seller (yêu cầu token)
    vouchersBySellerAll: (sellerId) =>
      `/voucher/seller/all/${encodeURIComponent(sellerId)}`,

    // ⭐️ Các endpoint voucher bạn đang dùng ở Checkout
    voucherUsable: ({ userId, sellerId, orderAmount }) =>
      `/voucher/usable-vouchers?userId=${encodeURIComponent(
        userId
      )}&sellerId=${encodeURIComponent(
        sellerId
      )}&orderAmount=${encodeURIComponent(orderAmount)}`, // GET

    voucherValidate: "/voucher/validate", // POST body { voucherCode, userId, orderAmount, shippingFee, sellerId }

    voucherApply: "/voucher/apply", // POST body { voucherId, userId, orderId, discountAmount, orderAmount }

    // GET complete theo applyId (theo mô tả "GET: truyền vào token và ...")
    voucherComplete: (applyId) =>
      `/voucher/complete/${encodeURIComponent(applyId)}`,

    vouchersForSeller: (sellerId) =>
      `/voucher/seller/all/${encodeURIComponent(sellerId)}`,

    voucherClaim: ({ voucherCode, userId }) =>
      `/voucher/claim?voucherCode=${encodeURIComponent(
        voucherCode
      )}&userId=${encodeURIComponent(userId)}`,

    //notification
    notificationCreate: "/notification/create", // POST
    notificationsByUser: (userId, { page = 0, size = 20 } = {}) =>
      `/notification/user/${encodeURIComponent(
        userId
      )}?page=${page}&size=${size}`, // GET
    notificationUnreadCount: (userId) =>
      `/notification/user/${encodeURIComponent(userId)}/unread-count`, // GET
    notificationMarkAllRead: (userId) =>
      `/notification/user/${encodeURIComponent(userId)}/mark-all-as-read`, // POST
    notificationRead: (id) => `/notification/${encodeURIComponent(id)}/read`, // PATCH

    //search
    semanticSearchGemini: "/gemini/search/search",
    semanticRecommendForProduct: (productId, topK = "10\n") =>
      `/gemini/recommend/for-product/${encodeURIComponent(
        productId
      )}?top_k=${encodeURIComponent(String(topK))}`,

    //đề xuất
    geminiTrackEvent: "/gemini/events/track",
    geminiTrack: "/gemini/events/track", // POST
    recommendByUser: (userId) =>
      `/gemini/recommend/user/${encodeURIComponent(userId)}`,

    // ★ Product statistics: KPI & bảng (không tham số ngày)
    productStatisticsBySeller: (sellerId) =>
      `/product/statistics/seller/${encodeURIComponent(sellerId)}`,

    // ★ Order statistics theo khoảng thời gian (để vẽ biểu đồ)
    orderStatisticsBySeller: (sellerId, { startDate, endDate }) =>
      `/order/order-statistics/seller/${encodeURIComponent(
        sellerId
      )}?startDate=${encodeURIComponent(
        startDate
      )}&endDate=${encodeURIComponent(endDate)}`,

    //report violations
    reportsByUserSafe: (userId) =>
      `/feedback/report/by-user-safe/${encodeURIComponent(userId)}`,

    //policy user
    policiesLatest: "/chat-ai/policies/latest",
  },
};

export const apiUrl = (path) => `${API_CONFIG.baseUrl}${path}`;

// ⭐ Danh sách ngân hàng VN tĩnh (phổ biến)
export const VN_BANKS = [
  { name: "Vietcombank", code: "VCB" },
  { name: "VietinBank", code: "CTG" },
  { name: "BIDV", code: "BIDV" },
  { name: "Agribank", code: "AGR" },
  { name: "Techcombank", code: "TCB" },
  { name: "ACB", code: "ACB" },
  { name: "Sacombank", code: "STB" },
  { name: "MB Bank", code: "MB" },
  { name: "VPBank", code: "VPB" },
  { name: "TPBank", code: "TPB" },
  { name: "VIB", code: "VIB" },
  { name: "HDBank", code: "HDB" },
  { name: "SHB", code: "SHB" },
  { name: "Eximbank", code: "EIB" },
  { name: "SCB", code: "SCB" },
  { name: "OCB", code: "OCB" },
  { name: "PVcomBank", code: "PVCB" },
  { name: "SeABank", code: "SEAB" },
  { name: "MSB", code: "MSB" },
  { name: "Nam A Bank", code: "NAB" },
];

// api.js - PHIÊN BẢN ĐÃ SỬA
function trackProductEvent(userId, productId, type = "view", metadata = {}) {
  if (!userId || !productId || !type) {
    console.warn("[Track] Thiếu tham số:", { userId, productId, type });
    return;
  }

  const url = apiUrl(API_CONFIG.endpoints.geminiTrackEvent);
  const payload = JSON.stringify({
    user_id: String(userId),
    product_id: String(productId),
    type: String(type),
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  });

  console.log("[Track] Gửi sự kiện:", { url, type, userId, productId }); // 🔍 DEBUG

  // 🔧 Lấy token nếu có
  const token = localStorage.getItem("access_token");

  // Phương pháp 1: sendBeacon (không chặn, phù hợp cho tracking)
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      // ⚠️ sendBeacon không hỗ trợ custom headers
      const ok = navigator.sendBeacon(
        url,
        new Blob([payload], { type: "application/json" })
      );
      if (ok) {
        console.log("[Track] ✅ Đã gửi qua sendBeacon"); // 🔍 DEBUG
        return;
      }
    }
  } catch (err) {
    console.warn("[Track] sendBeacon thất bại:", err);
  }

  // Phương pháp 2: fetch với headers và xác thực
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // 🔧 Thêm token nếu có
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  fetch(url, {
    method: "POST",
    headers,
    body: payload,
    keepalive: true, // Quan trọng cho các request khi trang đóng
    credentials: "include", // Bao gồm cookies
  })
    .then((res) => {
      if (!res.ok) {
        console.error(`[Track] ❌ HTTP ${res.status}:`, res.statusText);
        return res.text().then((text) => {
          console.error("[Track] Nội dung lỗi:", text);
        });
      }
      console.log("[Track] ✅ Đã gửi qua fetch"); // 🔍 DEBUG
      return res.json();
    })
    .then((data) => {
      if (data) console.log("[Track] Phản hồi:", data);
    })
    .catch((err) => {
      console.error("[Track] ❌ Lỗi fetch:", err);
    });
}

// Exports với log cải tiến
export function trackProductView(userId, productId, metadata = {}) {
  console.log("[Track] 👁️ Xem sản phẩm"); // 🔍 DEBUG
  trackProductEvent(userId, productId, "view", metadata);
}

export const trackAddToCart = (userId, productId, metadata = {}) => {
  console.log("[Track] 🛒 Thêm vào giỏ"); // 🔍 DEBUG
  trackProductEvent(userId, productId, "cart", metadata);
};

export const trackPurchase = (userId, productId, { price, quantity } = {}) => {
  console.log("[Track] 💳 Mua hàng"); // 🔍 DEBUG
  trackProductEvent(userId, productId, "purchase", {
    ...(Number.isFinite(price) ? { price } : {}),
    ...(Number.isFinite(quantity) ? { quantity } : {}),
  });
};
