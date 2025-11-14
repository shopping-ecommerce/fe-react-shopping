// src/pages/auth/ResetPassword.jsx
"use client"

import React, { useMemo, useState, useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import styles from "../../styles/reset.module.css"
import BackButton from "../../components/auth/BackButton"
import { forgotPasswordResetPassword } from "../../services/api"
import { showToast } from "../../components/common/ChatToaster"

function ResetPassword() {
  const [email, setEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState("")
  const navigate = useNavigate()
  const location = useLocation()

  // Lấy email từ state hoặc sessionStorage('forgot-email')
  useEffect(() => {
    const emailFromState = location.state?.email || ""
    const emailFromStore = sessionStorage.getItem("forgot-email") || ""
    setEmail(emailFromState || emailFromStore)
  }, [location.state])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setNote("")
    if (!email?.trim()) {
      setNote("Thiếu email để đặt lại mật khẩu. Vui lòng quay lại bước Quên mật khẩu.")
      return
    }
    if (!newPassword || !confirmPassword) {
      setNote("Vui lòng nhập đầy đủ mật khẩu mới và xác nhận mật khẩu.")
      return
    }
    if (newPassword !== confirmPassword) {
      setNote("Mật khẩu xác nhận không khớp.")
      return
    }

    try {
      setLoading(true)
      await forgotPasswordResetPassword({
        email: email.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      showToast({ title: "Đặt lại mật khẩu thành công!", type: "success" })
      // Xoá email lưu tạm (tuỳ chọn)
      sessionStorage.removeItem("forgot-email")
      navigate("/login")
    } catch (err) {
      setNote(err?.message || "Không thể đặt lại mật khẩu. Vui lòng thử lại!")
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
      <BackButton to="/forgot-password" position="left" />
      <div className={styles.weatherLayer}>{renderSnow()}</div>

      <div className={styles.hero}>
        <div className={styles.heroText}>
          <div className={`${styles.welcome} ${styles.center}`}>
            <h1>Đặt lại mật khẩu</h1>
            <p>Nhập mật khẩu mới để hoàn tất khôi phục tài khoản của bạn.</p>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.form}>
            <form onSubmit={handleSubmit}>
              <h2 className={`${styles.formTitle} ${styles.center}`}>Mật khẩu mới</h2>

              {note && <div className={`${styles.note} ${styles.info}`}>{note}</div>}

              {/* Email (readonly) */}
              <div className={styles.field}>
                <div className={styles.inputContainer}>
                  <input type="email" value={email} readOnly placeholder="Email" />
                  <span className={styles.inputIcon}>📧</span>
                </div>
              </div>

              {/* New password */}
              <div className={styles.field}>
                <div className={styles.passwordContainer}>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mật khẩu mới"
                    required
                  />
                  <span className={styles.inputIcon}>🔒</span>
                </div>
              </div>

              {/* Confirm password */}
              <div className={styles.field}>
                <div className={styles.passwordContainer}>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    required
                  />
                  <span className={styles.inputIcon}>🔒</span>
                </div>
              </div>

              <button className={styles.button} type="submit" disabled={loading}>
                {loading ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
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

export default ResetPassword
