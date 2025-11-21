// src/pages/buyer/checkout/OrderSuccess.jsx
"use client";

import { useEffect, useMemo, useRef, useState, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../../../styles/OrderSuccess.css";
import { AuthContext } from "../../../contexts/AuthContext";
import { API_CONFIG, apiUrl, trackPurchase } from "../../../config/api";
import { removeCartItemsBatch } from "../../../services/cartService";
import { createNotification } from "../../../services/notificationService";

/* ====== Utils hiển thị ====== */
const fmtVND = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n ?? 0);

const maskPhone = (p = "") => {
  const s = String(p).replace(/\s+/g, "");
  if (s.length < 4) return s;
  return `${"*".repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
};

const toPaymentEnum = (p) => (p === "cod" ? "CASH_ON_DELIVERY" : "BANK_TRANSFER");

/* ====== Helpers dựng options cho payload (đồng bộ với CheckoutPage) ====== */
const firstTruthy = (...vals) => vals.find((v) => v !== undefined && v !== null && String(v).trim() !== "");

const _readOptionFromObj = (obj, regex) => {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const k = Object.keys(obj).find((key) => regex.test(key));
    if (k) return obj[k];
  }
  return undefined;
};
const _readOptionFromArr = (arr, regex) => {
  if (!Array.isArray(arr)) return undefined;
  const f = arr.find((o) => regex.test(String(o?.name || o?.label || "")));
  return firstTruthy(f?.value, f?.selected, f?.optionValue);
};
const readOption = (it, regex) => {
  const fromObj =
    _readOptionFromObj(it?.options, regex) ?? _readOptionFromObj(it?.selectedOptions, regex);
  if (fromObj !== undefined) return fromObj;
  return _readOptionFromArr(it?.options, regex) ?? _readOptionFromArr(it?.selectedOptions, regex);
};

const getSelectedSize = (it) =>
  firstTruthy(readOption(it, /kích cỡ|kich co|kích thước|kich thuoc|size/i), it?.size, it?.variantSize, "");
const getSelectedColor = (it) =>
  firstTruthy(readOption(it, /màu sắc|mau sac|màu|mau|color|colour/i), it?.color, it?.colour, it?.colorName, "");

const normalizeKey = (k) => String(k || "").trim().toLowerCase();
const buildOptionsForPayload = (it) => {
  const base =
    (it && typeof it.options === "object" && it.options) ||
    (it && typeof it.selectedOptions === "object" && it.selectedOptions) ||
    {};

  const canonical = {};
  for (const [k, vRaw] of Object.entries(base)) {
    const v = String(vRaw ?? "").trim();
    const kk = normalizeKey(k);
    if (!v) continue;
    if (["size", "kích cỡ", "kích thước"].includes(kk)) canonical["Kích cỡ"] = v;
    else if (["màu sắc", "màu", "color", "colour"].includes(kk)) canonical["Màu sắc"] = v;
    else canonical[k] = v;
  }

  if (Object.keys(canonical).length === 0) {
    const size = String(getSelectedSize(it) || "").trim();
    const color = String(getSelectedColor(it) || "").trim();
    if (color) canonical["Màu sắc"] = color;
    if (size) canonical["Kích cỡ"] = size; // có thể là "FREE"
  }

  if (Object.keys(canonical).length === 0) canonical["Kích cỡ"] = "FREE";
  return canonical;
};

/* ====== Voucher complete endpoint ====== */
const VOUCHER_COMPLETE_PATH = "/voucher/complete";

/* ====== Hằng số ship ====== */
const SHIPPING_BASE_FEE = 30000;

/* Tính lại tổng theo draft */
function computeDraftTotals(draft) {
  const items = Array.isArray(draft?.items) ? draft.items : [];
  const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  const shippingFee = SHIPPING_BASE_FEE;

  const vouchers = draft?.selectedVouchers || {};
  const discount = Object.values(vouchers).reduce(
    (s, sv) => s + (Number(sv?.discountAmount) || 0),
    0
  );
  const net = Math.max(0, Math.round(subtotal + shippingFee - discount));
  return { subtotal: Math.round(subtotal), shippingFee, discount: Math.round(discount), net };
}

const sendOrderCreatedNotification = async (authFetch, { userId, orderId, totalAmount }) => {
  try {
    const content = {
      text: `Đơn hàng ${orderId} của bạn đã được tạo thành công.`,
      orderId: String(orderId),
      totalAmount: Number(totalAmount || 0),
      link: `/orders/${orderId}`,
    };
    await createNotification(authFetch, { userId, type: "MESSAGE", content });
  } catch (e) {
    console.warn("createNotification failed:", e?.message || e);
  }
};

export default function OrderSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const { authFetch } = useContext(AuthContext);

  // Ưu tiên state (COD). Nếu có draft chờ finalize thì để null để chạy finalize flow.
  const initialData = (() => {
    if (location?.state?.orderSuccess) return location.state.orderSuccess;

    const hasDraft = !!sessionStorage.getItem("pending_checkout_draft");
    if (hasDraft) return null;

    try {
      const raw = sessionStorage.getItem("last_order_success");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const [data, setData] = useState(initialData);
  const [fireworksActive, setFireworksActive] = useState(true);

  const completeVoucherUsage = async (userVoucherId) => {
    try {
      if (!userVoucherId) return;
      const url = apiUrl(`${VOUCHER_COMPLETE_PATH}/${encodeURIComponent(userVoucherId)}`);
      const res = await authFetch(url, { method: "GET", headers: { Accept: "application/json" } });
      await res.json().catch(() => ({}));
    } catch (e) {
      console.warn("Complete voucher usage lỗi:", e);
    }
  };

  // FINALIZE đơn nếu quay về từ VNPay (BE redirect /order-success)
  useEffect(() => {
    (async () => {
      let draft = null;
      try {
        draft = JSON.parse(sessionStorage.getItem("pending_checkout_draft") || "null");
      } catch {}

      // Không có draft → không phải luồng bank vừa thanh toán
      if (!draft) return;

      const paymentRef = draft.paymentRef || "";
      const finalizedKey = paymentRef ? `finalized_${paymentRef}` : "";

      // Chống F5 (đã finalize đơn này rồi)
      if (finalizedKey && sessionStorage.getItem(finalizedKey)) {
        const s = sessionStorage.getItem("last_order_success");
        if (s) setData(JSON.parse(s));
        return;
      }

      // Gom theo seller
      const groupMap = new Map();
      for (const it of draft.items || []) {
        let sellerId = it.sellerId;
        if (!sellerId && it.id && typeof it.id === "string") {
          const parts = it.id.split("-");
          if (parts.length >= 2) sellerId = parts[0];
        }
        if (!sellerId) throw new Error(`Item thiếu sellerId: ${JSON.stringify(it)}`);
        if (!groupMap.has(sellerId)) groupMap.set(sellerId, []);
        groupMap.get(sellerId).push(it);
      }

      // Build payloads (đính kèm voucherCode + các trường giá theo từng seller)
      const payloads = Array.from(groupMap.entries()).map(([sellerId, its]) => {
        const normItems = its.map((i) => ({
          productId: String(i.productId).trim(),
          options: buildOptionsForPayload(i), // ✅ GỬI OPTIONS, không gửi size rời
          quantity: Math.max(1, parseInt(i.qty ?? 1, 10)),
        }));

        // --- Tính tiền theo từng seller từ draft ---
        const sellerSubtotal = its.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
        const ship = SHIPPING_BASE_FEE;

        // Lấy voucher đã chọn cho seller này từ draft
        const sel = draft.selectedVouchers?.[sellerId] || {};
        const discount = Number(sel.discountAmount || 0);

        const clientTotal = Math.max(0, Math.round(sellerSubtotal + ship - discount));

        const p = {
          userId: String(draft.userId).trim(),
          sellerId: String(sellerId).trim(),
          items: normItems,
          paymentRef,
          // ✅ PaymentStatusEnum của BE là phương thức thanh toán, KHÔNG phải trạng thái đã trả
          paymentStatus: "BANK_TRANSFER",

          // Giá trị để BE lưu/đối soát
          shippingAddress: String(draft.address || "").trim(),
          phoneNumber: String(draft.recipientPhone || "").trim(),
          recipientName: String(draft.recipientName || "").trim(),
          subtotal: Math.round(sellerSubtotal),
          shippingFee: ship,
          discountAmount: Math.round(discount),
          totalAmount: clientTotal,

          // Gắn voucherCode nếu có (để có thể rollback khi hủy)
          ...(sel.code ? { voucherCode: sel.code } : {}),
        };

        if ((draft.note || "").trim()) p.notes = draft.note.trim();

        return p;
      });

      try {
        // Tạo đơn
        const results = [];
        for (const p of payloads) {
          const res = await authFetch(apiUrl("/order/createOrder"), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(p),
          });

          const txt = await res.text();
          let json = {};
          try {
            json = JSON.parse(txt);
          } catch {
            throw new Error(`Tạo đơn thất bại: ${txt}`);
          }
          if (!res.ok) {
            throw new Error(json.message || `Tạo đơn thất bại (HTTP ${res.status})`);
          }
          results.push(json);
        }

        // COMPLETE voucher đã apply (nếu có)
        const userVoucherIds =
          Object.values(draft.selectedVouchers || {})
            .map((sv) => sv?.userVoucherId)
            .filter(Boolean) || [];
        for (const uvid of userVoucherIds) {
          await completeVoucherUsage(uvid);
        }

        const orderIds = results.map((r) => r?.result?.id).filter(Boolean);
        const sumFromBE = results
          .map((r) => Number(r?.result?.totalAmount))
          .filter((n) => Number.isFinite(n) && n >= 0)
          .reduce((a, b) => a + b, 0);

        // === Quy tắc hiển thị tổng:
        // 1) Nếu BE đã trừ giảm: sumFromBE ≈ tổng sau giảm → dùng sumFromBE.
        // 2) Nếu BE chưa trừ: ta tự tính từ draft (subtotal + ship – discount).
        const draftTotals = computeDraftTotals(draft);

        const EPS = 1; // 1đ
        let finalTotal;
        if (Number.isFinite(sumFromBE) && Math.abs(sumFromBE - draftTotals.net) <= EPS) {
          finalTotal = Math.round(sumFromBE);
        } else if (Number.isFinite(sumFromBE) && sumFromBE < draftTotals.net) {
          finalTotal = Math.round(sumFromBE);
        } else {
          finalTotal = draftTotals.net;
        }

        // Thông báo tạo đơn sau thanh toán VNPay
        try {
          for (const r of results) {
            const oid = r?.result?.id;
            if (!oid) continue;
            const t = r?.result?.totalAmount;
            await sendOrderCreatedNotification(authFetch, {
              userId: String(draft.userId),
              orderId: oid,
              totalAmount: t ?? undefined,
            });
          }
        } catch {}

        // Tracking purchase
        try {
          for (const it of draft.items || []) {
            const pid = String(it.productId || it.id || "").trim();
            if (!pid) continue;
            const price = Number(it.price) || 0;
            const quantity = Number(it.qty) || 1;
            trackPurchase(draft.userId, pid, { price, quantity });
          }
        } catch (e) {
          console.warn("trackPurchase (VNPay) error:", e);
        }

        const built = {
          orderIds,
          total: finalTotal,
          paymentStatus: "BANK_TRANSFER",
          address: draft.address || "",
          phone: draft.recipientPhone || "",
          itemsCount: draft.items?.length || 0,
          etaText: draft.shipping === "fast" ? "5–10 ngày làm việc" : "7–20 ngày làm việc",
          subtotal: draftTotals.subtotal,
          discount: draftTotals.discount,
          shippingFee: draftTotals.shippingFee,
        };

        // Lưu & hiển thị
        sessionStorage.setItem("last_order_success", JSON.stringify(built));
        sessionStorage.removeItem("pending_checkout_draft");
        if (finalizedKey) sessionStorage.setItem(finalizedKey, "1");

        // ✅ DỌN CART SAU KHI TẠO ĐƠN THÀNH CÔNG (xóa theo options để khớp biến thể)
        try {
          const toRemove = (draft.items || []).map((i) => ({
            sellerId: i.sellerId || (typeof i.id === "string" ? i.id.split("-")[0] : ""),
            productId: i.productId,
            options: buildOptionsForPayload(i),
          }));
          await removeCartItemsBatch({ userId: draft.userId, items: toRemove });
        } catch (e) {
          console.warn("Xoá giỏ sau thanh toán lỗi:", e);
        }

        // ✅ Xoá checkout_items để Checkout không giữ đơn cũ
        sessionStorage.removeItem("checkout_items");

        setData(built);
      } catch (e) {
        console.error("Finalize order error:", e);
        // navigate("/orders", { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⛔ Đừng auto-redirect khi còn draft (đang finalize).
  useEffect(() => {
    if (data) return;
    const hasDraft = !!sessionStorage.getItem("pending_checkout_draft");
    if (hasDraft) return; // chờ finalize, không redirect

    const t = setTimeout(() => navigate("/orders", { replace: true }), 8000);
    return () => clearTimeout(t);
  }, [data, navigate]);

  // Pháo hoa
  useEffect(() => {
    if (!fireworksActive) return;
    const container = containerRef.current;
    if (!container) return;

    const colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#feca57", "#ff9ff3", "#54a0ff"];
    let fireworkInterval;

    const createFirework = () => {
      if (!containerRef.current || !fireworksActive) return;

      const firework = document.createElement("div");
      firework.className = "firework";
      firework.style.left = 20 + Math.random() * 60 + "%";
      firework.style.top = "100%";
      firework.style.background = colors[Math.floor(Math.random() * colors.length)];
      containerRef.current.appendChild(firework);

      setTimeout(() => {
        for (let i = 0; i < 20; i++) {
          const particle = document.createElement("div");
          particle.className = "firework-particle";
          particle.style.left = firework.style.left;
          particle.style.top = "30%";
          particle.style.background = colors[Math.floor(Math.random() * colors.length)];

          const angle = (i * 18 * Math.PI) / 180;
          const distance = 120 + Math.random() * 80;
          particle.style.setProperty("--dx", Math.cos(angle) * distance + "px");
          particle.style.setProperty("--dy", Math.sin(angle) * distance + "px");

          containerRef.current?.appendChild(particle);
          setTimeout(() => particle.remove(), 2000);
        }
      }, 800);

      setTimeout(() => firework.remove(), 2500);
    };

    createFirework();
    const t1 = setTimeout(createFirework, 600);
    const t2 = setTimeout(createFirework, 1200);
    fireworkInterval = setInterval(createFirework, 1500);

    return () => {
      clearInterval(fireworkInterval);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [fireworksActive]);

  useEffect(() => {
    const handleBeforeUnload = () => setFireworksActive(false);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Tracking cho luồng COD (đã có data, không có draft)
  useEffect(() => {
    if (!data) return;
    const hasDraft = !!sessionStorage.getItem("pending_checkout_draft");
    if (hasDraft) return;

    try {
      const raw = sessionStorage.getItem("checkout_items");
      if (!raw) return;
      const items = JSON.parse(raw);
      if (Array.isArray(items)) {
        items.forEach((it) => {
          const pid = String(it.productId || "").trim();
          const price = Number(it.price) || 0;
          const quantity = Number(it.qty) || 1;
          if (pid) trackPurchase(it.userId || null, pid, { price, quantity });
        });
      }
    } catch (e) {
      console.warn("trackPurchase (COD) error:", e);
    } finally {
      try {
        sessionStorage.removeItem("checkout_items");
      } catch {}
    }
  }, [data]);

  // Derived
  const orderIds = useMemo(() => (data?.orderIds ? data.orderIds : []), [data]);
  const orderCodeShort = useMemo(() => {
    if (!orderIds.length) return "";
    const id = String(orderIds[0]);
    return `#${id.slice(-8).toUpperCase()}`;
  }, [orderIds]);

  const total = data?.total ?? 0;
  const paymentStatus = data?.paymentStatus ?? "CASH_ON_DELIVERY";
  const address = data?.address ?? "";
  const phone = data?.phone ?? "";
  const etaText = data?.etaText ?? "";
  const itemsCount = data?.itemsCount ?? 0;

  // 🆕 Hiển thị Tổng phụ = subtotal + phí ship
  const shippingFeeShown = Number.isFinite(Number(data?.shippingFee))
    ? Math.round(Number(data.shippingFee))
    : SHIPPING_BASE_FEE;
  const subtotalPlusShip = Math.max(0, Math.round((Number(data?.subtotal) || 0) + shippingFeeShown));
  const discountShown = Math.max(0, Math.round(Number(data?.discount) || 0));

  const goOrders = () => {
    setFireworksActive(false);
    navigate("/orders");
  };
  const goHome = () => {
    setFireworksActive(false);
    navigate("/home");
  };

  // Loading UI khi chưa có data (đang finalize)
  if (!data) {
    return (
      <div className="theciu-success">
        <div className="theciu-success__container">
          <div className="theciu-success__card">
            <h1 className="theciu-success__title">Đang xác nhận thanh toán…</h1>
            <p className="theciu-success__subtitle">Vui lòng chờ trong giây lát.</p>
          </div>
        </div>
      </div>
    );
  }

  // UI chính
  return (
    <div className="theciu-success" ref={containerRef}>
      <div className="theciu-success__container">
        <div className="theciu-success__card">
          <div className="theciu-success__icon" aria-hidden>✓</div>

          <h1 className="theciu-success__title">Đặt hàng thành công</h1>

          <p className="theciu-success__subtitle">
            Cảm ơn bạn đã mua sắm tại <b>SHOPPING</b>.
          </p>

          <div className="theciu-success__meta">
            {orderIds.length > 0 && (
              <div className="theciu-success__row">
                <span className="theciu-success__label">Mã đơn</span>
                <span className="theciu-success__value theciu-code">
                  {orderCodeShort}
                  {orderIds.length > 1 && ` (+${orderIds.length - 1} đơn khác)`}
                </span>
              </div>
            )}

            {/* Tổng phụ (Tổng giá + phí ship) */}
            <div className="theciu-success__row">
              <span className="theciu-success__label">Tổng phụ</span>
              <span className="theciu-success__value">{fmtVND(subtotalPlusShip)}</span>
            </div>

            {/* Phiếu giảm giá */}
            <div className="theciu-success__row">
              <span className="theciu-success__label">Phiếu giảm giá</span>
              <span className="theciu-success__value">
                {discountShown > 0 ? `-${fmtVND(discountShown)}` : fmtVND(0)}
              </span>
            </div>

            <div className="theciu-success__row">
              <span className="theciu-success__label">Tổng thanh toán</span>
              <span className="theciu-success__value">{fmtVND(total)}</span>
            </div>

            <div className="theciu-success__row">
              <span className="theciu-success__label">Thanh toán</span>
              <span className="theciu-success__value">
                {paymentStatus === "CASH_ON_DELIVERY" ? "Thanh toán khi nhận hàng (COD)" : "Chuyển khoản ngân hàng"}
              </span>
            </div>

            {!!itemsCount && (
              <div className="theciu-success__row">
                <span className="theciu-success__label">Sản phẩm</span>
                <span className="theciu-success__value">{itemsCount} mặt hàng</span>
              </div>
            )}

            {etaText && (
              <div className="theciu-success__row">
                <span className="theciu-success__label">Dự kiến giao</span>
                <span className="theciu-success__value">{etaText}</span>
              </div>
            )}

            {(address || phone) && <div className="theciu-success__divider" />}

            {address && (
              <div className="theciu-success__row">
                <span className="theciu-success__label">Giao tới</span>
                <span className="theciu-success__value">{address}</span>
              </div>
            )}

            {phone && (
              <div className="theciu-success__row">
                <span className="theciu-success__label">Liên hệ</span>
                <span className="theciu-success__value">{maskPhone(phone)}</span>
              </div>
            )}
          </div>

          <div className="theciu-success__actions">
            <button className="theciu-btn theciu-btn--primary" onClick={goOrders}>
              Xem chi tiết đơn hàng
            </button>
            <button className="theciu-btn theciu-btn--ghost" onClick={goHome}>
              Tiếp tục mua sắm
            </button>
          </div>

          <p className="theciu-success__hint">
            Biên nhận đã được lưu trong mục <b>Đơn hàng</b>. Nếu cần hỗ trợ, vui lòng liên hệ CSKH.
          </p>
        </div>
      </div>
    </div>
  );
}
