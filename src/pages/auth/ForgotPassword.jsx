// src/pages/auth/ForgotPassword.jsx
"use client"

import React, { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import styles from "../../styles/forgot.module.css"
import BackButton from "../../components/auth/BackButton"
import { forgotPasswordSendOtp } from "../../services/api"
import { showToast } from "../../components/common/ChatToaster" // ✅ thêm

function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState("")
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setNote("")
    try {
      setLoading(true)
      await forgotPasswordSendOtp(email.trim()) // 👈 GỌI API gửi OTP

      // ✅ Thông báo toast thành công
      showToast({
        title: "Đã gửi OTP!",
        message: `Mã xác thực đã được gửi tới ${email.trim()}.`,
        type: "success",
        duration: 2500,
      })

      // Lưu email để OTP page có thể đọc khi reload
      sessionStorage.setItem("forgot-email", email.trim())

      // Điều hướng sang trang OTP, truyền kèm state để ưu tiên hiển thị
      navigate("/otp-verification", { state: { email: email.trim(), source: "forgot" } })
    } catch (err) {
      const msg = err?.message || "Không thể gửi OTP. Vui lòng thử lại!"
      setNote(msg)

      // ❌ Toast lỗi cho đồng bộ trải nghiệm
      showToast({
        title: "Gửi OTP thất bại",
        message: msg,
        type: "error",
        duration: 3000,
      })
    } finally {
      setLoading(false)
    }
  }

  const renderSnow = () => {
    const snowflakes = useMemo(
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
      <div className={styles.snowContainer} aria-hidden="true">
        {snowflakes.map((s) => (
          <div
            key={`snow-${s.id}`}
            className={styles.snowflake}
            style={{ left: `${s.left}%`, animationDelay: `${s.delay}s`, fontSize: `${s.size}px` }}
          >
            ❄
          </div>
        ))}
      </div>
    )
  }

  const renderWinterLine = () => {
    const row = ["⛄", "🎄", "⛄", "🎄", "⛄", "🎄", "⛄", "🎄", "⛄"]
    return (
      <div className={styles.winterLine} aria-hidden="true">
        {row.map((ch, idx) => (
          <div
            key={idx}
            className={`${styles.winterItem} ${ch === "⛄" ? styles.snowman : styles.pine}`}
          >
            {ch}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`${styles.page} ${styles.leftNudge}`}>
      <BackButton to="/login" position="left" />
      <div className={styles.weatherLayer}>{renderSnow()}</div>

      <div className={styles.hero}>
        <div className={styles.heroText}>
          <div className={`${styles.welcome} ${styles.center}`}>
            <h1>Xin chào.</h1>
            <p>Nhập email để khôi phục lại mật khẩu của bạn.</p>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.form}>
            <form onSubmit={handleSubmit}>
              <h2 className={`${styles.formTitle} ${styles.center}`}>Quên mật khẩu</h2>

              {note && <div className={`${styles.note} ${styles.info}`}>{note}</div>}

              <div className={styles.field}>
                <div className={styles.inputContainer}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                  />
                  <span className={styles.inputIcon}>📧</span>
                </div>
              </div>

              <button className={styles.button} type="submit" disabled={loading}>
                {loading ? "Đang gửi…" : "Gửi OTP"}
              </button>
            </form>

            <div className={styles.authSwitch}>
              <span className={styles.authText}>Nhớ mật khẩu?</span>
              <Link className={styles.authLinkPlain} to="/login">
                Đăng nhập
              </Link>
            </div>
          </div>
        </div>
      </div>

      {renderWinterLine()}
    </div>
  )
}

export default ForgotPassword
