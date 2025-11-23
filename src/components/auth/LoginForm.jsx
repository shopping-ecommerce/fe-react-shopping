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
        // dùng apiUrl để không bị dính localhost
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

        {/* Layer emoji có thể kéo-thả & rơi chậm */}
        <InteractiveWinter />
      </div>
    </>
  );
}

/* ================== COMPONENT KÉO-THẢ & RƠI CHẬM VỀ VỊ TRÍ CŨ ================== */
function InteractiveWinter() {
  const items = ["⛄", "🎄", "⛄", "🎄", "⛄", "🎄", "⛄", "🎄", "⛄"];
  const slots = [6, 17, 28, 39, 50, 61, 72, 83, 94];
  const size =
    typeof window !== "undefined" && window.innerWidth <= 920 ? 36 : 48;

  return (
    <div className="drag-layer" aria-hidden="true">
      {items.map((ch, i) => (
        <DraggableEmoji
          key={i}
          ch={ch}
          initXPercent={slots[i]}
          size={size}
          groundOffset={90}
          bounce={0.35}
          swayAmpFall={80}
          swayOmegaFall={1.8}
        />
      ))}
    </div>
  );
}

function DraggableEmoji({
  ch,
  initXPercent = 50,
  size = 48,
  groundOffset = 90,
  bounce = 0.35,
  swayAmpFall = 80,
  swayOmegaFall = 1.8,
}) {
  const wrapRef = useRef(null);
  const raf = useRef(0);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ x: 0, y: 0 });
  const lastT = useRef(0);
  const fallClock = useRef(0);
  const isFallingRef = useRef(false);
  const isReturningRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const originalPosRef = useRef({ x: 0, y: 0 });

  const [pos, setPos] = useState(() => {
    const initX =
      ((typeof window !== "undefined" ? window.innerWidth : 0) * initXPercent) /
        100 -
      size / 2;
    const initY =
      (typeof window !== "undefined" ? window.innerHeight : 0) -
      groundOffset -
      size;
    originalPosRef.current = { x: initX, y: initY };
    return { x: initX, y: initY };
  });
  const [dragging, setDragging] = useState(false);
  const [idle, setIdle] = useState(true);

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const floorY = () =>
    (typeof window === "undefined" ? 0 : window.innerHeight) -
    groundOffset -
    size;
  const leftBound = () => 0;
  const rightBound = () =>
    (typeof window === "undefined" ? 0 : window.innerWidth) - size;

  const step = (t) => {
    if (!lastT.current) lastT.current = t;
    const dt = Math.min((t - lastT.current) / 1000, 0.033);
    lastT.current = t;
    fallClock.current += dt;

    // ===== PHASE 1: RƠI TỰ DO CÓ TRỌNG LỰC =====
    if (!isReturningRef.current) {
      const g = 800;
      const airDrag = 0.015;
      const maxFallSpeed = 300;

      velRef.current.y += g * dt;
      const dragForce = airDrag * velRef.current.y * Math.abs(velRef.current.y);
      velRef.current.y -= dragForce * dt;

      if (velRef.current.y > maxFallSpeed) {
        velRef.current.y = maxFallSpeed;
      }

      const swayForce =
        swayAmpFall * 1.5 * Math.sin(fallClock.current * swayOmegaFall);
      velRef.current.x += swayForce * dt;
      const dragX = airDrag * velRef.current.x * Math.abs(velRef.current.x);
      velRef.current.x -= dragX * dt;

      let nx = pos.x + velRef.current.x * dt;
      let ny = pos.y + velRef.current.y * dt;

      if (nx < leftBound()) {
        nx = leftBound();
        velRef.current.x *= -bounce;
      }
      if (nx > rightBound()) {
        nx = rightBound();
        velRef.current.x *= -bounce;
      }

      const fy = floorY();
      if (ny >= fy) {
        ny = fy;
        velRef.current.y = -Math.abs(velRef.current.y) * bounce;
        velRef.current.x *= 0.85;

        // Kiểm tra xem nên bắt đầu quay về vị trí cũ không
        if (
          Math.abs(velRef.current.y) < 50 &&
          Math.abs(velRef.current.x) < 30
        ) {
          isReturningRef.current = true;
          velRef.current = { x: 0, y: 0 };
        }
      }

      setPos({ x: nx, y: ny });
    }

    // ===== PHASE 2: TRỞ VỀ VỊ TRÍ GỐC =====
    else {
      const targetX = originalPosRef.current.x;
      const targetY = originalPosRef.current.y;

      const dx = targetX - pos.x;
      const dy = targetY - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 2) {
        // Đã về đúng vị trí
        cancelAnimationFrame(raf.current);
        raf.current = 0;
        isFallingRef.current = false;
        isReturningRef.current = false;
        setPos({ x: targetX, y: targetY });
        setIdle(true);
        return;
      }

      const returnSpeed = 200;
      const moveSpeed = Math.min(returnSpeed * dt, dist);
      const ratio = moveSpeed / dist;

      const nx = pos.x + dx * ratio;
      const ny = pos.y + dy * ratio;

      setPos({ x: nx, y: ny });
    }

    raf.current = requestAnimationFrame(step);
  };

  const onDown = (e) => {
    e.preventDefault();
    const point = e.touches ? e.touches[0] : e;
    const rect = wrapRef.current.getBoundingClientRect();
    offsetRef.current = {
      x: point.clientX - rect.left,
      y: point.clientY - rect.top,
    };
    dragStartPosRef.current = { x: pos.x, y: pos.y };
    draggingRef.current = true;
    setDragging(true);
    setIdle(false);
    isFallingRef.current = false;
    isReturningRef.current = false;

    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    }

    velRef.current = { x: 0, y: 0 };
    lastT.current = 0;
    fallClock.current = 0;
  };

  const onMove = (e) => {
    if (!draggingRef.current) return;
    const point = e.touches ? e.touches[0] : e;
    const nx = clamp(
      point.clientX - offsetRef.current.x,
      leftBound(),
      rightBound()
    );
    const ny = clamp(point.clientY - offsetRef.current.y, 0, floorY());
    setPos({ x: nx, y: ny });
  };

  const onUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);

    const currentY = pos.y;
    const groundY = floorY();
    const dragDeltaX = pos.x - dragStartPosRef.current.x;
    const dragDeltaY = pos.y - dragStartPosRef.current.y;

    const isVerticalDrag = Math.abs(dragDeltaY) > Math.abs(dragDeltaX) * 1.5;
    const isPulledUp = dragDeltaY < -30;

    // Kéo lên trên: rơi mềm + quay về
    if (isVerticalDrag && isPulledUp) {
      isFallingRef.current = true;
      isReturningRef.current = false;
      velRef.current = { x: 0, y: 0 };
      lastT.current = 0;
      fallClock.current = 0;

      if (!raf.current) {
        raf.current = requestAnimationFrame(step);
      }
    }
    // Kéo ngang mạnh: rơi + nảy rồi quay về
    else if (!isVerticalDrag && Math.abs(dragDeltaX) > 40) {
      isFallingRef.current = true;
      isReturningRef.current = false;
      velRef.current = { x: dragDeltaX * 0.5, y: 0 };
      lastT.current = 0;
      fallClock.current = 0;

      if (!raf.current) {
        raf.current = requestAnimationFrame(step);
      }
    }
    // Không kéo nhiều: về thẳng
    else {
      if (
        currentY < groundY - 5 ||
        Math.abs(pos.x - originalPosRef.current.x) > 5
      ) {
        isFallingRef.current = true;
        isReturningRef.current = false;
        velRef.current = { x: 0, y: 0 };
        lastT.current = 0;
        fallClock.current = 0;

        if (!raf.current) {
          raf.current = requestAnimationFrame(step);
        }
      } else {
        setPos({ x: originalPosRef.current.x, y: originalPosRef.current.y });
        setIdle(true);
      }
    }
  };

  useEffect(() => {
    const opt = { passive: false };

    const handleMouseMove = (e) => onMove(e);
    const handleMouseUp = () => onUp();
    const handleTouchMove = (e) => onMove(e);
    const handleTouchEnd = () => onUp();

    window.addEventListener("mousemove", handleMouseMove, opt);
    window.addEventListener("mouseup", handleMouseUp, opt);
    window.addEventListener("touchmove", handleTouchMove, opt);
    window.addEventListener("touchend", handleTouchEnd, opt);

    const handleResize = () => {
      const newFloorY =
        (typeof window === "undefined" ? 0 : window.innerHeight) -
        groundOffset -
        size;
      const newWidth = typeof window === "undefined" ? 0 : window.innerWidth;
      const newOriginalX = (newWidth * initXPercent) / 100 - size / 2;
      const newOriginalY = newFloorY;

      originalPosRef.current = { x: newOriginalX, y: newOriginalY };

      setPos((p) => ({
        x: clamp(p.x, leftBound(), rightBound()),
        y: clamp(p.y, 0, newFloorY),
      }));
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("resize", handleResize);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [pos]);

  return (
    <div
      ref={wrapRef}
      className={`draggable-emoji ${dragging ? "dragging" : ""}`}
      style={{
        left: pos.x,
        top: pos.y,
        width: size,
        height: size,
        transition: dragging ? "none" : "none",
      }}
      onMouseDown={onDown}
      onTouchStart={onDown}
    >
      <span
        className={`emoji-char ${
          idle ? (ch === "🎄" ? "idle-sway-pine" : "idle-sway-snowman") : ""
        }`}
        style={{ fontSize: size }}
      >
        {ch}
      </span>
    </div>
  );
}

export default LoginForm;
