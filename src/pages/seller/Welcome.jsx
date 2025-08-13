import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../../styles/Welcome.css';

function Welcome() {
  const navigate = useNavigate();
  const location = useLocation();
  const [storeName, setStoreName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Récupérer l'email và message từ state
  const email = location.state?.email || 'seller@example.com';
  const message = location.state?.message || 'Chào mừng bạn!';

  const handleStoreNameChange = (e) => {
    const value = e.target.value;
    if (value.length <= 35) {
      setStoreName(value);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Kích thước file không được vượt quá 2MB!');
        return;
      }
      
      if (!file.type.match(/^image\/(jpeg|jpg)$/)) {
        alert('Chỉ chấp nhận file JPEG/JPG!');
        return;
      }

      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoPreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFinish = () => {
  if (!storeName.trim()) {
    alert('Vui lòng nhập tên cửa hàng!');
    return;
  }
  if (!agreedToTerms) {
    alert('Vui lòng đồng ý với điều khoản và chính sách!');
    return;
  }

  // Gắn tạm role "seller" cho phép vào ProtectedRoute
  const roles = JSON.parse(localStorage.getItem('roles') || '[]');
  if (!roles.includes('seller')) {
    roles.push('seller');
    localStorage.setItem('roles', JSON.stringify(roles));
  }

  // (tuỳ chọn) lưu tên cửa hàng, để header/sidebar seller dùng
  localStorage.setItem('seller_store_name', storeName);

  // Điều hướng sang trang seller
  navigate('/seller/home', { replace: true });
};

  return (
    <div className="wk-container">
      <div className="wk-content">
        <h1 className="wk-title">Thông tin về cửa hàng</h1>
        <p className="wk-subtitle">{message}</p>

        {/* Thông tin tài khoản (bước 1) */}
        <div className="wk-account-types">
          <div className="wk-account-card">
            <div className="wk-account-icon personal">
              <svg viewBox="0 0 24 24" width="32" height="32">
                <path fill="white" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <h3>Tài khoản Cá nhân</h3>
            
            <div className="wk-requirements">
              <div className="wk-requirement-item">
                <strong>Yêu cầu:</strong>
              </div>
              <ul>
                <li>Giấy tờ tùy thân (CMND/CCCD/Hộ chiếu)</li>
                <li>Mã số thuế cá nhân. Tra cứu thêm <a href="#" className="wk-link">tại đây</a></li>
                <li className="warning">
                  <strong>Lưu ý:</strong> Một số ngành hàng được mở bán rộng rãi qua sàn thì Nhà Bán. Tuy nhiên, số ngành hàng còn lại chỉ áp dụng cho Nhà Bán đăng ký tài khoản dành cho Doanh nghiệp hoặc Thương hiệu.
                </li>
              </ul>
            </div>
            <button className="wk-select-button">Chọn loại tài khoản này</button>
          </div>
        </div>

        {/* Cấu hình cửa hàng (bước 2) */}
        <div className="wk-store-setup-content">
          <div className="wk-form-section">
            <div className="wk-form-group">
              <label className="wk-form-label">
                <span className="wk-required">*</span> Tên cửa hàng
              </label>
              <p className="wk-form-description">
                Vui lòng đặt Tên gian hàng theo đúng quy định
              </p>
              <div className="wk-input-wrapper">
                <input
                  type="text"
                  value={storeName}
                  onChange={handleStoreNameChange}
                  className="wk-store-name-input"
                  placeholder="Nhập tên cửa hàng"
                />
                <span className="wk-char-count">{storeName.length}/35</span>
              </div>
              
              <div className="wk-warning-box">
                <p>
                  Để tránh việc hỗ trợ của Quy Nhà Bán bị từ chối đăng ký, hãy đặt tên của hàng tuân thủ theo quy định sau:
                </p>
                <ul>
                  <li>Không chứa từ khóa <strong>gây hiểu nhầm về chất lượng</strong> (ví dụ: tốt nhất, rẻ nhất, v.v.), <strong>nơi đặt, địa phương</strong> (ví dụ: Hồ Chí Minh, Đà Nẵng, Hà Nội, v.v.), <strong>vùng miền</strong> (ví dụ: Bắc, Trung, Nam) hoặc <strong>tên quốc gia</strong> (ví dụ: Việt Nam, Hàn Quốc, Nhật Bản, v.v.). <a href="#" className="wk-link">Tìm hiểu thêm</a></li>
                  <li>Không chứa tên <strong>trùng với tên thương hiệu đã đăng ký trên Shopping</strong>. Đối với tên gian hàng <strong>có chứa thương hiệu được bảo hộ</strong> (ví dụ: Apple, Samsung, v.v.) cần cung cấp <strong>giấy ủy quyền/chứng nhận thương hiệu</strong> sau khi tạo tài khoản. <a href="#" className="wk-link">Tìm hiểu thêm</a></li>
                </ul>
              </div>
            </div>

            <div className="wk-form-group">
              <label className="wk-form-label">Logo gian hàng</label>
              <p className="wk-form-description">
                Kích thước: 320 x 320 px | JPEG, JPG | Tối đa 2MB<br/>
                (Có thể cập nhật sau khi hoàn tất hồ sơ, tại phần <strong>Trang trí gian hàng</strong>)
              </p>
              
              <div className="wk-logo-upload-section">
                <div className="wk-logo-upload-area">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="wk-logo-preview" />
                  ) : (
                    <div className="wk-logo-placeholder">
                      <svg viewBox="0 0 64 64" width="40" height="40">
                        <rect x="8" y="20" width="48" height="32" rx="4" fill="#4A90E2" stroke="#fff" strokeWidth="2"/>
                        <rect x="12" y="28" width="8" height="16" fill="#fff"/>
                        <rect x="24" y="24" width="16" height="4" fill="#fff"/>
                        <rect x="24" y="32" width="12" height="2" fill="#fff"/>
                        <rect x="24" y="36" width="8" height="2" fill="#fff"/>
                      </svg>
                    </div>
                  )}
                  <label className="wk-upload-button">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg"
                      onChange={handleLogoUpload}
                      style={{ display: 'none' }}
                    />
                    📥 Tải lên logo mới
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="wk-mobile-preview-wrapper">
            <p className="wk-preview-label">Hình mô phỏng trên trang gian hàng</p>
            <div className="wk-mobile-preview-section">
              <div className="wk-mobile-preview">
                <div className="wk-mobile-header">
                  <div className="wk-mobile-status">
                    <span>9:41</span>
                    <div className="wk-mobile-icons">
                      <span>📶</span>
                      <span>📶</span>
                      <span>📶</span>
                      <span>🔋</span>
                    </div>
                  </div>
                  <div className="wk-mobile-nav">
                    <span>←</span>
                    <div className="wk-search-bar">🔍 Tìm kiếm tại cửa hàng</div>
                    <span>🛒</span>
                    <span>1</span>
                    <span>⋯</span>
                  </div>
                </div>
                
                <div className="wk-store-info">
                  <div className="wk-store-avatar">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Store logo" />
                    ) : (
                      <div className="default-avatar">🏪</div>
                    )}
                  </div>
                  <div className="wk-store-details">
                    <h4>{storeName || 'undefined'}</h4>
                    <p>1.5K người theo dõi</p>
                    <div className="wk-action-buttons">
                      <button className="wk-chat-btn">Chat</button>
                      <button className="wk-follow-btn">Theo dõi</button>
                    </div>
                  </div>
                </div>
                
                <div className="wk-mobile-tabs">
                  <span className="active">Cửa Hàng</span>
                  <span>Sản Phẩm</span>
                  <span>Bộ Sưu Tập</span>
                  <span>Giá Sốc Hôm N</span>
                </div>
              </div>
            </div>
          </div>

          <div className="wk-form-footer">
            <label className="wk-checkbox-container">
              <input 
                type="checkbox" 
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              />
              <span className="checkmark"></span>
              Tôi đã đọc và đồng ý với <a href="#" className="wk-link">Chính sách và điều khoản của Shopping</a>
            </label>
            
            <button 
              className="wk-finish-button"
              onClick={handleFinish}
            >
              Hoàn thành
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Welcome;