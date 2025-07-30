import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/SignupSeller.css'; // Sử dụng CSS đã đổi tên

function SignupSeller() {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    country: 'Việt Nam',
    phoneNumber: '',
    industry: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form data:', formData);
  };

  return (
    <div className="seller-signup-page">
      <div className="seller-signup-content">
        <div className="seller-signup-banner">
          {/* Logo được đưa lên góc trái */}
          <Link to="/" className="logo">
            <img src="/img/iconwweb.png" alt="T2Store" className="logo-img" />
          </Link>
          <div className="seller-banner-content">
            {/* Cập nhật nội dung bên trái theo ảnh */}
            <h1 className="seller-banner-heading">Shopping Việt Nam</h1>
            <p className="seller-banner-subheading">Trở thành Người bán ngay hôm nay</p>
            <div className="seller-features">
              <div className="seller-feature-item">
                <span className="seller-feature-icon">
                  {/* Icon cho Nền tảng thương mại điện tử */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-home"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                </span>
                <p>Nền tảng thương mại điện tử hàng đầu Đông Nam Á và Đài Loan</p>
              </div>
              <div className="seller-feature-item">
                <span className="seller-feature-icon">
                  {/* Icon cho Phát triển thương hiệu */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-award"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.89"></polyline></svg>
                </span>
                <p>Phát triển trở thành thương hiệu toàn cầu</p>
              </div>
              <div className="seller-feature-item">
                <span className="seller-feature-icon">
                  {/* Icon cho Dẫn đầu lượng người dùng */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-users"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </span>
                <p>Dẫn đầu lượng người dùng trên ứng dụng mua sắm tại Việt Nam</p>
              </div>
            </div>
            {/* Xóa banner image vì nó không có trong ảnh mẫu */}
          </div>
        </div>

        <div className="seller-signup-form-container">
          <div className="seller-form-header">
            <h2>Đăng ký ngay</h2>
          </div>

          <form className="seller-signup-form" onSubmit={handleSubmit}>
            <div className="seller-form-group">
              <label>
                Địa chỉ email
                <span className="seller-required">*</span>
                <span className="seller-tooltip">ℹ</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Nhập địa chỉ email"
                required
              />
            </div>

            <div className="seller-form-row">
              <div className="seller-form-group-half">
                <label>
                  Họ và tên
                  <span className="seller-tooltip">ℹ</span>
                </label>
                <p className="seller-field-description">Điền họ và tên như trên giấy tờ tùy thân.</p>
                <div className="seller-name-input"> {/* Thêm container giống phone-input */}
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="Nhập đầy đủ họ tên"
                  />
                </div>
              </div>
            </div>

            <div className="seller-form-group">
              <label>Số điện thoại</label>
              <div className="seller-phone-input">
                <div className="seller-country-code">
                  <span className="seller-flag">🇻🇳</span>
                  <span>+84</span>
                </div>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  placeholder="Nhập số điện thoại"
                />
              </div>
            </div>

            <div className="seller-form-group">
              <label>
                Ngành hàng chủ lực
                <span className="seller-tooltip">ℹ</span>
              </label>
              <div className="seller-select-wrapper">
                <select
                  name="industry"
                  value={formData.industry}
                  onChange={handleInputChange}
                >
                  <option value="">Chọn ngành hàng</option>
                  <option value="fashion">Thời trang</option>
                  <option value="electronics">Điện tử</option>
                  <option value="books">Sách</option>
                  <option value="home">Nhà cửa & Đời sống</option>
                  <option value="beauty">Làm đẹp</option>
                  <option value="sports">Thể thao</option>
                </select>
              </div>
            </div>

            <div className="seller-form-group">
              <label>Mật khẩu</label>
              <div className="seller-password-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Nhập mật khẩu"
                  required
                />
                <span
                  className="seller-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </span>
              </div>
            </div>

            <div className="seller-form-group">
              <label>Xác nhận mật khẩu</label>
              <div className="seller-password-container">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Nhập lại mật khẩu"
                  required
                />
                <span
                  className="seller-password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </span>
              </div>
            </div>

            <button type="submit" className="seller-signup-button">
              Đăng ký ngay
            </button>
          </form>

          <div className="seller-login-link">
            <span>Đã có tài khoản bán hàng? </span>
            <Link to="/seller/login">Đăng nhập</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignupSeller;