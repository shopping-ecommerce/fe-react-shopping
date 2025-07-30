// src/pages/auth/ForgotPassword.jsx
import React, { useState } from 'react';

function ForgotPassword() {
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Giả lập gửi yêu cầu reset mật khẩu (thay bằng API thực tế)
    console.log('Yêu cầu reset mật khẩu cho email:', email);
    alert('Một liên kết reset mật khẩu đã được gửi đến ' + email);
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-form">
        <h2 className="forgot-password-title">Quên mật khẩu</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email của bạn"
              required
            />
          </div>
          <button type="submit">Gửi liên kết reset</button>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;