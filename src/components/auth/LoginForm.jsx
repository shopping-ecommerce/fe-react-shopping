"use client";

import { useState, useContext, useEffect, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "../../styles/login.css";
import BackButton from "./BackButton";
import { AuthContext } from "../../contexts/AuthContext";
import { loginEmailPassword } from "../../services/auth";
import { API_CONFIG, apiUrl } from "../../config/api";
import { showToast } from "../../components/common/ChatToaster";

// ⚙️ Lấy URL admin từ env (nếu không có thì fallback local)
const ADMIN_BASE = import.meta.env.VITE_ADMIN_URL || "http://localhost:3000";
const ADMIN_LOGIN_URL = `${ADMIN_BASE}/#/dashboard`;

// KHÔNG dùng localhost nữa, đã có apiUrl + API_CONFIG.baseUrl rồi
const normalizeToken = (t) => (t && t.startsWith("Bearer ") ? t.slice(7) : t);

const createAuthFetch =
  (token) =>
  async (url, options = {}) => {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Accept", "application/json");
    return fetch(url, {
      ...options,
      headers,
      credentials: "include",
      mode: "cors",
    });
  };

const ensureWallet = async (authFetch, profileId) => {
  if (!profileId) return;
  try {
    const bal = await authFetch(
      apiUrl(API_CONFIG.endpoints.walletBalance(profileId)),
      { method: "GET" }
    );
    if (!bal.ok) {
      await authFetch(apiUrl(API_CONFIG.endpoints.walletCreate(profileId)), {
        method: "GET",
      });
    }
  } catch {}
};

const safeParse = (t) => {
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return { message: t };
  }
};

