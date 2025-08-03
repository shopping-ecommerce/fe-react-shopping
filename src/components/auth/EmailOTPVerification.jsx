import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../../styles/EmailOTPVerification.css';
import BackButton from './BackButton';

function EmailOTPVerification() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [timer, setTimer] = useState(60);
  const [isResendDisabled, setIsResendDisabled] = useState(false);
  const [sendCount, setSendCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const { state } = useLocation();
  
  const otpRefs = useRef([]);

  useEffect(() => {
    if (state?.email) {
      setEmail(state.email);
    }
  }, [state]);

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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setErrorMessage('Vui lòng nhập địa chỉ email hợp lệ!');
      return;
    }

    if (sendCount >= 2) {
      alert('Bạn đã hết số lần gửi OTP!');
      return;
    }

    setIsOtpSent(true);
    setIsResendDisabled(true);
    setSendCount((prev) => prev + 1);
    alert('Mã OTP đã được gửi qua email! (Giả lập: 123456)');
    setErrorMessage('');
  };

  const handleResendOtp = () => {
    if (!isResendDisabled && sendCount < 2) {
      setIsOtpSent(true);
      setIsResendDisabled(true);
      setSendCount((prev) => prev + 1);
      setTimer(60);
      alert('Mã OTP đã được gửi lại qua email! (Giả lập: 123456)');
      setErrorMessage('');
    } else if (sendCount >= 2) {
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

  const handleVerifyOtp = () => {
    const otpString = otp.join('');
    
    if (otpString.length !== 6) {
      setErrorMessage('Vui lòng nhập đầy đủ 6 chữ số!');
      return;
    }

    if (otpString === '123456') {
      navigate('/seller/welcome', { 
        state: { 
          email,
          message: 'Xác thực email thành công!'
        }
      });
    } else {
      setErrorMessage('Mã OTP không đúng!');
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(value)) {
      setErrorMessage('Vui lòng nhập địa chỉ email hợp lệ!');
    } else {
      setErrorMessage('');
    }
  };

  const handleChangeEmail = () => {
    setIsOtpSent(false);
    setOtp(['', '', '', '', '', '']);
    setSendCount(0);
    setTimer(60);
    setIsResendDisabled(false);
    setErrorMessage('');
  };

  return (
    <>
      <BackButton to="/seller/signup" position="left" />
      <div className="eotp-container">
        <div className="eotp-form">
          <h2>Xác thực email</h2>
          
          {!isOtpSent ? (
            <>
              <p className="eotp-instruction">
                Hãy nhập mã xác thực đã được gửi đến email bên dưới.
              </p>
              <div className="form-group">
                <div className="eotp-input-wrapper">
                  <span className="eotp-input-icon">📧</span>
                  <input
                    type="email"
                    value={email}
                    onChange={handleInputChange}
                    placeholder="Nhập địa chỉ email"
                  />
                </div>
                <button
                  type="button"
                  className="eotp-send-button"
                  onClick={handleSendOtp}
                >
                  Gửi mã
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="eotp-instruction">
                Hãy nhập mã xác thực đã được gửi đến email bên dưới. Vui lòng kiểm tra hộp thư SPAM nếu không tìm thấy.
              </p>
              <div className="eotp-email-display">
                {email.replace(/(.{3}).*@/, '$1*****@')}
              </div>
              
              <div className="eotp-code-container">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (otpRefs.current[index] = el)}
                    type="text"
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="eotp-digit-input"
                    maxLength="1"
                  />
                ))}
              </div>

              <button
                type="button"
                className="eotp-verify-button"
                onClick={handleVerifyOtp}
              >
                Xác nhận
              </button>

              <div className="eotp-actions">
                <button
                  type="button"
                  className="eotp-link-button"
                  onClick={handleResendOtp}
                  disabled={isResendDisabled || sendCount >= 2}
                >
                  {isResendDisabled && sendCount < 2 
                    ? `Gửi lại mã (${timer}s)` 
                    : sendCount >= 2 
                    ? 'Đã hết lượt gửi' 
                    : 'Gửi lại mã'
                  }
                </button>
                <button
                  type="button"
                  className="eotp-link-button"
                  onClick={handleChangeEmail}
                >
                  Thay đổi email
                </button>
              </div>
            </>
          )}

          {errorMessage && <div className="eotp-error-message">{errorMessage}</div>}

          <div className="eotp-signup-prompt">
            <span>Không nhận được mã? <a href="/seller/signup">Đăng ký lại</a></span>
          </div>
        </div>
      </div>
    </>
  );
}

export default EmailOTPVerification;