// src/pages/seller/orders/OrderModals.jsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "../../../styles/BwModals.css";

/* ========== Portal helper (lock scroll + render to body) ========== */
function ModalPortal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}

/* ========== Helpers chung ========== */
const fmtVnd = (n) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Math.round(Number(n || 0)));

/* ========== Helpers: chuẩn hóa & bóc tách options ========== */
const _normalize = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getColorHex = (name) => {
  const n = _normalize(name);
  if (!n) return null;
  if (n.includes("đen") || n.includes("den")) return "#111111";
  if (n.includes("trắng") || n.includes("trang")) return "#ffffff";
  if (n.includes("nâu") || n.includes("nau")) return "#6b4f3f";
  if (n.includes("xám") || n.includes("xam")) return "#9aa0a6";
  if (n.includes("đỏ") || n.includes("do")) return "#d93025";
  if (n.includes("vàng") || n.includes("vang")) return "#fbbc04";
  if (n.includes("hồng") || n.includes("hong")) return "#ff6aa0";
  if (n.includes("tím") || n.includes("tim")) return "#8e44ad";
  if (n.includes("navy")) return "#001f3f";
  if (n.includes("xanh dương") || n.includes("duong")) return "#1976d2";
  if (n.includes("xanh lá") || n.includes("la") || n.includes("luc"))
    return "#2fa84f";
  return null; // không rõ -> chỉ viền
};

const extractVariants = (item) => {
  const opts =
    item?.options && typeof item.options === "object" ? item.options : {};
  let size = null;
  let color = null;
  const others = [];

  for (const [k, v] of Object.entries(opts)) {
    const nk = _normalize(k);
    if (["kích cỡ", "kich co", "size"].some((x) => nk.includes(x))) size = v;
    else if (
      ["màu sắc", "mau sac", "mau", "color"].some((x) => nk.includes(x))
    )
      color = v;
    else others.push([k, v]);
  }

  // Fallback nếu không có trong options
  size = size ?? item?.size ?? item?.productVariant?.size ?? null;
  color = color ?? item?.color ?? item?.productVariant?.color ?? null;

  return { size, color, others };
};

/* ========== List sản phẩm (options dạng chip + swatch) ========== */
const ProductList = ({ items }) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <div className="om-empty">Không có sản phẩm trong đơn.</div>;
  }

  return (
    <div className="om-list">
      {items.map((it, idx) => {
        const { size, color, others } = extractVariants(it);
        const colorHex = getColorHex(color);

        return (
          <div key={idx} className="om-item">
            <div className="om-thumb">
              <img
                src={
                  it?.productVariant?.imageUrl ||
                  it?.product?.thumbnail ||
                  it?.productImage ||
                  it?.imageUrl ||
                  "https://via.placeholder.com/88x88?text=IMG"
                }
                alt={it?.productName || "product"}
              />
            </div>

            <div className="om-meta">
              <div className="om-title">{it?.productName || "Sản phẩm"}</div>

              {/* Hàng chip phân loại */}
              <div className="om-variants-row">
                {size && (
                  <span className="om-chip om-chip-variant" title={`Kích cỡ: ${size}`}>
                    <span className="om-k">Kích cỡ:</span>
                    <b className="om-v">{String(size)}</b>
                  </span>
                )}

                {color && (
                  <span className="om-chip om-chip-variant" title={`Màu sắc: ${color}`}>
                    <span className="om-k">Màu:</span>
                    <span
                      className="om-swatch"
                      style={{
                        background: colorHex || "transparent",
                        borderColor: colorHex ? "rgba(0,0,0,.12)" : "#ddd",
                      }}
                      aria-hidden="true"
                    />
                    <b className="om-v">{String(color)}</b>
                  </span>
                )}

                {others.map(([k, v], i) => (
                  <span
                    key={`${k}-${i}`}
                    className="om-chip om-chip-variant"
                    title={`${k}: ${v}`}
                  >
                    <span className="om-k">{k}:</span>
                    <b className="om-v">{String(v)}</b>
                  </span>
                ))}
              </div>

              {/* SL/Giá chip đồng bộ */}
              <div className="om-variants-row">
                <span className="om-chip om-chip-qty" title="Số lượng">
                  <span className="om-k">SL:</span>
                  <b className="om-v">{it?.quantity ?? 1}</b>
                </span>

                <span className="om-chip om-chip-price" title="Đơn giá">
                  <span className="om-k">Giá:</span>
                  <b className="om-v">{fmtVnd(it?.unitPrice ?? it?.price)}</b>
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const OrderSummary = ({ order }) => (
  <div className="om-summary">
    <div>
      <b>Mã đơn:</b> {order?.id}
    </div>
    <div>
      <b>Khách hàng:</b> {order?.recipientName || "—"}
    </div>
    <div>
      <b>Ngày đặt:</b> {order?.createdTime?.slice(0, 10) || "—"}
    </div>
  </div>
);

/* ========== Modal: XÁC NHẬN ĐƠN ========== */
export function ConfirmOrderModal({ order, onClose, onSubmit }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = useMemo(
    () => (Array.isArray(order?.orderItems) ? order.orderItems : []),
    [order]
  );

  return (
    <ModalPortal>
      <div className="om-overlay" onClick={onClose}>
        <div
          className="om-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="om-header">
            <h3>Xác nhận đơn hàng</h3>
            <button className="om-x" onClick={onClose} aria-label="Đóng">
              ×
            </button>
          </div>

          <div className="om-body">
            <OrderSummary order={order} />
            <ProductList items={items} />

            <div className="om-total">
              <div>
                <span>Tạm tính:</span>
                <b>{fmtVnd(order?.subtotal)}</b>
              </div>
              <div>
                <span>Giảm giá:</span>
                <b>-{fmtVnd(order?.discountAmount)}</b>
              </div>
              <div>
                <span>Phí vận chuyển:</span>
                <b>{fmtVnd(order?.shippingFee)}</b>
              </div>
              <div className="om-grand">
                <span>Thanh toán:</span>
                <b>
                  {fmtVnd(
                    order?.totalAmount ??
                      (order?.subtotal -
                        (order?.discountAmount || 0) +
                        (order?.shippingFee || 0))
                  )}
                </b>
              </div>
            </div>
          </div>

          <div className="om-footer">
            <button className="om-btn om-outline" onClick={onClose}>
              Trở lại
            </button>
            <button className="om-btn om-solid" onClick={onSubmit}>
              Xác nhận đơn hàng
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

/* ========== Modal: HỦY ĐƠN ========== */
const DEFAULT_REASONS = [
  "Hết hàng",
  "Sản phẩm lỗi",
  "Giá niêm yết sai",
  "Khách yêu cầu hủy",
  "Địa chỉ giao không hợp lệ",
  "Không liên lạc được với khách",
  "Thiếu nhân sự xử lý",
  "Lý do vận chuyển",
];

export function CancelOrderModal({ order, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = useMemo(
    () => (Array.isArray(order?.orderItems) ? order.orderItems : []),
    [order]
  );

  const finalReason = (other?.trim() ? other.trim() : reason)?.trim();

  const handleSubmit = () => {
    if (!finalReason) {
      alert("Vui lòng chọn hoặc nhập lý do hủy.");
      return;
    }
    onSubmit(finalReason);
  };

  return (
    <ModalPortal>
      <div className="om-overlay" onClick={onClose}>
        <div
          className="om-modal om-cancel-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="om-header">
            <h3>Hủy đơn hàng</h3>
            <button className="om-x" onClick={onClose} aria-label="Đóng">
              ×
            </button>
          </div>

          {/* phần đầu giống confirm: summary + list items */}
          <div className="om-body om-cancel-body">
            <OrderSummary order={order} />
            <ProductList items={items} />

            {/* Lý do hủy */}
            <div className="om-reasons">
              <div className="om-reasons-title">Chọn lý do hủy</div>
              <div className="om-reasons-grid">
                {DEFAULT_REASONS.map((r) => (
                  <label key={r} className="om-radio">
                    <input
                      type="radio"
                      name="cancel-reason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>

              <div className="om-other">
                <label htmlFor="other">Lý do khác</label>
                <textarea
                  id="other"
                  rows={3}
                  placeholder="Nhập lý do khác…"
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="om-footer">
            <button className="om-btn om-outline" onClick={onClose}>
              Trở lại
            </button>
            <button className="om-btn om-danger" onClick={handleSubmit}>
              Hủy đơn hàng
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
