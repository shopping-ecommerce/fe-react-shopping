// export default function CartItem({ item, onQtyChange, onRemove, onToggle }) {
//   const { id, name, price, quantity, imageUrl, variant, sellerName, selected } =
//     item;

//   const handleQty = (delta) => {
//     const next = Math.max(1, Number(quantity || 1) + delta);
//     onQtyChange(next);
//   };

//   return (
//     <div
//       className="cart-item"
//       style={{
//         display: "grid",
//         gridTemplateColumns: "28px 88px 1fr 140px",
//         gap: 12,
//         padding: 12,
//         border: "1px solid #e5e7eb",
//         borderRadius: 8,
//         background: "#fff",
//       }}
//     >
//       <input
//         type="checkbox"
//         checked={!!selected}
//         onChange={onToggle}
//         aria-label="Chọn sản phẩm"
//       />

//       <img
//         src={imageUrl || "https://placehold.co/88"}
//         alt={name}
//         width={88}
//         height={88}
//         style={{ borderRadius: 8, objectFit: "cover" }}
//       />

//       <div>
//         <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{name}</div>
//         {variant && (
//           <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
//             Phân loại:{" "}
//             {variant.color || variant.size
//               ? `${variant.color ?? ""} ${variant.size ?? ""}`.trim()
//               : JSON.stringify(variant)}
//           </div>
//         )}
//         {sellerName && (
//           <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
//             Nhà bán: {sellerName}
//           </div>
//         )}

//         <button
//           onClick={onRemove}
//           style={{
//             marginTop: 8,
//             background: "transparent",
//             border: "none",
//             color: "#ef4444",
//             cursor: "pointer",
//             padding: 0,
//           }}
//         >
//           Xóa
//         </button>
//       </div>

//       <div style={{ textAlign: "right" }}>
//         <div style={{ fontWeight: 700 }}>
//           {Number(price).toLocaleString("vi-VN")}₫
//         </div>

//         <div
//           style={{
//             display: "inline-flex",
//             alignItems: "center",
//             gap: 8,
//             marginTop: 8,
//             border: "1px solid #e5e7eb",
//             borderRadius: 999,
//             padding: "4px 8px",
//           }}
//         >
//           <button onClick={() => handleQty(-1)} aria-label="Giảm số lượng">
//             −
//           </button>
//           <span style={{ minWidth: 24, textAlign: "center" }}>{quantity}</span>
//           <button onClick={() => handleQty(1)} aria-label="Tăng số lượng">
//             +
//           </button>
//         </div>

//         <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
//           Tạm tính:{" "}
//           <strong>
//             {(Number(price) * Number(quantity)).toLocaleString("vi-VN")}₫
//           </strong>
//         </div>
//       </div>
//     </div>
//   );
// }
