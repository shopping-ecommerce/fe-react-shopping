// src/pages/buyer/ProductList.jsx
function ProductList() {
  // Giả lập danh sách sản phẩm (thay bằng dữ liệu từ API trong tương lai)
  const products = [
    { id: 1, name: 'Sản phẩm 1', price: 100 },
    { id: 2, name: 'Sản phẩm 2', price: 200 },
    { id: 3, name: 'Sản phẩm 3', price: 300 },
  ];

  return (
    <div className="product-list-container">
      <h1 className="product-list-title">Danh sách sản phẩm</h1>
      <div className="product-list-items">
        {products.map((product) => (
          <div key={product.id} className="product-item">
            <h3>{product.name}</h3>
            <p>Giá: ${product.price}</p>
            <a href={`/product/${product.id}`}>Xem chi tiết</a>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProductList;