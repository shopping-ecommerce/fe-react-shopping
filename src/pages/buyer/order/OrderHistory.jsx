// src/pages/OrderHistory.jsx
"use client";

import {
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../../../styles/OrderHistory.css";
import { AuthContext } from "../../../contexts/AuthContext";
import { fetchOrdersByUser, cancelOrder } from "../../../services/orders";
import { getMyProfile } from "../../../services/profile";
import { API_CONFIG, apiUrl } from "../../../config/api";
// 🆕 dùng chung service cập nhật trạng thái đơn
import { updateOrder } from "../../../services/orderActions";
import { showToast } from "../../../utils/toast";

const STATUS_MAP = {
  all: null,
  pending: "PENDING",
  confirmed: "CONFIRMED",
  shipping: "SHIPPED",
  delivered: "DELIVERED",
  cancelled: "CANCELLED",
};

const STATUS_VI = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPED: "Đang vận chuyển",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
};

const CANCEL_REASONS = [
  "Tôi muốn thay đổi địa chỉ giao hàng",
  "Tôi muốn thay đổi phương thức thanh toán",
  "Tôi muốn thay đổi sản phẩm/kích cỡ/màu",
  "Tôi đặt nhầm hoặc đặt trùng đơn",
  "Tôi tìm được giá tốt hơn ở nơi khác",
  "Thời gian giao hàng dự kiến quá lâu",
  "Shop yêu cầu hủy / Shop hết hàng",
  "Phí vận chuyển quá cao",
  "Tôi không còn nhu cầu mua nữa",
  "Lý do khác",
];

// Đổi dấu . thành , và kèm "₫"
const fmtVND = (n) => {
  const num = Number(n ?? 0);
  if (!Number.isFinite(num)) return "0₫";
  const s = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(
    Math.round(num)
  );
  return s.replace(/\./g, ",") + "₫";
};

// Format ngày giờ hiển thị theo vi-VN
const fmtDate = (iso) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso || "";
    return d.toLocaleString("vi-VN");
  } catch {
    return iso || "";
  }
};

const badgeClass = (status) => {
  switch (status) {
    case "PENDING":
      return "order-badge pending";
    case "CONFIRMED":
      return "order-badge confirmed";
    case "SHIPPED":
      return "order-badge shipping";
    case "DELIVERED":
      return "order-badge delivered";
    case "CANCELLED":
      return "order-badge cancelled";
    default:
      return "order-badge";
  }
};

