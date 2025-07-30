// src/pages/buyer/ProductDetail.jsx
import { useParams } from 'react-router-dom';

function ProductDetail() {
  const { id } = useParams(); // Lấy ID sản phẩm từ URL

  return (
    <div className="product-detail-container">
      <h1 className="product-detail-title">Chi tiết sản phẩm - ID: {id}</h1>
      <p className="product-detail-text">Thông tin chi tiết về sản phẩm sẽ hiển thị tại đây.</p>
      {/* Có thể thêm hình ảnh, mô tả, giá, và nút mua hàng trong tương lai */}
    </div>
  );
}

export default ProductDetail;