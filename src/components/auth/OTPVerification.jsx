// src/components/auth/OTPVerification.jsx
"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"
import { verifyOtp as verifyRegisterOtpApi, register as apiRegister } from "../../services/auth"
import { forgotPasswordSendOtp, forgotPasswordVerifyOtp } from "../../services/api"
import "../../styles/otp.css"
import BackButton from "./BackButton"
import { showToast } from "../common/ChatToaster"

const MAX_RESENDS = 3
const COUNTDOWN = 60

function OTPVerification() {
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [timer, setTimer] = useState(COUNTDOWN)
  const [isResendDisabled, setIsResendDisabled] = useState(true)
  const [resendCount, setResendCount] = useState(0)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const emailFromState = location.state?.email || ""
  const sourceFromState = location.state?.source || "" // "forgot" nếu đến từ ForgotPassword
  const otpRefs = useRef([])

  // đang ở luồng quên mật khẩu?
  const isForgotFlow = useMemo(() => {
    if (sourceFromState === "forgot") return true
    return !!sessionStorage.getItem("forgot-email")
  }, [sourceFromState])

  // Khởi tạo email + start countdown
  useEffect(() => {
    const savedSignupRaw =
      sessionStorage.getItem("signup-payload") ||
      localStorage.getItem("signup-payload") ||
      "{}"
    const savedSignup = JSON.parse(savedSignupRaw)

    const fromForgot = sessionStorage.getItem("forgot-email") || ""
    const initEmail = emailFromState || fromForgot || savedSignup.email || ""
    setEmail(initEmail)

    setIsResendDisabled(true)
    setTimer(COUNTDOWN)
  }, [emailFromState])

  // countdown
  useEffect(() => {
    if (!isResendDisabled) return
    if (timer <= 0) {
      setIsResendDisabled(false)
      return
    }
    const id = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(id)
  }, [isResendDisabled, timer])

  const handleResendOtp = async () => {
    if (resendCount >= MAX_RESENDS) {
      setError("Bạn đã hết số lần gửi lại OTP.")
      return
    }
    if (isResendDisabled) return

    setLoading(true)
    setError("")
    try {
      if (isForgotFlow) {
        await forgotPasswordSendOtp(email)
      } else {
        const savedRaw =
          sessionStorage.getItem("signup-payload") ||
          localStorage.getItem("signup-payload")
        if (!savedRaw) throw new Error("Thiếu dữ liệu đăng ký để gửi lại OTP.")
        const payload = JSON.parse(savedRaw)
        if (!payload?.email) throw new Error("Không xác định được email.")
        await apiRegister(payload)
      }

      setOtp(["", "", "", "", "", ""])
      otpRefs.current[0]?.focus()
      setResendCount((c) => c + 1)
      setIsResendDisabled(true)
      setTimer(COUNTDOWN)
      showToast({ title: "Đã gửi lại mã OTP!", type: "success" })
    } catch (e) {
      setError(e.message || "Không gửi lại được OTP. Vui lòng thử lại.")
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const next = [...otp]
    next[index] = value.slice(-1)
    setOtp(next)
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleVerifyOtp = async () => {
    const otpString = otp.join("")
    if (otpString.length !== 6) {
      setError("Vui lòng nhập đầy đủ 6 chữ số!")
      return
    }
    setError("")
    setLoading(true)
    try {
      if (isForgotFlow) {
        // Xác thực OTP quên mật khẩu → sang trang đặt lại mật khẩu
        await forgotPasswordVerifyOtp({ email, otp: otpString })
        showToast({ title: "OTP hợp lệ! Vui lòng đặt lại mật khẩu.", type: "success", duration: 2200 })
        sessionStorage.setItem("forgot-email", email) // giữ lại cho trang reset
        navigate("/reset-password", { state: { email, source: "forgot" } })
      } else {
        // Xác thực OTP đăng ký → về login
        await verifyRegisterOtpApi({ email, otp: otpString })
        showToast({ title: "Đăng ký thành công!", type: "success", duration: 2500 })
        sessionStorage.removeItem("signup-payload")
        navigate("/login")
      }
    } catch (err) {
      setError(err.message || "Mã OTP không đúng!")
    } finally {
      setLoading(false)
    }
  }

  // Hiệu ứng tuyết
  const renderSnow = () => {
    const flakes = useMemo(
      () =>
        Array.from({ length: 70 }, (_, i) => ({
          id: i,
          left: Math.random() * 100,
          delay: Math.random() * 3,
          size: Math.random() * 12 + 8,
        })),
      []
    )
    return (
      <div className="otp-snow-container" aria-hidden="true">
        {flakes.map((s) => (
          <div
            key={`snow-${s.id}`}
            className="otp-snowflake"
            style={{
              left: `${s.left}%`,
              animationDelay: `${s.delay}s`,
              fontSize: `${s.size}px`,
            }}
          >
            ❄
          </div>
        ))}
      </div>
    )
  }

  // Hàng ⛄ 🎄
  const renderWinterLine = () => {
    const row = ["⛄", "🎄", "⛄", "🎄", "⛄", "🎄", "⛄", "🎄", "⛄"]
    return (
      <div className="otp-winter-line" aria-hidden="true">
        {row.map((ch, idx) => (
          <div
            key={idx}
            className={`otp-winter-item ${ch === "⛄" ? "otp-snowman" : "otp-pine"}`}
          >
            {ch}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="otp-page">
      <BackButton to={isForgotFlow ? "/forgot-password" : "/signup"} position="left" />
      <div className="otp-weather-layer">{renderSnow()}</div>

      <div className="otp-hero">
        <div className="otp-hero-text">
          <div className="otp-welcome otp-center">
            <h1>Xác thực OTP</h1>
            <p>
              {isForgotFlow
                ? "Nhập mã 6 chữ số đã được gửi tới email để xác thực trước khi đặt lại mật khẩu."
                : "Nhập mã 6 chữ số đã được gửi tới email của bạn để hoàn tất đăng ký."}
            </p>
          </div>
        </div>

        <div className="otp-panel">
          <div className="otp-form">
            <form onSubmit={(e) => e.preventDefault()}>
              {/* Email + Gửi lại */}
              <div className="otp-field">
                <div className="otp-phone-row">
                  <div className="otp-phone-input">
                    <span className="otp-input-icon">📧</span>
                    <input type="email" value={email} readOnly placeholder="Email" />
                  </div>

                  <button
                    type="button"
                    className={`otp-send-btn ${isResendDisabled ? "disabled" : ""}`}
                    onClick={handleResendOtp}
                    disabled={isResendDisabled || resendCount >= MAX_RESENDS || loading}
                    title={
                      resendCount >= MAX_RESENDS
                        ? "Đã hết lượt gửi lại"
                        : isResendDisabled
                        ? `Chờ ${timer}s`
                        : "Gửi lại mã"
                    }
                  >
                    {resendCount >= MAX_RESENDS
                      ? "Hết lượt"
                      : isResendDisabled
                      ? `(${timer}s)`
                      : "Gửi lại mã"}
                  </button>
                </div>
              </div>

              {/* Ô nhập 6 số */}
              <div className="otp-field">
                <div className="otp-code-container">
                  {otp.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      type="text"
                      value={d}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="otp-digit-input"
                      maxLength="1"
                      inputMode="numeric"
                    />
                  ))}
                </div>
                {error && <div className="otp-note otp-error">{error}</div>}
                {loading && <div className="otp-note otp-loading">Đang xử lý...</div>}
              </div>

              <button
                type="button"
                className="otp-primary-btn"
                onClick={handleVerifyOtp}
                disabled={loading}
              >
                Xác thực
              </button>
            </form>

            <div className="otp-auth-switch">
              <span className="otp-auth-text">
                {isForgotFlow ? "Quay lại?" : "Chưa có tài khoản?"}
              </span>
              <Link className="otp-auth-link" to={isForgotFlow ? "/forgot-password" : "/signup"}>
                {isForgotFlow ? "Quên mật khẩu" : "Đăng ký"}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {renderWinterLine()}
    </div>
  )
}

export default OTPVerification
