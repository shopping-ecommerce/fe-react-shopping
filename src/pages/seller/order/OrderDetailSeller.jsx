"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, NavLink } from "react-router-dom";
import { AuthContext } from "../../../contexts/AuthContext";
import { fetchOrderDetail } from "../../../services/sellerOrders";
import { updateOrder } from "../../../services/orderActions";
import "../../../styles/orderDetailSeller.css";

const fmtVND = (n) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Math.round(Number(n || 0)));

const fmtDate = (s) => (s ? new Date(s).toLocaleString("vi-VN") : "—");

const statusLabel = (s) => {
  const map = {
    PENDING: "Chờ xác nhận",
    CONFIRMED: "Đã xác nhận",
    SHIPPED: "Đang vận chuyển",
    DELIVERED: "Đã giao hàng",
    CANCELLED: "Đã hủy",
  };
  return map[s] || s || "—";
};

const paymentInfo = (method) => {
  const s = String(method || "").toUpperCase();
  switch (s) {
    case "BANK_TRANSFER":
      return { label: "Chuyển khoản ngân hàng", icon: "🏦" };
    case "COD":
    case "CASH_ON_DELIVERY":
      return { label: "Thanh toán khi nhận (COD)", icon: "💵" };
    case "CREDIT_CARD":
      return { label: "Thẻ tín dụng", icon: "💳" };
    case "DEBIT_CARD":
      return { label: "Thẻ ghi nợ", icon: "💳" };
    case "DIGITAL_WALLET":
      return { label: "Ví điện tử", icon: "📱" };
    default:
      return { label: s || "Không xác định", icon: "ℹ️" };
  }
};

/* ==== Helper cặp key/value ==== */
function KV({ k, v }) {
  return (
    <div className="od-kv">
      <span className="k">{k}:</span>
      <span className="v">{String(v ?? "—")}</span>
    </div>
  );
}

/* ==== Hiển thị toàn bộ options ==== */
function renderAllOptions(item) {
  const raw = item?.options ?? item?.orderItemOptions ?? item?.itemOptions;
  const chips = [];

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      chips.push([k, String(v ?? "").trim()]);
    }
  } else if (Array.isArray(raw)) {
    raw.forEach((o) => {
      const k =
        o?.optionKey ?? o?.key ?? o?.name ?? o?.label ?? o?.option_name ?? o?.optionName;
      const v = o?.optionValue ?? o?.value ?? o?.selected ?? o?.option_value ?? o?.optionValue;
      if (k != null) chips.push([k, String(v ?? "").trim()]);
    });
  }

  // fallback BE cũ
  if (item?.size != null) chips.push(["Kích cỡ", String(item.size)]);
  if (item?.color != null) chips.push(["Màu sắc", String(item.color)]);

  if (!chips.length) return <span className="od-chip od-chip-none">Không phân loại</span>;

  return (
    <div className="od-opts-wrap">
      {chips.map(([k, v], i) => (
        <span key={`${k}-${i}`} className="od-chip">
          <span className="k">{k}:</span> <b className="v">{v || "—"}</b>
        </span>
      ))}
    </div>
  );
}

