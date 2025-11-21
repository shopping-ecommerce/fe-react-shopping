// src/pages/payment/VnpayCallback.jsx
"use client";

import { useEffect, useMemo, useState, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../config/api";
import { removeCartItemsBatch } from "../../services/cartService";
import { createNotification } from "../../services/notificationService";

const fmtVND = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n ?? 0);

// ===== HÀM PHỤ dùng lại y như CheckoutPage =====
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
  if (Object.keys(canonical).length === 0) canonical["Kích cỡ"] = "FREE";
  return canonical;
};

const toPaymentEnum = (p) => (p === "cod" ? "CASH_ON_DELIVERY" : "BANK_TRANSFER");

// ===== API phụ =====
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

const completeVoucherUsage = async (authFetch, userVoucherId) => {
  try {
    if (!userVoucherId) return;
    const url = apiUrl(`${"/voucher/complete"}/${encodeURIComponent(userVoucherId)}`);
    const res = await authFetch(url, { method: "GET", headers: { Accept: "application/json" } });
    await res.json().catch(() => ({}));
  } catch (e) {
    console.warn("Complete voucher usage lỗi:", e);
  }
};

export default function VnpayCallback() {
  const { authFetch } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const responseCode = qs.get("vnp_ResponseCode");    // "00" = success
  const paymentRef   = qs.get("vnp_TxnRef");          // chính là orderId (paymentRef) bạn đã truyền lên BE
  const txnNo        = qs.get("vnp_TransactionNo");   // số giao dịch VNPay (chỉ để tham khảo UI/log)

  const [state, setState] = useState({ loading: true, error: "", done: false });

  useEffect(() => {
    (async () => {
      try {
        // 1) Đọc draft đã lưu khi bấm "Đặt hàng"
        const raw = sessionStorage.getItem("pending_checkout_draft");
        if (!raw) {
          setState({ loading: false, error: "Không tìm thấy phiên thanh toán.", done: false });
          return;
        }
        const draft = JSON.parse(raw);

        // 2) Nếu VNPay trả về thất bại (không verify BE theo yêu cầu hiện tại)
        if (responseCode !== "00") {
          // Có thể; rollback voucher apply nếu bạn đã "apply" trước khi redirect
          // Tạm thời bỏ qua, đợi bạn bổ sung sau.
          setState({ loading: false, error: "Thanh toán không thành công hoặc bị hủy.", done: false });
          // Điều hướng về /checkout cho user thử lại
          setTimeout(() => navigate("/checkout", { replace: true }), 1500);
          return;
        }

        // 3) Thanh toán OK → BẮT ĐẦU tạo order
        //    Dùng đúng nhóm payload như lúc checkout
        const {
          userId,
          items,
          address,
          recipientName,
          recipientPhone,
          note,
          shipping,
          amount,
          subtotal,
          discount,
          shippingFee,
          selectedVouchers = {},
        } = draft;

        // gom items theo seller và build payload BE
        const map = new Map();
        for (const it of items) {
          const sellerId = it.sellerId || (it.id || "").split("-")[0];
          if (!sellerId) continue;
          if (!map.has(sellerId)) map.set(sellerId, []);
          map.get(sellerId).push(it);
        }

        const payloads = Array.from(map.entries()).map(([sellerId, its]) => {
          const normItems = its.map((i) => ({
            productId: String(i.productId).trim(),
            options: buildOptionsForPayload(i),
            quantity: Math.max(1, parseInt(i.qty ?? 1, 10)),
          }));

          // Tính tổng seller từ chính items trong nhóm
          const sellerSubtotal = its.reduce((s, i) => s + (i.price || 0) * (i.qty || 0), 0);
          const ship = 30000; // đồng bộ với FE (standard)
          const picked = selectedVouchers[sellerId];
          const discountAmount = Number(picked?.discountAmount || 0);
          const totalAmount = Math.max(0, Math.round(sellerSubtotal) + ship - discountAmount);

          const payload = {
            userId: String(userId),
            sellerId: String(sellerId),
            items: normItems,
            paymentStatus: "BANK_TRANSFER", // đã trả tiền xong
            shippingAddress: (typeof address === "string" ? address : address?.address) || "",
            phoneNumber: (recipientPhone || "").trim(),
            recipientName: (recipientName || "").trim(),
            subtotal: Math.round(sellerSubtotal),
            shippingFee: ship,
            discountAmount,
            totalAmount,
            notes: (note || "").trim(),
            paymentRef, // để BE đối soát nếu cần sau này
          };
          if (picked?.code) payload.couponCode = picked.code;
          return payload;
        });

        // Gọi lần lượt để dễ debug; có thể Promise.all nếu bạn muốn
        const results = [];
        for (let i = 0; i < payloads.length; i++) {
          const res = await authFetch(apiUrl("/order/createOrder"), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payloads[i]),
          });
          const txt = await res.text();
          let data = {};
          try { data = JSON.parse(txt); } catch { throw new Error(`Server trả JSON lỗi: ${txt}`); }
          if (!res.ok) throw new Error(data.message || data.error || `Tạo đơn lỗi (HTTP ${res.status})`);
          results.push(data);
        }

        // 4) Chốt voucher (nếu trước đó bạn đã apply trước redirect)
        const userVoucherIds = Object.values(selectedVouchers)
          .map((v) => v?.userVoucherId)
          .filter(Boolean);
        for (const uvid of userVoucherIds) {
          await completeVoucherUsage(authFetch, uvid);
        }

        // 5) Xóa giỏ chính xác theo biến thể đã mua
        try {
          const toRemove = items.map((i) => ({
            sellerId: i.sellerId || (typeof i.id === "string" ? i.id.split("-")[0] : ""),
            productId: i.productId,
            options: buildOptionsForPayload(i),
          }));
          await removeCartItemsBatch({ userId, items: toRemove });
        } catch (e) {
          console.warn("Xoá giỏ sau thanh toán lỗi:", e);
        }

        // 6) Gửi thông báo & điều hướng success
        const orderIds = (results || []).map((r) => r?.result?.id).filter(Boolean);
        const sumFromBE = (results || [])
          .map((r) => Number(r?.result?.totalAmount))
          .filter((n) => Number.isFinite(n) && n >= 0)
          .reduce((a, b) => a + b, 0);

        const totalForSuccess = Number.isFinite(sumFromBE) && sumFromBE > 0 ? Math.round(sumFromBE) : Math.round(amount || 0);

        try {
          for (const oid of orderIds) {
            const found = (results || []).find((r) => r?.result?.id === oid);
            const totalAmountForThis = found?.result?.totalAmount ?? totalForSuccess;
            await sendOrderCreatedNotification(authFetch, { userId, orderId: oid, totalAmount: totalAmountForThis });
          }
        } catch {}

        // Clear draft & set success payload
        sessionStorage.removeItem("pending_checkout_draft");
        const orderSuccess = {
          orderIds,
          total: totalForSuccess,
          paymentStatus: toPaymentEnum("bank"),
          address: typeof draft.address === "string" ? draft.address : draft.address?.address || "",
          phone: draft.recipientPhone,
          itemsCount: (draft.items || []).length,
          etaText: draft.shipping === "fast" ? "5–10 ngày làm việc" : "7–20 ngày làm việc",
          subtotal: Math.round(draft.subtotal || 0),
          discount: Math.round(draft.discount || 0),
          shippingFee: Math.round(draft.shippingFee || 30000),
          txnNo, // lưu tham chiếu giao dịch VNPay
        };
        sessionStorage.setItem("last_order_success", JSON.stringify(orderSuccess));

        setState({ loading: false, error: "", done: true });
        navigate("/order-success", { state: { orderSuccess }, replace: true });
      } catch (e) {
        console.error("VNPay Callback error:", e);
        setState({ loading: false, error: e.message || "Có lỗi trong quá trình hoàn tất đơn.", done: false });
        // fallback về trang Checkout để thử lại
        setTimeout(() => navigate("/checkout", { replace: true }), 1500);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responseCode, paymentRef, txnNo]);

  if (state.loading) return <div style={{ padding: 24 }}>Đang hoàn tất thanh toán…</div>;
  if (state.error)   return <div style={{ padding: 24, color: "#b00020" }}>Lỗi: {state.error}</div>;
  return <div style={{ padding: 24 }}>Hoàn tất!</div>;
}
