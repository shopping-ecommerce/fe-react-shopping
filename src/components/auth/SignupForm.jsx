"use client";

import React, { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register as registerApi } from "../../services/auth";
import styles from "../../styles/signup.module.css";
import BackButton from "./BackButton";
import { showToast } from "../../components/common/ChatToaster";

function SignupForm() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasswordRules, setShowPasswordRules] = useState(false);
  const navigate = useNavigate();

  // 👉 Kiểm tra điều kiện mật khẩu
  const passwordRules = useMemo(
    () => ({
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    }),
    [password]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Chặn submit nếu mật khẩu không đạt rule
    if (
      !passwordRules.length ||
      !passwordRules.upper ||
      !passwordRules.special
    ) {
      const msg =
        "Mật khẩu có ít nhất 8 ký tự, 1 chữ in hoa và 1 ký tự đặc biệt.";
      setError(msg);
      showToast({
        title: "Mật khẩu chưa hợp lệ",
        message: msg,
        type: "warning",
      });
      return;
    }

    if (password !== confirmPassword) {
      const msg = "Mật khẩu và mật khẩu xác nhận không khớp!";
      setError(msg);
      showToast({
        title: "Mật khẩu không khớp",
        message: msg,
        type: "warning",
      });
      return;
    }

    const payload = {
      email: email.trim(),
      password,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    };

    try {
      setLoading(true);
      await registerApi(payload);

      sessionStorage.setItem("signup-payload", JSON.stringify(payload));
      localStorage.setItem("signup-payload", JSON.stringify(payload));

      showToast({
        title: "Đăng ký thành công",
        message: "Mã xác thực đã được gửi đến email của bạn.",
        type: "success",
      });

      navigate("/otp-verification", { state: { email } });
    } catch (err) {
      const msg = "Đăng ký thất bại. Vui lòng thử lại sau!";
      setError(msg);
      showToast({
        title: "Đăng ký thất bại",
        message: msg,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

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
    );
    return (
      <div className={styles.snowContainer} aria-hidden="true">
        {snowflakes.map((s) => (
          <div
            key={`snow-${s.id}`}
            className={styles.snowflake}
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
    );
  };

  const renderWinterLine = () => {
    const row = ["⛄", "🎄", "⛄", "🎄", "⛄", "🎄", "⛄", "🎄", "⛄"];
    return (
      <div className={styles.winterLine} aria-hidden="true">
        {row.map((ch, idx) => (
          <div
            key={idx}
            className={`${styles.winterItem} ${
              ch === "⛄" ? styles.snowman : styles.pine
            }`}
          >
            {ch}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`${styles.page} ${styles.leftNudge}`}>
      <BackButton to="/login" position="left" />
      <div className={styles.weatherLayer}>{renderSnow()}</div>

      <div className={styles.hero}>
        <div className={styles.heroText}>
          <div className={`${styles.welcome} ${styles.center}`}>
            <h1>Xin chào.</h1>
            <p>
              Tạo tài khoản để bắt đầu mua sắm và theo dõi đơn hàng của bạn.
            </p>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.form}>
            <form onSubmit={handleSubmit}>
              <h2 className={`${styles.formTitle} ${styles.center}`}>
                Đăng ký
              </h2>

              {error && (
                <div className={`${styles.note} ${styles.error}`}>{error}</div>
              )}
              {loading && (
                <div className={`${styles.note} ${styles.loading}`}>
                  Đang xử lý...
                </div>
              )}

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

              <div className={styles.row}>
                <div className={`${styles.field} ${styles.col}`}>
                  <div className={styles.inputContainer}>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Tên đầu"
                      required
                    />
                    <span className={styles.inputIcon}>👤</span>
                  </div>
                </div>
                <div className={`${styles.field} ${styles.col}`}>
                  <div className={styles.inputContainer}>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Tên cuối"
                      required
                    />
                    <span className={styles.inputIcon}>👤</span>
                  </div>
                </div>
              </div>

              {/* Ô mật khẩu + checklist rule */}
              <div className={styles.field}>
                {/* Checklist nằm TRÊN ô mật khẩu & chỉ hiện khi đã focus */}
                {showPasswordRules && (
                  <ul className={styles.passwordHint}>
                    <li className={styles.passwordHintItem}>
                      <span
                        className={`${styles.checkIcon} ${
                          passwordRules.length
                            ? styles.checkIconOk
                            : styles.checkIconPending
                        }`}
                      >
                        {passwordRules.length ? "✓" : ""}
                      </span>
                      <span
                        className={
                          passwordRules.length
                            ? styles.hintLabelOk
                            : styles.hintLabelPending
                        }
                      >
                        Ít nhất 8 ký tự
                      </span>
                    </li>

                    <li className={styles.passwordHintItem}>
                      <span
                        className={`${styles.checkIcon} ${
                          passwordRules.upper
                            ? styles.checkIconOk
                            : styles.checkIconPending
                        }`}
                      >
                        {passwordRules.upper ? "✓" : ""}
                      </span>
                      <span
                        className={
                          passwordRules.upper
                            ? styles.hintLabelOk
                            : styles.hintLabelPending
                        }
                      >
                        Có ít nhất 1 chữ cái in hoa (A–Z)
                      </span>
                    </li>

                    <li className={styles.passwordHintItem}>
                      <span
                        className={`${styles.checkIcon} ${
                          passwordRules.special
                            ? styles.checkIconOk
                            : styles.checkIconPending
                        }`}
                      >
                        {passwordRules.special ? "✓" : ""}
                      </span>
                      <span
                        className={
                          passwordRules.special
                            ? styles.hintLabelOk
                            : styles.hintLabelPending
                        }
                      >
                        Có ít nhất 1 ký tự đặc biệt (ví dụ: !@#$%&amp;*)
                      </span>
                    </li>
                  </ul>
                )}

                <div className={styles.passwordContainer}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setShowPasswordRules(true)}
                    placeholder="Mật khẩu"
                    required
                  />
                  <span className={styles.inputIcon}>🔒</span>
                  <span
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Hiện/ẩn mật khẩu"
                  >
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </span>
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.passwordContainer}>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    required
                  />
                  <span className={styles.inputIcon}>🔒</span>
                  <span
                    className={styles.passwordToggle}
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    aria-label="Hiện/ẩn mật khẩu xác nhận"
                  >
                    {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                  </span>
                </div>
              </div>

              <button
                className={styles.button}
                type="submit"
                disabled={loading}
              >
                {loading ? "Đang đăng ký…" : "Đăng ký"}
              </button>
            </form>

            <div className={styles.authSwitch}>
              <span className={styles.authText}>Đã có tài khoản?</span>
              <Link className={styles.authLinkPlain} to="/login">
                Đăng nhập
              </Link>
            </div>
          </div>
        </div>
      </div>

      {renderWinterLine()}
    </div>
  );
}

export default SignupForm;