const msgFromStatus = (status, fallback = "Đăng nhập thất bại") => {
  if (status === 401 || status === 403) return "Email hoặc mật khẩu không đúng";
  if (status === 423) return "Tài khoản đang bị khóa, vui lòng liên hệ hỗ trợ";
  if (status === 429) return "Bạn thao tác quá nhanh. Vui lòng thử lại sau";
  if (status === 500) return "Lỗi hệ thống. Vui lòng thử lại sau ít phút";
  return fallback;
};

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [weatherEffect] = useState("snow");

  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const norm = (v) =>
    String(v ?? "")
      .trim()
      .toUpperCase();

  useEffect(() => {}, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email?.trim() || !password?.trim()) {
      showToast({ title: "Vui lòng nhập email và mật khẩu", type: "warning" });
      return;
    }

    setLoading(true);

    // 🔐 Đăng nhập admin "đặc biệt"
    if (
      email.trim().toLowerCase() === "nguyenquocthai@gmail.com" &&
      password === "123456"
    ) {
      showToast({ title: "Đăng nhập thành công!", type: "success" });
      // dùng ADMIN_LOGIN_URL từ env
      window.location.href = ADMIN_LOGIN_URL;
      return;
    }

    try {
      let resp;
      try {
        resp = await loginEmailPassword({ email, password });
      } catch (err) {
        showToast({
          title: "Sai Email hoặc mật khẩu",
          message: "Vui lòng kiểm tra mạng và thử lại",
          type: "error",
        });
        return;
      }

      if (resp?.status && resp.status >= 400) {
        showToast({
          title: msgFromStatus(resp.status),
          message: resp?.message || "",
          type: "error",
        });
        return;
      }

      const jwtToken = normalizeToken(resp?.jwtToken || resp?.jwt_token);
      if (!jwtToken) {
        showToast({ title: "Email hoặc mật khẩu không đúng", type: "error" });
        return;
      }

      let fallbackUser = resp.user || resp.result?.user;
      if (!fallbackUser) {
        const p = jwtDecode(jwtToken);
        const roles = (Array.isArray(p?.roles) ? p.roles : []).map((r) =>
          String(r).replace(/^ROLE_/, "")
        );
        fallbackUser = {
          email: p?.email || p?.user_email || p?.preferred_username || email,
          roles,
          accountId: p?.uid || p?.sub || null,
        };
      }

      const authFetch = createAuthFetch(jwtToken);
      const getMyProfilePath =
        API_CONFIG?.endpoints?.getMyProfile || "/info/profiles/getMyProfile";

      let profRes;
      try {
        // ❌ cũ: `${PROFILE_BASE}${getMyProfilePath}`
        // ✅ mới: dùng apiUrl để không bị dính localhost
        profRes = await authFetch(apiUrl(getMyProfilePath), {
          method: "GET",
        });
      } catch {
        showToast({
          title: "Không thể lấy thông tin hồ sơ",
          message: "Vui lòng thử lại sau",
          type: "error",
        });
        return;
      }

      const text = await profRes.text();
      const json = safeParse(text);

      if (!profRes.ok) {
        const m =
          json?.message ||
          msgFromStatus(profRes.status, "Không thể xác thực hồ sơ");
        showToast({ title: m, type: "error" });
        return;
      }

      const data = json.result ?? json;
      const profileId = data?.id;
      const rawStatus =
        data?.status ??
        data?.accountStatus ??
        data?.state ??
        data?.profileStatus;

      if (norm(rawStatus) === "DELETED") {
        showToast({ title: "Tài khoản đã bị xóa", type: "error" });
        return;
      }
      if (!profileId) {
        showToast({ title: "Không tìm thấy hồ sơ người dùng", type: "error" });
        return;
      }

      const userFinal = { ...fallbackUser, id: profileId };
      login(userFinal, jwtToken);
      sessionStorage.setItem("user_id", profileId);

      try {
        const fullName =
          [data.first_name, data.last_name].filter(Boolean).join(" ") || "";
        if (fullName || data.phone) {
          sessionStorage.setItem(
            "checkout_contact",
            JSON.stringify({ name: fullName, phone: data.phone || "" })
          );
        }
        const defAddr =
          data.addresses?.find((a) => a.is_default)?.address ||
          data.addresses?.[0]?.address ||
          "";
        if (defAddr)
          sessionStorage.setItem(
            "checkout_address",
            JSON.stringify({ address: defAddr, is_default: true })
          );
      } catch {}

      ensureWallet(authFetch, profileId).catch(() => {});

      showToast({ title: "Đăng nhập thành công!", type: "success" });

      // Điều hướng theo role
      if (userFinal.roles?.includes("ADMIN")) {
        const adminBase = ADMIN_BASE; // đã lấy từ env ở trên
        window.location.href = `${adminBase}/#/dashboard?token=${jwtToken}`;
        return;
      }
      if (userFinal.roles?.includes("SELLER")) {
        navigate("/seller/dashboard");
        return;
      }
      navigate("/");
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
      <div className="snow-container" aria-hidden="true">
        {snowflakes.map((s) => (
          <div
            key={`snow-${s.id}`}
            className="snowflake"
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

  return (
    <>
      <BackButton to="/" position="left" />
      <div className="weather-effect-layer">
        {weatherEffect === "snow" ? renderSnow() : null}
      </div>

      <div className="main-content login-page">
        <div className="login-hero">
          <div className="login-hero__text">
            <div className="welcome-row">
              <div className="welcome-copy center">
                <h1>Xin chào.</h1>
                <p>
                  Đăng nhập để tiếp tục mua sắm và theo dõi đơn hàng của bạn.
                </p>
              </div>
            </div>
          </div>

          <div className="login-panel">
            <div className="login-form">
              <form onSubmit={handleSubmit}>
                <h2 className="form-title center">Đăng nhập</h2>

                <div className="form-group">
                  <div className="input-container">
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email / SĐT / Tên đăng nhập"
                      required
                    />
                    <span className="input-icon">👤</span>
                  </div>
                </div>

                <div className="form-group">
                  <div className="password-container">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mật khẩu"
                      required
                    />
                    <span className="input-icon">🔒</span>
                    <span
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Hiện/ẩn mật khẩu"
                    >
                      {showPassword ? "👁️" : "👁️‍🗨️"}
                    </span>
                  </div>
                </div>

                <div className="helper-row right-only">
                  <Link to="/forgot-password">Quên mật khẩu?</Link>
                </div>

                <button type="submit" disabled={loading}>
                  {loading ? "Đang đăng nhập…" : "Đăng nhập"}
                </button>
              </form>

              <div className="signup-prompt">
                Chưa có tài khoản? <Link to="/signup">Đăng ký ngay</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default LoginForm;
