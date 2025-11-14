// src/components/cart/CartEmpty.jsx
export default function CartEmpty() {
  return (
    <div
      style={{
        padding: 32,
        textAlign: "center",
        background: "#fff",
        border: "1px dashed #d1d5db",
        borderRadius: 12,
        margin: 16,
      }}
    >
      <h3>Giỏ hàng đang trống</h3>
      <p style={{ color: "#6b7280" }}>
        Hãy tiếp tục mua sắm và thêm sản phẩm vào giỏ nhé.
      </p>
    </div>
  );
}