// 🆕 Helper: hiển thị phân loại (size/color) từ options
// --- Helpers chuẩn hoá & thu thập option ---
const normalizeOptionKey = (key) => {
  const raw = String(key || "").trim();
  const lower = raw.toLowerCase();
  // alias phổ biến
  if (
    ["size", "kích cỡ", "kích thước", "kich co", "kich thuoc"].includes(lower)
  )
    return "Kích cỡ";
  if (["color", "màu", "màu sắc", "mau", "mau sac"].includes(lower))
    return "Màu sắc";
  // Viết hoa chữ cái đầu cho key còn lại
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const collectItemOptions = (item) => {
  const out = [];

  // 1) Ưu tiên map object: { "Dung tích": "1000ML", "Khối lượng": "10kg" }
  if (
    item &&
    item.options &&
    typeof item.options === "object" &&
    !Array.isArray(item.options)
  ) {
    for (const [k, v] of Object.entries(item.options)) {
      const val = String(v ?? "").trim();
      if (!val) continue;
      out.push([normalizeOptionKey(k), val]);
    }
  }

  // 2) Hỗ trợ dạng mảng: [{ optionKey, optionValue }] hoặc [{ key, value }]
  if (Array.isArray(item?.options)) {
    for (const node of item.options) {
      const k = node?.optionKey ?? node?.key;
      const v = node?.optionValue ?? node?.value;
      const key = normalizeOptionKey(k);
      const val = String(v ?? "").trim();
      if (!key || !val) continue;
      out.push([key, val]);
    }
  }

  // 3) Tương thích ngược trường đơn lẻ (nếu BE cũ không nhét vào options)
  const size = item?.size ?? item?.variantSize ?? null;
  const color = item?.color ?? item?.colorName ?? null;
  if (size && !out.some(([k]) => k === "Kích cỡ"))
    out.push(["Kích cỡ", String(size)]);
  if (color && !out.some(([k]) => k === "Màu sắc"))
    out.push(["Màu sắc", String(color)]);

  // Loại trùng key-value (nếu có)
  const seen = new Set();
  return out.filter(([k, v]) => {
    const key = `${k}::${v}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// 🆕 Hiển thị tất cả option theo dạng "Key: Value • Key2: Value2"
const variantLine = (item) => {
  const pairs = collectItemOptions(item);
  if (!pairs.length) return null;
  return pairs.map(([k, v]) => `${k}: ${v}`).join(" • ");
};

/* ===== Toast bus (fallback alert) ===== */
const getToastAPI = () => {
  const W = typeof window !== "undefined" ? window : globalThis;
  const bus = W.__appToastBus;
  return {
    success: (message, opts = {}) =>
      bus?.show
        ? bus.show({ type: "success", message, ...opts })
        : alert(message),
    error: (message, opts = {}) =>
      bus?.show
        ? bus.show({ type: "error", message, ...opts })
        : alert(message),
    info: (message, opts = {}) =>
      bus?.show ? bus.show({ type: "info", message, ...opts }) : alert(message),
  };
};
const Toast = getToastAPI();

// ————— Modal đánh giá cho từng sản phẩm trong đơn —————
function Star({ filled }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        d="M10 1.5l2.9 5.88 6.5.94-4.7 4.58 1.1 6.43L10 16.5 4.2 19.3l1.1-6.43L.6 8.32l6.5-.94L10 1.5z"
        fill={filled ? "#ffb400" : "none"}
        stroke="#ffb400"
      />
    </svg>
  );
}

function ItemReviewModal({
  open,
  onClose,
  onSubmitted,
  authFetch,
  userId,
  target, // { orderId, productId, productName, productImage }
}) {
  const MAX_FILES = 5;
  const fileInputRef = useRef(null);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [media, setMedia] = useState([]); // [{file: File, url: string}]
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = open && userId && target?.productId && target?.orderId;

  useEffect(() => {
    if (!open) {
      media.forEach((m) => URL.revokeObjectURL(m.url));
      setRating(5);
      setComment("");
      setMedia([]);
      setSubmitting(false);
    }
  }, [open]); // eslint-disable-line

  useEffect(() => {
    return () => {
      media.forEach((m) => URL.revokeObjectURL(m.url));
    };
  }, [media]);

  const handlePickClick = () => fileInputRef.current?.click();

  const handleFilesSelected = (e) => {
    const chosen = Array.from(e.target.files || []);
    if (!chosen.length) return;

    const onlyImages = chosen.filter((f) => f.type?.startsWith("image/"));
    if (!onlyImages.length) {
      e.target.value = "";
      return;
    }

    const existingKeys = new Set(
      media.map((m) => `${m.file.name}__${m.file.size}`)
    );
    const roomLeft = Math.max(0, MAX_FILES - media.length);
    const toAdd = [];

    for (const f of onlyImages) {
      const key = `${f.name}__${f.size}`;
      if (existingKeys.has(key)) continue;
      if (toAdd.length >= roomLeft) break;
      toAdd.push({ file: f, url: URL.createObjectURL(f) });
    }

    if (toAdd.length) setMedia((prev) => [...prev, ...toAdd]);
    e.target.value = "";
  };

  const removeMediaAt = (idx) => {
    setMedia((prev) => {
      const next = [...prev];
      const removed = next.splice(idx, 1)[0];
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
  };

  const submit = async () => {
    try {
      if (!canSubmit) return;
      setSubmitting(true);

      const req = {
        productId: target.productId,
        orderId: target.orderId,
        userId,
        rating: Number(rating),
        comment: comment.trim(),
      };

      const form = new FormData();
      form.append(
        "request",
        new Blob([JSON.stringify(req)], { type: "application/json" })
      );
      for (const m of media) form.append("files", m.file);

      const url = apiUrl("/feedback/review/create");
      const res = await authFetch(url, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.code !== 200) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      onSubmitted?.(data?.result);
      setSubmitting(false);
      onClose?.();
      Toast.success(`Đã gửi đánh giá${target?.productName ? ` cho “${target.productName}”` : ""}. Cảm ơn bạn!`);
    } catch (e) {
      setSubmitting(false);
      Toast.error(e?.message || "Gửi đánh giá thất bại");
    }
  };

  if (!open) return null;
  return (
    <div
      className="cancel-modal-backdrop"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
      }}
      onClick={() => !submitting && onClose?.()}
    >
      <div
        className="cancel-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 92vw)",
          background: "#fff",
          color: "#111",
          borderRadius: 12,
          border: "1px solid #e6e6e6",
          boxShadow: "0 12px 28px rgba(0,0,0,.18)",
        }}
      >
        <div
          className="cancel-modal-header"
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Đánh giá sản phẩm
          </h3>
          <button
            className="btn-outline"
            onClick={onClose}
            disabled={submitting}
          >
            Đóng
          </button>
        </div>

        <div
          className="cancel-modal-body"
          style={{ padding: "12px 16px", maxHeight: "65vh", overflow: "auto" }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 12,
              alignItems: "center",
            }}
          >
            <img
              src={target?.productImage}
              alt={target?.productName}
              style={{
                width: 56,
                height: 56,
                borderRadius: 8,
                objectFit: "cover",
                border: "1px solid #eee",
              }}
            />
            <div style={{ fontWeight: 600 }}>{target?.productName}</div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Chọn sao</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`rv-star-btn ${s <= rating ? "on" : ""}`}
                  onClick={() => setRating(s)}
                  title={`${s} sao`}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  <Star filled={s <= rating} />
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Bình luận</div>
            <textarea
              rows={3}
              placeholder="Chia sẻ trải nghiệm của bạn…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="order-search-input"
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div className="rv-upload">
            <div style={{ marginBottom: 6, fontWeight: 600 }}>
              Hình ảnh (tối đa 5)
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <button
                type="button"
                className="btn-outline"
                onClick={handlePickClick}
                disabled={media.length >= 5 || submitting}
                title={media.length >= 5 ? "Đã đạt tối đa" : "Chọn ảnh"}
              >
                Chọn ảnh
              </button>
              <div style={{ fontSize: 12, color: "#666" }}>
                Đã chọn {media.length}/5
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={handleFilesSelected}
            />

            {!!media.length && (
              <div className="rv-media-row">
                {media.map((m, idx) => (
                  <div key={idx} className="rv-thumb">
                    <img src={m.url} alt={m.file?.name || `image-${idx}`} />
                    <button
                      type="button"
                      className="rv-remove"
                      onClick={() => removeMediaAt(idx)}
                      title="Xóa ảnh này"
                      aria-label="Xóa ảnh"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className="cancel-modal-footer"
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #f0f0f0",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            className="btn-outline"
            onClick={onClose}
            disabled={submitting}
          >
            Hủy
          </button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={submitting || !canSubmit}
            title={submitting ? "Đang gửi..." : "Gửi đánh giá"}
          >
            {submitting ? "Đang gửi..." : "Gửi đánh giá"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrderHistory() {
  const { authFetch, isAuthenticated, authReady } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  // Xác định base path để điều hướng đúng layout
  const baseOrdersPath = location.pathname.startsWith("/account")
    ? "/account/orders"
    : "/orders";
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState([]);
  const [profileUserId, setProfileUserId] = useState(null);
  const [sellerNameMap, setSellerNameMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modal hủy
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // Modal review sản phẩm
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewedSet, setReviewedSet] = useState(() => new Set());

  const tabs = [
    { id: "all", label: "Tất cả" },
    { id: "pending", label: "Chờ xác nhận" },
    { id: "confirmed", label: "Đã xác nhận" },
    { id: "shipping", label: "Đang vận chuyển" },
    { id: "delivered", label: "Đã giao" },
    { id: "cancelled", label: "Đã hủy" },
  ];

  // 1) Lấy userId từ profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authReady || !isAuthenticated) return;
      try {
        const prof = await getMyProfile();
        const id = prof?.result?.id || null;
        if (!cancelled) setProfileUserId(id);
      } catch (e) {
        if (!cancelled) setProfileUserId(null);
        console.warn("[OrderHistory] getMyProfile failed:", e?.message || e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated]);

  // 2) Fetch orders theo tab
  const doFetch = useCallback(async () => {
    if (!authReady) return;
    if (!isAuthenticated || !profileUserId) {
      setOrders([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const status = STATUS_MAP[activeTab];
      let data = await fetchOrdersByUser(authFetch, profileUserId, status);
      if (activeTab === "all" && (!Array.isArray(data) || data.length === 0)) {
        const retry = await fetchOrdersByUser(
          authFetch,
          profileUserId,
          "CONFIRMED"
        );
        if (Array.isArray(retry) && retry.length > 0) data = retry;
      }
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Không thể tải danh sách đơn hàng");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, authFetch, authReady, isAuthenticated, profileUserId]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  // 3) Lấy tên shop theo sellerId
  useEffect(() => {
    if (!authReady) return;
    const sellerIds = Array.from(
      new Set((orders || []).map((o) => o.sellerId).filter(Boolean))
    );
    const missing = sellerIds.filter((id) => !sellerNameMap[id]);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (sid) => {
          try {
            const res = await fetch(
              apiUrl(API_CONFIG.endpoints.searchSellerBySellerId(sid)),
              {
                method: "GET",
                headers: { Accept: "application/json" },
              }
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
            const shop = data?.result || {};
            const name =
              shop.shop_name ||
              shop.shopName ||
              shop.name ||
              shop.storeName ||
              `Nhà bán #${(sid || "").slice(0, 8)}`;
            return [sid, name];
          } catch {
            return [sid, `Nhà bán #${(sid || "").slice(0, 8)}`];
          }
        })
      );
      if (!cancelled)
        setSellerNameMap((prev) => ({
          ...prev,
          ...Object.fromEntries(entries),
        }));
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, orders, sellerNameMap]);

  // --- Prefill reviewedSet từ server dựa vào các đơn DELIVERED ---
  useEffect(() => {
    if (!authReady || !isAuthenticated || !profileUserId || !orders?.length)
      return;

    const deliveredOrders = orders.filter((o) => o.status === "DELIVERED");
    if (deliveredOrders.length === 0) return;

    const uniquePids = Array.from(
      new Set(
        deliveredOrders
          .flatMap((o) => (Array.isArray(o.orderItems) ? o.orderItems : []))
          .map((it) => it.productId)
          .filter(Boolean)
      )
    );

    let cancelled = false;

    (async () => {
      try {
        const results = await Promise.all(
          uniquePids.map(async (pid) => {
            const url = apiUrl(`/feedback/review/${encodeURIComponent(pid)}`);
            const res = await authFetch(url, {
              headers: { Accept: "application/json" },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.code !== 200)
              throw new Error(data?.message || `HTTP ${res.status}`);
            return [pid, Array.isArray(data?.result) ? data.result : []];
          })
        );

        if (cancelled) return;

        const byPid = Object.fromEntries(results);
        const next = new Set(reviewedSet);
        for (const o of deliveredOrders) {
          const items = Array.isArray(o.orderItems) ? o.orderItems : [];
          for (const it of items) {
            const ridKey = `${o.id}:${it.productId}`;
            if (next.has(ridKey)) continue;

            const list = byPid[it.productId] || [];
            const hasMine = list.some(
              (rv) =>
                String(rv?.userId) === String(profileUserId) &&
                String(rv?.orderId) === String(o.id)
            );
            if (hasMine) next.add(ridKey);
          }
        }

        if (!cancelled) setReviewedSet(next);
      } catch (e) {
        console.warn("[prefill reviews] ", e?.message || e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated, profileUserId, orders]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;

    return orders.filter((o) => {
      const id = o?.id?.toLowerCase() || "";
      const phone = o?.phoneNumber?.toLowerCase?.() || "";
      const name = o?.recipientName?.toLowerCase?.() || "";

      const items = Array.isArray(o?.orderItems) ? o.orderItems : [];
      const inItems = items.some((it) => {
        const byName = (it?.productName || "").toLowerCase().includes(q);
        // gom text option cho search
        const optPairs = collectItemOptions(it);
        const optText = optPairs.map(([k, v]) => `${k} ${v}`).join(" ");
        const byOpt = optText.toLowerCase().includes(q);
        return byName || byOpt;
      });

      return id.includes(q) || phone.includes(q) || name.includes(q) || inItems;
    });
  }, [orders, searchQuery]);

  // ===== Cancel modal handlers =====
  const openCancelModal = (order) => {
    setCancelTarget(order);
    setSelectedReason("");
    setCustomReason("");
    setCancelError(null);
    setCancelModalOpen(true);
  };
  const closeCancelModal = () => {
    if (cancelling) return;
    setCancelModalOpen(false);
  };
  const effectiveReason = () => {
    if (selectedReason === "Lý do khác") return (customReason || "").trim();
    return selectedReason;
  };
  const confirmCancel = async () => {
    try {
      setCancelError(null);
      const reason = effectiveReason();
      if (!reason) {
        setCancelError("Vui lòng chọn hoặc nhập lý do hủy.");
        return;
      }
      if (!cancelTarget || !profileUserId) {
        setCancelError("Thiếu thông tin đơn hàng.");
        return;
      }
      setCancelling(true);
      await cancelOrder(authFetch, {
        orderId: cancelTarget.id,
        userId: profileUserId,
        reason,
      });
      setCancelling(false);
      setCancelModalOpen(false);
      await doFetch();
    } catch (e) {
      setCancelling(false);
      setCancelError(e?.message || "Hủy đơn hàng thất bại.");
    }
  };

  // ===== 🆕 Buyer xác nhận đã nhận hàng (SHIPPED -> DELIVERED) =====
  const markDelivered = async (order) => {
    try {
      if (!order?.id || !order?.sellerId) {
        alert("Thiếu thông tin đơn hàng để cập nhật.");
        return;
      }
      await updateOrder(authFetch, {
        orderId: order.id,
        sellerId: order.sellerId,
        status: "DELIVERED",
        reason: "",
      });
      await doFetch();
    } catch (e) {
      alert(e?.message || "Cập nhật trạng thái thất bại");
    }
  };

  // ======= Helper: lấy tổng đã áp dụng voucher =======
  const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const pickPaidTotal = (o) => {
    const sub = num(o.subtotal);
    const ship = num(o.shippingFee);
    const disc = num(o.discountAmount);
    const be = num(o.totalAmount);
    const computed = Math.max(0, Math.round(sub + ship - disc));
    if (disc > 0) return computed;
    if (be > 0) return Math.round(be);
    if (computed > 0) return computed;
    return 0;
  };

  // Actions theo trạng thái — nút bên TRÁI (cho toàn đơn)
  const renderActions = (o) => {
    switch (o.status) {
      case "PENDING":
        return (
          <div className="order-actions left">
            <button
              className="btn-outline danger"
              onClick={() => openCancelModal(o)}
            >
              Hủy đơn hàng
            </button>
          </div>
        );
      // 🆕 Khi đang vận chuyển, cho phép người dùng xác nhận đã nhận
      case "SHIPPED":
        return (
          <div className="order-actions left">
            <button className="btn-primary" onClick={() => markDelivered(o)}>
              Đã nhận hàng
            </button>
          </div>
        );
      default:
        return <div className="order-actions left" />;
    }
  };

  return (
    <div className="order-history-container">
      <div className="order-history-header">
        <h1>Đơn hàng của tôi</h1>
      </div>

      <div className="order-history-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`order-tab-button ${
              activeTab === tab.id ? "order-tab-active" : ""
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <div className="order-search-right">
          <input
            className="order-search-input"
            placeholder="Tìm mã đơn / sản phẩm / người nhận"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      <div className="order-history-content">
        {!authReady ? (
          <div className="order-empty-state">
            <p>Đang kiểm tra phiên đăng nhập…</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="order-empty-state">
            <p>Vui lòng đăng nhập để xem đơn hàng.</p>
          </div>
        ) : loading ? (
          <div className="order-empty-state">
            <p>Đang tải đơn hàng…</p>
          </div>
        ) : error ? (
          <div className="order-empty-state">
            <p className="order-error-text">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="order-empty-state">
            <p className="order-empty-text">Chưa có đơn hàng</p>
          </div>
        ) : (
          <div className="order-list">
            {filtered.map((o) => {
              const items = Array.isArray(o.orderItems) ? o.orderItems : [];
              const total = pickPaidTotal(o);
              const statusText = STATUS_VI[o.status] || o.status;
              const sellerName =
                sellerNameMap[o.sellerId] ||
                `Nhà bán #${(o.sellerId || "").slice(0, 8)}`;

              return (
                <div key={o.id} className="order-card">
                  <div className="order-topbar">
                    <div className="order-shop">
                      <span className="shop-name">{sellerName}</span>
                    </div>
                    <div className="order-status">
                      <span className={badgeClass(o.status)}>{statusText}</span>
                    </div>
                  </div>

                  <div
                    className="order-meta"
                    style={{ padding: "0 16px", color: "#666", fontSize: 13 }}
                  >
                    <span>Ngày đặt: {fmtDate(o.createdTime)}</span>
                    {" · "}
                    <span>Người nhận: {o.recipientName || "-"}</span>
                    {" · "}
                    <span>Thanh toán: {o.paymentStatus || "-"}</span>
                  </div>

                  <div className="order-items modern">
                    {items.map((it, idx) => {
                      const reviewedKey = `${o.id}:${it.productId}`;
                      const reviewed = reviewedSet.has(reviewedKey);

                      return (
                        <div
                          key={idx}
                          className="order-line"
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(`${baseOrdersPath}/${o.id}`)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ")
                              navigate(`${baseOrdersPath}/${o.id}`);
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <div className="line-left">
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <img
                                className="thumb"
                                src={it.productImage}
                                alt={it.productName}
                              />

                              {o.status === "DELIVERED" && (
                                <button
                                  className="btn-primary"
                                  style={{ padding: "6px 10px", fontSize: 13 }}
                                  onClick={(e) => {
                                    e.stopPropagation(); // ⛔ không trigger điều hướng
                                    setReviewOpen(true);
                                    setReviewTarget({
                                      orderId: o.id,
                                      productId: it.productId,
                                      productName: it.productName,
                                      productImage: it.productImage,
                                    });
                                  }}
                                  disabled={reviewed || !profileUserId}
                                  title={
                                    reviewed
                                      ? "Bạn đã đánh giá sản phẩm này"
                                      : !profileUserId
                                      ? "Thiếu userId"
                                      : "Đánh giá sản phẩm"
                                  }
                                >
                                  {reviewed ? "Đã đánh giá" : "Đánh giá"}
                                </button>
                              )}
                            </div>

                            <div className="meta">
                              <div className="name">{it.productName}</div>
                              <div className="variant">
                                {variantLine(it) || "-"}
                              </div>

                              <div className="qty">x{it.quantity}</div>
                            </div>
                          </div>

                          <div className="line-right">
                            <div className="price-now">
                              {fmtVND(it.unitPrice)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="order-bottom">
                    {renderActions(o)}
                    <div className="order-total right">
                      <span>Thành tiền:</span>
                      <strong className="total-amount pill">
                        {fmtVND(total)}
                      </strong>
                    </div>
                  </div>

                  {o.notes && (
                    <div className="order-note">Ghi chú: {o.notes}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== Cancel Modal ===== */}
      {cancelModalOpen && (
        <div
          className="cancel-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="cancel-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px, 92vw)",
              background: "#fff",
              color: "#111",
              borderRadius: 12,
              border: "1px solid #e6e6e6",
              boxShadow: "0 12px 28px rgba(0,0,0,.18)",
            }}
          >
            <div
              className="cancel-modal-header"
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid #f0f0f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3
                id="cancel-modal-title"
                style={{ margin: 0, fontSize: 18, fontWeight: 700 }}
              >
                Hủy đơn hàng
              </h3>
              <button
                className="btn-outline"
                onClick={closeCancelModal}
                style={{ padding: "6px 10px" }}
              >
                Đóng
              </button>
            </div>

            <div
              className="cancel-modal-body"
              style={{
                padding: "12px 16px",
                maxHeight: "65vh",
                overflow: "auto",
              }}
            >
              <div style={{ marginBottom: 10, color: "#444" }}>
                Vui lòng chọn lý do hủy cho đơn{" "}
                <strong>{cancelTarget?.id}</strong>:
              </div>

              <div
                className="cancel-reasons"
                style={{ display: "grid", gap: 8 }}
              >
                {CANCEL_REASONS.map((r) => (
                  <label
                    key={r}
                    className={`reason-row ${
                      selectedReason === r ? "active" : ""
                    }`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      border:
                        "1px solid " +
                        (selectedReason === r ? "#e02424" : "#e6e6e6"),
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all .18s ease",
                      background: "#fff",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#e02424";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor =
                        selectedReason === r ? "#e02424" : "#e6e6e6";
                    }}
                  >
                    <input
                      type="radio"
                      name="cancel-reason"
                      value={r}
                      checked={selectedReason === r}
                      onChange={() => setSelectedReason(r)}
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>

              {selectedReason === "Lý do khác" && (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    rows={3}
                    placeholder="Nhập lý do hủy..."
                    className="order-search-input"
                    style={{ width: "100%", resize: "vertical" }}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                  />
                </div>
              )}

              {cancelError && (
                <div className="order-error-text" style={{ marginTop: 10 }}>
                  {cancelError}
                </div>
              )}
            </div>

            <div
              className="cancel-modal-footer"
              style={{
                padding: "12px 16px",
                borderTop: "1px solid #f0f0f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ color: "#666", fontSize: 13 }}>
                Sau khi hủy, đơn hàng không thể khôi phục.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn-outline"
                  onClick={closeCancelModal}
                  disabled={cancelling}
                >
                  Thoát
                </button>
                <button
                  className="btn-primary"
                  onClick={confirmCancel}
                  disabled={cancelling}
                  title={cancelling ? "Đang hủy..." : "Hủy đơn hàng"}
                >
                  {cancelling ? "Đang hủy..." : "Hủy đơn hàng"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Review Modal (per item) ===== */}
      <ItemReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onSubmitted={() => {
          if (reviewTarget?.orderId && reviewTarget?.productId) {
            const key = `${reviewTarget.orderId}:${reviewTarget.productId}`;
            setReviewedSet((prev) => new Set(prev).add(key));
          }
        }}
        authFetch={authFetch}
        userId={profileUserId}
        target={reviewTarget}
      />
    </div>
  );
}
