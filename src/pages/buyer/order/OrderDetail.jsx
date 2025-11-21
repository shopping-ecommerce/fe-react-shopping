"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "../../../styles/OrderDetail.css";
import { AuthContext } from "../../../contexts/AuthContext";
import { apiUrl, API_CONFIG } from "../../../config/api";
import { cancelOrder } from "../../../services/orders";
import { getMyProfile } from "../../../services/profile";

// ===== Helpers =====
const showToast = (text, type = "info", title = "") => {
  try {
    if (typeof window !== "undefined") {
      if (typeof window.toast === "function") {
        window.toast({ title, text, type });
        return;
      }
      window.dispatchEvent(
        new CustomEvent("app:toast", { detail: { title, text, type } })
      );
    }
  } catch {}
};

const fmtVND = (n) => {
  const num = Number(n ?? 0);
  if (!Number.isFinite(num)) return "0₫";
  const s = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(
    Math.round(num)
  );
  return s.replace(/\./g, ",") + "₫";
};

const fmtDate = (iso) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso || "";
    return d.toLocaleString("vi-VN");
  } catch {
    return iso || "";
  }
};

const STATUS_VI = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPED: "Đang vận chuyển",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
};

const PAYMENT_METHOD_VI = (method) => {
  const s = String(method || "")
    .toUpperCase()
    .trim();
  switch (s) {
    case "BANK_TRANSFER":
    case "TRANSFER":
      return "Chuyển khoản ngân hàng";
    case "COD":
    case "CASH_ON_DELIVERY":
      return "Thanh toán khi nhận (COD)";
    case "CREDIT_CARD":
      return "Thẻ tín dụng";
    case "DEBIT_CARD":
      return "Thẻ ghi nợ";
    case "DIGITAL_WALLET":
      return "Ví điện tử";
    case "VNPAY":
      return "VNPAY";
    case "MOMO":
      return "MoMo";
    case "ZALOPAY":
      return "ZaloPay";
    case "PAYPAL":
      return "PayPal";
    case "STRIPE":
      return "Stripe";
    case "WALLET":
      return "Ví nội bộ";
    default:
      // nếu BE trả text tiếng Việt sẵn thì giữ nguyên
      if (
        method &&
        /[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i.test(String(method))
      ) {
        return String(method);
      }
      return method ? String(method) : "Không xác định";
  }
};

const badgeClass = (status) => {
  switch (status) {
    case "PENDING":
      return "od-badge pending";
    case "CONFIRMED":
      return "od-badge confirmed";
    case "SHIPPED":
      return "od-badge shipping";
    case "DELIVERED":
      return "od-badge delivered";
    case "CANCELLED":
      return "od-badge cancelled";
    default:
      return "od-badge";
  }
};

// Hiển thị phân loại (size/color) từ options
const variantLine = (item) => {
  const opts = item?.options || {};
  const size =
    opts["Kích cỡ"] ??
    opts["Kich co"] ??
    opts.Size ??
    item?.size ??
    item?.variantSize ??
    item?.productVariant?.size ??
    null;

  const color =
    opts["Màu sắc"] ??
    opts["Mau sac"] ??
    opts.Color ??
    item?.color ??
    item?.colorName ??
    item?.productVariant?.color ??
    null;

  if (!size && !color) return null;
  const parts = [];
  if (size) parts.push(`Kích cỡ: ${String(size)}`);
  if (color) parts.push(`Màu sắc: ${String(color)}`);
  return parts.join(" • ");
};

// ⭐️ SVG sao
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

// ===== Modal đánh giá =====
function ItemReviewModal({
  open,
  onClose,
  onSubmitted,
  authFetch,
  userId,
  target,
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

      const url = apiUrl(
        API_CONFIG.endpoints.reviewCreate || "/feedback/review/create"
      );
      const res = await authFetch(url, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.code !== 200) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      onSubmitted?.(data?.result);
      setSubmitting(false);
      onClose?.();
      showToast("Đã gửi đánh giá. Cảm ơn bạn!", "success");
    } catch (e) {
      setSubmitting(false);
      showToast(e?.message || "Gửi đánh giá thất bại", "error");
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

// ===== Lý do hủy =====
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

// ===== Trang chi tiết đơn =====
export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const baseOrdersPath = location.pathname.startsWith("/account")
    ? "/account/orders"
    : "/orders";
  const { authFetch, isAuthenticated, authReady } = useContext(AuthContext);

  const [profileUserId, setProfileUserId] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Review modal
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewedSet, setReviewedSet] = useState(() => new Set());

  // Cancel modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [cancelError, setCancelError] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // ===== Load userId
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!authReady || !isAuthenticated) return;
      try {
        const prof = await getMyProfile();
        const id = prof?.result?.id || null;
        if (!cancel) setProfileUserId(id);
      } catch {
        if (!cancel) setProfileUserId(null);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [authReady, isAuthenticated]);

  // ===== Fetch order detail
  const fetchDetail = async () => {
    if (!authReady || !isAuthenticated || !orderId) return;
    try {
      setLoading(true);
      setErr("");
      const url = apiUrl(API_CONFIG.endpoints.getOrderById(orderId));
      const res = await authFetch(url, {
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data?.code !== 0 && data?.code !== 200)) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      setOrder(data?.result || null);
    } catch (e) {
      setErr(e?.message || "Không tải được chi tiết đơn hàng");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail(); // eslint-disable-next-line
  }, [authReady, isAuthenticated, orderId]);

  // ===== Prefill reviewedSet
  useEffect(() => {
    if (
      !authReady ||
      !isAuthenticated ||
      !profileUserId ||
      !order?.orderItems?.length
    )
      return;

    let cancelled = false;

    (async () => {
      try {
        const pids = Array.from(
          new Set(
            (order.orderItems || []).map((it) => it.productId).filter(Boolean)
          )
        );
        const results = await Promise.all(
          pids.map(async (pid) => {
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
        const next = new Set();
        for (const it of order.orderItems || []) {
          const list = byPid[it.productId] || [];
          const hasMine = list.some(
            (rv) =>
              String(rv?.userId) === String(profileUserId) &&
              String(rv?.orderId) === String(order.id)
          );
          if (hasMine) next.add(`${order.id}:${it.productId}`);
        }
        setReviewedSet(next);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated, profileUserId, order]);

  const totalPaid = useMemo(() => {
    if (!order) return 0;
    const sub = Number(order.subtotal || 0);
    const ship = Number(order.shippingFee || 0);
    const disc = Number(order.discountAmount || 0);
    const be = Number(order.totalAmount || 0);
    const computed = Math.max(0, Math.round(sub + ship - disc));
    if (disc > 0) return computed;
    if (be > 0) return Math.round(be);
    return computed;
  }, [order]);

  // ===== Cancel handlers
  const openCancelModal = () => {
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
      if (!order || !profileUserId) {
        setCancelError("Thiếu thông tin đơn hàng.");
        return;
      }
      setCancelling(true);
      await cancelOrder(authFetch, {
        orderId: order.id,
        userId: profileUserId,
        reason,
      });
      setCancelling(false);
      setCancelModalOpen(false);
      showToast("Đã hủy đơn hàng.", "success");
      await fetchDetail();
    } catch (e) {
      setCancelling(false);
      setCancelError(e?.message || "Hủy đơn hàng thất bại.");
      showToast(e?.message || "Hủy đơn hàng thất bại.", "error");
    }
  };

  if (!authReady)
    return (
      <div className="od-container">
        <div className="od-empty">Đang kiểm tra phiên đăng nhập…</div>
      </div>
    );
  if (!isAuthenticated)
    return (
      <div className="od-container">
        <div className="od-empty">Vui lòng đăng nhập.</div>
      </div>
    );
  if (loading)
    return (
      <div className="od-container">
        <div className="od-empty">Đang tải chi tiết đơn hàng…</div>
      </div>
    );
  if (err)
    return (
      <div className="od-container">
        <div className="od-error">{err}</div>
      </div>
    );
  if (!order)
    return (
      <div className="od-container">
        <div className="od-empty">Không tìm thấy đơn hàng.</div>
      </div>
    );

  const isCancelled = order.status === "CANCELLED";
  const isPending = order.status === "PENDING";
  const isDelivered = order.status === "DELIVERED";

  return (
    <div className="od-container">
      {/* Nút quay lại trên đầu */}
      <div className="od-topbar-row">
        <button
          className="od-back-btn od-invert"
          onClick={() => navigate(baseOrdersPath)}
          aria-label="Quay lại danh sách"
          title="Quay lại danh sách"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M15 18l-6-6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Quay lại</span>
        </button>
      </div>

      {/* Banner: CANCELLED */}
      {isCancelled && (
        <div className="od-banner-cancel">
          <div className="od-banner-title">Đã hủy đơn hàng</div>
          <div className="od-banner-sub">
            Mã đơn: <span className="od-code">{order.id}</span> • Thời gian:{" "}
            {fmtDate(order.modifiedTime || order.createdTime)}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="od-card od-top">
        <div className="od-top-left">
          <div className="od-title">Chi tiết đơn hàng</div>
          <div className="od-sub">
            <span>Mã đơn:</span> <span className="od-code">{order.id}</span>
          </div>
        </div>

        {/* Trạng thái + (nếu PENDING) nút hủy nằm cùng hàng */}
        <div className="od-top-right">
          <span className={badgeClass(order.status)}>
            {STATUS_VI[order.status] || order.status}
          </span>
          {isPending && (
            <button
              className="od-btn-danger od-btn-compact"
              onClick={openCancelModal}
            >
              Hủy đơn hàng
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="od-card">
        <div className="od-block-hd">Sản phẩm</div>
        <div className="od-items">
          {(order.orderItems || []).map((it, idx) => {
            const reviewedKey = `${order.id}:${it.productId}`;
            const reviewed = reviewedSet.has(reviewedKey);

            return (
              <div className="od-line" key={idx}>
                <div className="od-line-left">
                  <img
                    className="od-thumb"
                    src={it.productImage}
                    alt={it.productName}
                  />
                  <div className="od-line-meta">
                    <div className="od-name">{it.productName}</div>
                    <div className="od-variant">{variantLine(it) || "-"}</div>

                    <div className="od-qty">Số lượng: x{it.quantity}</div>
                  </div>
                </div>
                <div className="od-line-right">
                  <div className="od-price">{fmtVND(it.unitPrice)}</div>

                  {isDelivered && (
                    <div className="od-line-actions">
                      <button
                        className="btn-primary od-invert"
                        style={{ padding: "6px 10px", fontSize: 13 }}
                        onClick={() => {
                          setReviewTarget({
                            orderId: order.id,
                            productId: it.productId,
                            productName: it.productName,
                            productImage: it.productImage,
                          });
                          setReviewOpen(true);
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
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Shipping & Recipient */}
      <div className="od-grid">
        <div className="od-card">
          <div className="od-block-hd">Người nhận</div>
          <div className="od-kv">
            <span>Họ tên</span>
            <b>{order.recipientName || "-"}</b>
          </div>
          <div className="od-kv">
            <span>SĐT</span>
            <b>{order.phoneNumber || "-"}</b>
          </div>
          <div className="od-kv">
            <span>Địa chỉ</span>
            <b className="od-one-line">{order.shippingAddress || "-"}</b>
          </div>
        </div>
        <div className="od-card">
          <div className="od-block-hd">Thanh toán</div>
          <div className="od-kv">
            <span>Phương thức</span>
            <b>
              {PAYMENT_METHOD_VI(order.paymentMethod || order.paymentStatus)}
            </b>
          </div>

          <div className="od-kv">
            <span>Ngày đặt</span>
            <b>{fmtDate(order.createdTime)}</b>
          </div>
          <div className="od-kv">
            <span>Cập nhật</span>
            <b>{fmtDate(order.modifiedTime)}</b>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="od-card">
        <div className="od-block-hd">Tổng kết</div>
        <div className="od-kv">
          <span>Tạm tính</span>
          <b>{fmtVND(order.subtotal)}</b>
        </div>
        <div className="od-kv">
          <span>Giảm giá</span>
          <b>-{fmtVND(order.discountAmount)}</b>
        </div>
        <div className="od-kv">
          <span>Phí vận chuyển</span>
          <b>{fmtVND(order.shippingFee)}</b>
        </div>
        {/* Thành tiền + giá cùng một hàng */}
        <div className="od-total">
          <span>Thành tiền</span>
          <b className="od-pill">{fmtVND(totalPaid)}</b>
        </div>
        {order.notes && <div className="od-note">Ghi chú: {order.notes}</div>}
      </div>

      {/* Actions dưới cùng: bỏ nút hủy vì đã đưa lên header (giữ lại nếu bạn vẫn muốn) */}
      {/* <div className="od-actions">
        {order.status === "PENDING" && (
          <button className="od-btn-danger" onClick={openCancelModal}>
            Hủy đơn hàng
          </button>
        )}
      </div> */}

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
            zIndex: 1200,
          }}
          onClick={closeCancelModal}
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
              <button className="btn-outline" onClick={closeCancelModal}>
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
                Vui lòng chọn lý do hủy cho đơn <strong>{order?.id}</strong>:
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

      {/* Review modal */}
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
