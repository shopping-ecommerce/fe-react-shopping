export default function CartStickyBar({
  allSelected,
  onToggleAll,
  onClear,
  totalCount,
  subtotal,      // <- sẽ dùng cái này để hiển thị
  total,         // <- giữ lại nếu cần sau này
  selectedCount,
  onCheckout,
}) {
  return (
    <div className="sh-cart__bottom-bar">
      <div className="sh-cart__bottom-left">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onToggleAll(e.target.checked)}
          />
          Chọn Tất Cả ({totalCount})
        </label>
        <div className="sh-cart__bottom-actions">
          <button className="sh-cart__link" onClick={onClear}>Xóa</button>
          <button className="sh-cart__link" onClick={() => alert("Demo: Bỏ sản phẩm không hoạt động")}>
            Bỏ sản phẩm không hoạt động
          </button>
          <button className="sh-cart__link" onClick={() => alert("Demo: Lưu vào mục Đã thích")}>
            Lưu vào mục Đã thích
          </button>
        </div>
      </div>

      <div className="sh-cart__bottom-right">
        <div className="sh-cart__total">
          Tổng cộng ({selectedCount} Sản phẩm): <b>{subtotal.toLocaleString("vi-VN")}₫</b>
        </div>
        <button className="sh-cart__buy" onClick={onCheckout}>Mua Hàng</button>
      </div>
    </div>
  );
}
