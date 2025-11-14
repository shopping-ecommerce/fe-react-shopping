// src/components/cart/CartSummary.jsx
export default function CartSummary({
  count,
  subtotal,
  shippingFee,
  discount,
  total,
  selectedCount,
  onCheckout,
  onClear,
}) {
  return (
    <aside
      className="cart-summary"
      style={{
        position: "sticky",
        top: 16,
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#fff",
      }}
    >
      <h3 style={{ marginBottom: 12 }}>Tóm tắt đơn hàng</h3>

      <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Tổng sản phẩm</span>
          <span>{count}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Tạm tính</span>
          <strong>{subtotal.toLocaleString("vi-VN")}₫</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Phí vận chuyển</span>
          <strong>
            {shippingFee === 0 ? "Miễn phí" : `${shippingFee.toLocaleString("vi-VN")}₫`}
          </strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Giảm giá</span>
          <strong>-{discount.toLocaleString("vi-VN")}₫</strong>
        </div>
        <hr />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 16,
          }}
        >
          <span>Thành tiền</span>
          <strong>{total.toLocaleString("vi-VN")}₫</strong>
        </div>
      </div>

      <button
        onClick={onCheckout}
        style={{
          marginTop: 12,
          width: "100%",
          padding: "10px 14px",
          borderRadius: 8,
          border: "none",
          background: "#22c55e",
          color: "#fff",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Thanh toán ({selectedCount} sp đã chọn)
      </button>

      <button
        onClick={onClear}
        style={{
          marginTop: 8,
          width: "100%",
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid #ef4444",
          background: "#fff",
          color: "#ef4444",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Xóa toàn bộ giỏ
      </button>
    </aside>
  );
}
