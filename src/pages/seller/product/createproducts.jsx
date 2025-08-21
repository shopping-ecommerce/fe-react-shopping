import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Upload,
  Plus,
  X,
  Package,
  Info,
  Settings,
  CheckCircle,
} from "lucide-react";
import "../../../styles/ProductCreation.css";

export default function CreateProductPage() {
  const [activeSection, setActiveSection] = useState(1);
  const [step1Completed, setStep1Completed] = useState(false);
  const [productData, setProductData] = useState({
    productName: "",
    category: "",
    brand: "",
    origin: "",
    brandOrigin: "",
    material: "",
    pattern: "",
    description: "",
    images: [],
    price: "",
    shippingModel: "",
    weight: "",
    dimensions: { length: "", width: "", height: "" },
    productVariants: [],
  });

  const [currentVariant, setCurrentVariant] = useState({
    image: null,
    color: "",
    size: "",
    quantity: "",
  });

  const checkStep1Completion = () => {
    return (
      productData.productName.trim() !== "" &&
      productData.category.trim() !== ""
    );
  };

  const handleSectionClick = (section) => {
    if (section !== 1 && !step1Completed) {
      alert(
        "Vui lòng nhập tên sản phẩm và chọn đúng danh mục để xem các thông tin."
      );
      return;
    }
    setActiveSection(activeSection === section ? null : section);
  };

  const handleInputChange = (field, value) => {
    setProductData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (field === "productName" || field === "category") {
      const newCompleted =
        field === "productName"
          ? value.trim() !== "" && productData.category.trim() !== ""
          : productData.productName.trim() !== "" && value.trim() !== "";
      setStep1Completed(newCompleted);
    }
  };

  const handlePriceChange = (value) => {
    const numericValue = value.replace(/\D/g, "");
    const formattedValue = numericValue.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      ","
    );
    setProductData((prev) => ({
      ...prev,
      price: formattedValue,
    }));
  };

  const handleDimensionChange = (dimension, value) => {
    setProductData((prev) => ({
      ...prev,
      dimensions: {
        ...prev.dimensions,
        [dimension]: value,
      },
    }));
  };

  const handleVariantChange = (field, value) => {
    setCurrentVariant((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCurrentVariant((prev) => ({
        ...prev,
        image: file,
      }));
    }
  };

  const addVariant = () => {
    if (
      currentVariant.image &&
      currentVariant.color &&
      currentVariant.size &&
      currentVariant.quantity
    ) {
      setProductData((prev) => ({
        ...prev,
        productVariants: [...prev.productVariants, { ...currentVariant }],
      }));
      setCurrentVariant({
        image: null,
        color: "",
        size: "",
        quantity: "",
      });
    }
  };

  const handleRealImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    setProductData((prev) => ({
      ...prev,
      images: [...prev.images, ...files],
    }));
  };

  const removeVariant = (index) => {
    setProductData((prev) => ({
      ...prev,
      productVariants: prev.productVariants.filter((_, i) => i !== index),
    }));
  };

  const handleCancel = () => {
    if (confirm("Bạn có chắc chắn muốn hủy? Tất cả dữ liệu sẽ bị mất.")) {
      window.history.back();
    }
  };

  const handleSubmitForReview = () => {
    if (!productData.productName || !productData.category) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc!");
      return;
    }

    alert(
      "Sản phẩm đã được gửi để admin duyệt. Bạn sẽ nhận được thông báo khi sản phẩm được duyệt."
    );
  };

  const SectionHeader = ({ section, title, icon, disabled = false }) => (
    <div
      className={`section-header ${
        activeSection === section ? "active" : disabled ? "disabled" : ""
      }`}
      onClick={() => handleSectionClick(section)}
    >
      <div className="section-title">
        <span className="section-icon">{icon}</span>
        <span>{title}</span>
      </div>
      <span className="section-arrow">
        {activeSection === section ? <ChevronDown /> : <ChevronRight />}
      </span>
    </div>
  );

  return (
    <div className="order-mgmt-page">
      {/* Header Section */}
      <div className="order-mgmt-header">
        <div className="order-mgmt-breadcrumb">
          <span className="order-mgmt-crumb-link">Trang chủ</span>
          <span className="order-mgmt-crumb-sep">›</span>
          <span className="order-mgmt-crumb-link">Sản phẩm</span>
          <span className="order-mgmt-crumb-sep">›</span>
          <span className="order-mgmt-crumb-current">Tạo sản phẩm mới</span>
        </div>

        <div className="order-mgmt-head-row">
          <h1 className="order-mgmt-title">
            <span className="title-icon">📦</span>
            Tạo Sản Phẩm Mới
          </h1>
        </div>

        <div className="orders-guide">
          <span className="guide-text">
            <span className="guide-icon">💡</span>
            Vui lòng điền đầy đủ thông tin để tạo sản phẩm chất lượng:
          </span>
          <button className="link-inline">
            <span className="link-icon">📖</span>
            Hướng dẫn tạo sản phẩm
          </button>
          <button className="link-inline">
            <span className="link-icon">💬</span>
            Gửi góp ý
          </button>
        </div>
      </div>

      {/* Section 1: Thông tin chung */}
      <div className="order-mgmt-section">
        <SectionHeader section={1} title="1. Thông tin chung" icon={<Info />} />

        {activeSection === 1 && (
          <div className="section-content">
            <div className="section-subtitle">
              <span className="subtitle-icon">⭐</span>
              <h3>Thông tin quan trọng</h3>
            </div>

            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">
                  <span className="label-icon">🏷️</span>
                  Tên sản phẩm *
                </label>
                <input
                  type="text"
                  value={productData.productName}
                  onChange={(e) =>
                    handleInputChange("productName", e.target.value)
                  }
                  placeholder="Nhập tên sản phẩm"
                  className="form-input"
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">
                  <span className="label-icon">📂</span>
                  Danh mục *
                </label>
                <select
                  value={productData.category}
                  onChange={(e) =>
                    handleInputChange("category", e.target.value)
                  }
                  className="form-select"
                >
                  <option value="">Chọn danh mục</option>
                  <option value="thoi-trang">Thời trang</option>
                  <option value="dien-tu">Điện tử</option>
                  <option value="gia-dung">Gia dụng</option>
                  <option value="my-pham">Mỹ phẩm</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">🏢</span>
                  Thương hiệu
                </label>
                <input
                  type="text"
                  value={productData.brand}
                  onChange={(e) => handleInputChange("brand", e.target.value)}
                  placeholder="Nhập thương hiệu"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">🌍</span>
                  Xuất sứ
                </label>
                <input
                  type="text"
                  value={productData.origin}
                  onChange={(e) => handleInputChange("origin", e.target.value)}
                  placeholder="Nhập xuất sứ"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">🏭</span>
                  Xuất sứ thương hiệu
                </label>
                <input
                  type="text"
                  value={productData.brandOrigin}
                  onChange={(e) =>
                    handleInputChange("brandOrigin", e.target.value)
                  }
                  placeholder="Nhập xuất sứ thương hiệu"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">🧵</span>
                  Chất liệu
                </label>
                <input
                  type="text"
                  value={productData.material}
                  onChange={(e) =>
                    handleInputChange("material", e.target.value)
                  }
                  placeholder="Nhập chất liệu"
                  className="form-input"
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">
                  <span className="label-icon">🎨</span>
                  Họa tiết
                </label>
                <input
                  type="text"
                  value={productData.pattern}
                  onChange={(e) =>
                    handleInputChange("pattern", e.target.value)
                  }
                  placeholder="Nhập họa tiết"
                  className="form-input"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Mô tả sản phẩm */}
      <div className="order-mgmt-section">
        <SectionHeader
          section={2}
          title="2. Mô tả sản phẩm"
          icon={<Package />}
          disabled={!step1Completed}
        />

        {activeSection === 2 && (
          <div className="section-content">
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">
                  <span className="label-icon">📝</span>
                  Mô tả chi tiết sản phẩm
                </label>
                <textarea
                  value={productData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Nhập mô tả chi tiết về sản phẩm"
                  rows={5}
                  className="form-textarea"
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">
                  <span className="label-icon">📸</span>
                  Hình ảnh thật của sản phẩm
                </label>
                <div className="file-upload-area">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleRealImageUpload}
                    className="file-input"
                  />
                  <div className="file-upload-label">
                    <Upload className="upload-icon" />
                    <span>Chọn hình ảnh hoặc kéo thả vào đây</span>
                    <span>Hỗ trợ: JPG, PNG, GIF</span>
                  </div>
                </div>

                <div className="upload-note">
                  <span className="note-icon">⚠️</span>
                  <span>
                    Lưu ý: Vui lòng gửi hình ảnh thật của sản phẩm để khách
                    hàng có thể đánh giá chính xác nhất
                  </span>
                </div>

                {productData.images.length > 0 && (
                  <div className="uploaded-files">
                    📁 Đã tải lên: {productData.images.length} hình ảnh
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Các lựa chọn và vận hành */}
      <div className="order-mgmt-section">
        <SectionHeader
          section={3}
          title="3. Các lựa chọn và vận hành"
          icon={<Settings />}
          disabled={!step1Completed}
        />

        {activeSection === 3 && (
          <div className="section-content">
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">
                  <span className="label-icon">💰</span>
                  Giá bán (VNĐ)
                </label>
                <input
                  type="text"
                  value={productData.price}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="Ví dụ: 500,000"
                  className="form-input"
                />
              </div>
            </div>

            <div className="subsection-title">
              <span className="subsection-icon">🚚</span>
              <h4>Vận hành</h4>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">📦</span>
                  Mô hình vận hành
                </label>
                <select
                  value={productData.shippingModel}
                  onChange={(e) =>
                    handleInputChange("shippingModel", e.target.value)
                  }
                  className="form-select"
                >
                  <option value="">Chọn mô hình vận hành</option>
                  <option value="self-delivery">Nhà bán tự giao hàng</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">⚖️</span>
                  Trọng lượng sau đóng gói (kg)
                </label>
                <input
                  type="number"
                  value={productData.weight}
                  onChange={(e) => handleInputChange("weight", e.target.value)}
                  placeholder="Nhập trọng lượng"
                  className="form-input"
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">
                  <span className="label-icon">📏</span>
                  Kích thước (cm)
                </label>
                <div className="dimensions-input">
                  <input
                    type="number"
                    value={productData.dimensions.length}
                    onChange={(e) =>
                      handleDimensionChange("length", e.target.value)
                    }
                    placeholder="Dài"
                    className="dimension-field"
                  />
                  <span className="dimension-separator">×</span>
                  <input
                    type="number"
                    value={productData.dimensions.width}
                    onChange={(e) =>
                      handleDimensionChange("width", e.target.value)
                    }
                    placeholder="Rộng"
                    className="dimension-field"
                  />
                  <span className="dimension-separator">×</span>
                  <input
                    type="number"
                    value={productData.dimensions.height}
                    onChange={(e) =>
                      handleDimensionChange("height", e.target.value)
                    }
                    placeholder="Cao"
                    className="dimension-field"
                  />
                </div>
              </div>
            </div>

            <div className="subsection-title">
              <span className="subsection-icon">🎨</span>
              <h4>Hình ảnh sản phẩm và biến thể</h4>
            </div>

            <div className="variant-builder">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label className="form-label">
                    <span className="label-icon">🖼️</span>
                    Chọn hình ảnh sản phẩm
                  </label>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="file-input"
                    />
                    <div className="file-upload-label">
                      <Upload className="upload-icon" />
                      <span>Chọn hình ảnh biến thể</span>
                    </div>
                  </div>
                </div>

                {currentVariant.image && (
                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon">🎨</span>
                      Chọn màu
                    </label>
                    <input
                      type="text"
                      value={currentVariant.color}
                      onChange={(e) =>
                        handleVariantChange("color", e.target.value)
                      }
                      placeholder="Nhập màu sắc"
                      className="form-input"
                    />
                  </div>
                )}

                {currentVariant.color && (
                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon">📐</span>
                      Chọn size
                    </label>
                    <select
                      value={currentVariant.size}
                      onChange={(e) =>
                        handleVariantChange("size", e.target.value)
                      }
                      className="form-select"
                    >
                      <option value="">Chọn size</option>
                      <option value="S">S</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                      <option value="XL">XL</option>
                      <option value="XXL">XXL</option>
                    </select>
                  </div>
                )}

                {currentVariant.size && (
                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon">🔢</span>
                      Số lượng
                    </label>
                    <input
                      type="number"
                      value={currentVariant.quantity}
                      onChange={(e) =>
                        handleVariantChange("quantity", e.target.value)
                      }
                      placeholder="Nhập số lượng"
                      className="form-input"
                    />
                  </div>
                )}

                {currentVariant.quantity && (
                  <div className="form-group full-width">
                    <button
                      onClick={addVariant}
                      className="order-mgmt-btn confirm-bulk"
                    >
                      <Plus />
                      Thêm biến thể
                    </button>
                  </div>
                )}
              </div>
            </div>

            {productData.productVariants.length > 0 && (
              <div className="variants-display">
                <div className="variants-title">
                  <span className="variants-icon">📋</span>
                  Các biến thể đã thêm:
                </div>
                <div className="variants-list">
                  {productData.productVariants.map((variant, index) => (
                    <div key={index} className="variant-item">
                      <div className="variant-preview">
                        {variant.image && (
                          <img
                            src={
                              URL.createObjectURL(variant.image) ||
                              "/placeholder.svg"
                            }
                            alt="Variant preview"
                            className="variant-image"
                            style={{
                              width: "50px",
                              height: "50px",
                              objectFit: "cover",
                              borderRadius: "4px",
                            }}
                          />
                        )}
                        <div className="variant-info">
                          Màu: <strong>{variant.color}</strong> | Size:{" "}
                          <strong>{variant.size}</strong> | SL:{" "}
                          <strong>{variant.quantity}</strong>
                        </div>
                      </div>
                      <button
                        onClick={() => removeVariant(index)}
                        className="order-mgmt-btn ghost"
                        style={{ marginLeft: "auto", padding: "8px" }}
                      >
                        <X />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 4: Xác nhận và đăng bán */}
      <div className="order-mgmt-section">
        <SectionHeader
          section={4}
          title="4. Xác nhận và gửi duyệt"
          icon={<CheckCircle />}
          disabled={!step1Completed}
        />

        {activeSection === 4 && (
          <div className="section-content">
            <div className="summary-card">
              <div className="summary-header">
                <span className="summary-icon">📊</span>
                <h4>Tóm tắt sản phẩm</h4>
              </div>
              <div className="summary-content">
                <div className="summary-item">
                  <span className="summary-label">Tên sản phẩm:</span>
                  <span className="summary-value">
                    {productData.productName || "Chưa nhập"}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Danh mục:</span>
                  <span className="summary-value">
                    {productData.category || "Chưa chọn"}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Giá bán:</span>
                  <span className="summary-value">
                    {productData.price
                      ? `${productData.price} VNĐ`
                      : "Chưa nhập"}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Số biến thể:</span>
                  <span className="summary-value">
                    {productData.productVariants.length}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Số hình ảnh thật:</span>
                  <span className="summary-value">
                    {productData.images.length}
                  </span>
                </div>
              </div>
            </div>

            <div
              className="submit-section"
              style={{ display: "flex", gap: "16px", justifyContent: "flex-end" }}
            >
              <button
                onClick={handleCancel}
                className="order-mgmt-btn ghost"
                style={{ minWidth: "120px" }}
              >
                <X />
                Hủy
              </button>
              <button
                onClick={handleSubmitForReview}
                className="order-mgmt-btn confirm-bulk"
                style={{ minWidth: "150px" }}
              >
                <Upload />
                Gửi duyệt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