export default function OrderDetailSeller() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { authFetch } = useContext(AuthContext) || {};

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const totals = useMemo(() => {
    const sub = Number(order?.subtotal ?? 0);
    const disc = Number(order?.discountAmount ?? 0);
    const ship = Number(order?.shippingFee ?? 0);
    const total =
      order?.totalAmount != null ? Number(order.totalAmount) : sub - disc + ship;
    return { sub, disc, ship, total };
  }, [order]);

  useEffect(() => {
    if (!authFetch || !orderId) return;
    let stop = false;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const detail = await fetchOrderDetail(authFetch, orderId);
        if (!stop) setOrder(detail);
      } catch (e) {
        if (!stop) setErr(e?.message || "Không tải được chi tiết đơn hàng");
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [authFetch, orderId]);

  const doUpdate = async (status, reason = "") => {
    try {
      await updateOrder(authFetch, {
        orderId,
        sellerId: order?.sellerId,
        status,
        reason,
      });
      const fresh = await fetchOrderDetail(authFetch, orderId);
      setOrder(fresh);
    } catch (e) {
      alert(e?.message || "Cập nhật đơn thất bại");
    }
  };

  const canConfirm = order?.status === "PENDING";
  const canCancel = order?.status === "PENDING";
  const canShip = order?.status === "CONFIRMED";

  const pay = paymentInfo(order?.paymentStatus || order?.paymentMethod);

  return (
    <div className="od-page">
      {/* Breadcrumb */}
      <div className="od-breadcrumb">
        <NavLink to="/seller/home">Trang chủ</NavLink>
        <span>›</span>
        <NavLink to="/seller/orders">Đơn hàng</NavLink>
        <span>›</span>
        <span>Chi tiết đơn</span>
      </div>

      {/* Shell */}
      <div className="od-shell">
        <div className="od-header">
          <div className="od-header-left">
            {/* Back icon đặt TRƯỚC tiêu đề */}
            <button
              className="om-btn om-outline om-icon"
              onClick={() => navigate(-1)}
              aria-label="Quay lại"
              title="Quay lại"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              </svg>
            </button>

            <h1>Chi tiết đơn hàng</h1>
            {order?.status && (
              <span className={`od-badge status-${String(order.status).toLowerCase()}`}>
                {statusLabel(order.status)}
              </span>
            )}
          </div>

          <div className="od-actions">
            {canConfirm && (
              <button className="om-btn om-black" onClick={() => doUpdate("CONFIRMED")}>
                Xác nhận
              </button>
            )}
            {canShip && (
              <button className="om-btn om-dark" onClick={() => doUpdate("SHIPPED")}>
                Giao hàng
              </button>
            )}
            {canCancel && (
              <button
                className="om-btn om-danger"
                onClick={() => {
                  const r = prompt("Nhập lý do hủy (bắt buộc):", "Khách yêu cầu hủy");
                  if (r && r.trim()) doUpdate("CANCELLED", r.trim());
                }}
              >
                Hủy đơn
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="od-empty">Đang tải…</div>
        ) : err ? (
          <div className="od-empty od-warn">⚠️ {err}</div>
        ) : !order ? (
          <div className="od-empty">Không tìm thấy đơn hàng</div>
        ) : (
          <div className="od-body">
            {/* Summary */}
            <div className="od-summary">
              <div><b>Trạng thái:</b> {statusLabel(order.status)}</div>
              <div><b>Thanh toán:</b> {pay.icon} {pay.label}</div>
              <div><b>Ngày đặt:</b> {fmtDate(order.modifiedTime)}</div>
            </div>

            {/* Người nhận */}
            <section className="od-card">
              <header className="od-card-h"><h3>Người nhận</h3></header>
              <div className="od-info-list">
                <div className="od-info-row">
                  <span className="label">Họ tên</span>
                  <span className="value">{order.recipientName || "—"}</span>
                </div>
                <div className="od-info-row">
                  <span className="label">SĐT</span>
                  <span className="value">{order.phoneNumber || "—"}</span>
                </div>
                <div className="od-info-row">
                  <span className="label">Địa chỉ</span>
                  <span className="value">{order.shippingAddress || "—"}</span>
                </div>
                <div className="od-info-row">
                  <span className="label">Ghi chú</span>
                  <span className="value">{order.notes ?? "—"}</span>
                </div>
              </div>
            </section>

            {/* Sản phẩm */}
            <section className="od-card">
              <header className="od-card-h"><h3>Sản phẩm</h3></header>

              <div className="od-list">
                {(order.orderItems || []).map((it, idx) => (
                  <div key={idx} className="od-item">
                    <div className="od-thumb">
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

                    <div className="od-meta">
                      <div className="od-title">{it?.productName || "Sản phẩm"}</div>

                      <div className="od-variants-row">
                        {renderAllOptions(it)}
                      </div>

                      <div className="od-variants-row">
                        <span className="od-chip od-chip-qty">
                          <span className="k">SL:</span>
                          <b className="v">{it?.quantity ?? 1}</b>
                        </span>
                        <span className="od-chip od-chip-price">
                          <span className="k">Giá:</span>
                          <b className="v">{fmtVND(it?.unitPrice ?? it?.price)}</b>
                        </span>
                        {"totalPrice" in it && (
                          <span className="od-chip od-chip-total">
                            <span className="k">Thành tiền:</span>
                            <b className="v">{fmtVND(it.totalPrice)}</b>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tổng tiền: 1 hàng ngang, Thanh toán nền đen */}
              <div className="od-total od-inline">
                <div className="od-total-item">
                  <span>Tạm tính</span><b>{fmtVND(totals.sub)}</b>
                </div>
                <div className="od-total-item">
                  <span>Giảm giá</span><b>-{fmtVND(totals.disc)}</b>
                </div>
                <div className="od-total-item">
                  <span>Phí vận chuyển</span><b>{fmtVND(totals.ship)}</b>
                </div>
                <div className="od-total-item od-grand od-grand-black">
                  <span>Thanh toán</span><b>{fmtVND(totals.total)}</b>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
