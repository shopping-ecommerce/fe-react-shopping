import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import '../../styles/otp.css';
import BackButton from './BackButton';

function OTPVerification() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [timer, setTimer] = useState(60);
  const [isResendDisabled, setIsResendDisabled] = useState(false);
  const [sendCount, setSendCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    let interval;
    if (isOtpSent && timer > 0 && isResendDisabled && sendCount < 2) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0 && sendCount < 2) {
      setIsResendDisabled(false);
      setTimer(60);
    }
    return () => clearInterval(interval);
  }, [isOtpSent, timer, isResendDisabled, sendCount]);

  const handleSendOtp = () => {
    if (!phoneNumber || errorMessage) {
      alert('Vui lòng nhập số điện thoại hợp lệ!');
      return;
    }
    if (sendCount >= 2) {
      alert('Bạn đã hết số lần gửi OTP!');
      return;
    }
    setIsOtpSent(true);
    setIsResendDisabled(true);
    setSendCount((prev) => prev + 1);
    alert('Mã OTP đã được gửi! (Giả lập: 123456)');
  };

  const handleResendOtp = () => {
    if (!isResendDisabled && sendCount < 2) {
      setIsOtpSent(true);
      setIsResendDisabled(true);
      setSendCount((prev) => prev + 1);
      setTimer(60); // Reset timer cho cả lần gửi lại
      alert('Mã OTP đã được gửi lại! (Giả lập: 123456)');
    } else if (sendCount >= 2) {
      alert('Bạn đã hết số lần gửi OTP!');
    }
  };

  const handleVerifyOtp = () => {
    if (otp === '123456') {
      const userData = { email: 'user@example.com', role: 'buyer' };
      const authToken = 'sample-token';
      if (register) {
        register(userData, authToken);
        navigate('/login');
      } else {
        console.error('register function is not available');
        navigate('/login');
      }
    } else {
      alert('Mã OTP không đúng!');
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    // Giới hạn độ dài tối đa 10 số
    if (value.length > 10) return;

    // Chỉ giữ lại các ký tự số
    const numericValue = value.replace(/[^0-9]/g, '');
    setPhoneNumber(numericValue);

    // Validation: bắt đầu bằng 0 hoặc +84, chỉ chứa số, độ dài 10
    if (numericValue && !/^(0|\+84)\d*$/.test(numericValue)) {
      setErrorMessage('Số điện thoại phải bắt đầu bằng 0 hoặc +84!');
    } else if (numericValue && numericValue.length < 10) {
      setErrorMessage('Số điện thoại phải đủ 10 số!');
    } else {
      setErrorMessage('');
    }
  };

  const handleKeyPress = (e) => {
    // Ngăn chặn các ký tự không phải số
    if (!/[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <>
      <BackButton to="/signup" position="left" />
      <div className="otp-container">
        <div className="otp-form">
          <h2>Xác thực OTP</h2>
          <div className="form-group">
            <div className="phone-row">
              <div className="phone-input-wrapper">
                <span className="input-icon">📞</span>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  placeholder="Nhập số điện thoại"
                  maxLength={10}
                  disabled={isOtpSent} // Lock input sau khi gửi OTP
                />
              </div>
              {!isOtpSent ? (
                <button type="button" className="send-otp-button" onClick={handleSendOtp}>
                  Gửi
                </button>
              ) : sendCount >= 2 ? (
                <button type="button" className="send-otp-button disabled" disabled>
                  Gửi lại
                </button>
              ) : isResendDisabled ? (
                <button type="button" className="send-otp-button disabled" disabled>
                  Gửi lại ({timer}s)
                </button>
              ) : (
                <button type="button" className="send-otp-button" onClick={handleResendOtp}>
                  Gửi lại
                </button>
              )}
            </div>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
          </div>

          {isOtpSent && (
            <>
              <div className="form-group">
                <div className="input-container">
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Nhập mã OTP"
                  />
                  <span className="input-icon">🔑</span>
                </div>
              </div>
              <button type="button" onClick={handleVerifyOtp}>
                Xác thực
              </button>
            </>
          )}

          <div className="signup-prompt">
            <span>Quay lại? <a href="/signup">Đăng ký</a></span>
          </div>
        </div>
      </div>
    </>
  );
}

export default OTPVerification;