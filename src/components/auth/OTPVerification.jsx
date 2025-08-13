import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { verifyOtp as verifyOtpApi } from '../../services/api';
import '../../styles/otp.css';
import BackButton from './BackButton';

function OTPVerification() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [isResendDisabled, setIsResendDisabled] = useState(true); // Bắt đầu với disabled
  const [sendCount, setSendCount] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const emailFromSignup = location.state?.email || '';
  const otpRefs = useRef([]);

  useEffect(() => {
    if (emailFromSignup) {
      setEmail(emailFromSignup);
      setIsResendDisabled(true); // Khởi động timer ngay khi vào trang
    }
    let interval;
    if (timer > 0 && isResendDisabled && sendCount === 0) { // Chỉ chạy timer lần đầu
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0 && sendCount === 0) { // Khi timer hết, kích hoạt nút gửi lại
      setIsResendDisabled(false);
      setTimer(0); // Giữ timer ở 0, không đếm tiếp
      clearInterval(interval); // Dừng interval
    }
    return () => clearInterval(interval); // Dọn dẹp interval
  }, [timer, isResendDisabled, sendCount, emailFromSignup]);

  const handleResendOtp = () => {
    if (!isResendDisabled && sendCount === 0) { // Chỉ cho phép gửi lại khi sendCount = 0
      setIsResendDisabled(true);
      setSendCount(1); // Tăng lên 1 và khóa luôn
      alert(`Mã OTP đã được gửi lại đến ${email}! (Kiểm tra email của bạn)`);
    } else if (sendCount >= 1) {
      alert('Bạn đã hết số lần gửi OTP!');
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Vui lòng nhập đầy đủ 6 chữ số!');
      return;
    }
    setError('');
    setLoading(true);

    const verifyData = {
      email,
      otp: otpString,
    };

    try {
      const data = await verifyOtpApi(verifyData);
      const userData = { email, role: 'buyer' };
      const authToken = data.result?.token || 'sample-token'; // Giả định token từ backend
      if (register) {
        register(userData, authToken);
        navigate('/login');
      } else {
        console.error('register function is not available');
        navigate('/login');
      }
    } catch (err) {
      setError(err.message || 'Mã OTP không đúng!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <BackButton to="/signup" position="left" />
      <div className="otp-wrapper">
        <div className="otp-card">
          <h2>Xác thực OTP</h2>
          <div className="otp-field">
            <div className="phone-row">
              <div className="phone-input-wrapper">
                <span className="otp-icon">📧</span>
                <input
                  type="email"
                  value={email}
                  readOnly
                  placeholder="Nhập email"
                />
              </div>
              {sendCount < 1 && (
                <button type="button" className={`otp-send-btn ${isResendDisabled ? 'disabled' : ''}`} onClick={handleResendOtp} disabled={isResendDisabled}>
                  {isResendDisabled && timer > 0 ? `Gửi lại (${timer}s)` : 'Gửi lại'}
                </button>
              )}
            </div>
          </div>

          <div className="otp-field">
            <div className="otp-code-container">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (otpRefs.current[index] = el)}
                  type="text"
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="otp-digit-input"
                  maxLength="1"
                />
              ))}
            </div>
            {error && <div className="error-message">{error}</div>}
            {loading && <div className="loading-message">Đang xác thực...</div>}
          </div>
          <button type="button" onClick={handleVerifyOtp} disabled={loading}>
            Xác thực
          </button>
          <div className="otp-signup-link">
            <span>Quay lại? <a href="/signup">Đăng ký</a></span>
          </div>
        </div>
      </div>
    </>
  );
}

export default OTPVerification;