// src/pages/seller/profile/ProfileSeller.jsx
import React, { useEffect, useMemo, useRef, useState, useContext } from "react";
import { NavLink } from "react-router-dom";
import "../../../styles/SellerProfile.css";
import { API_CONFIG, apiUrl } from "../../../config/api";
import { AuthContext } from "../../../contexts/AuthContext";

export default function ProfileSeller() {
  const { authFetch } = useContext(AuthContext) || {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // ✨ chế độ chỉnh sửa
  const [editing, setEditing] = useState(false);

  // ===== Resolve sellerId =====
  const [sellerId, setSellerId] = useState("");
  useEffect(() => {
    const fromLS =
      localStorage.getItem("seller_id") ||
      localStorage.getItem("sellerId") ||
      "";
    if (fromLS) {
      setSellerId(fromLS);
      return;
    }

    let cancelled = false;
    (async () => {
      if (!authFetch) return;
      try {
        const resProf = await authFetch(
          apiUrl(API_CONFIG.endpoints.getMyProfile),
          { headers: { Accept: "application/json" } }
        );
        const dataProf = await resProf.json().catch(() => ({}));
        if (!resProf.ok) throw new Error(dataProf?.message || "Lỗi profile");
        const userId = dataProf?.result?.id;

        const resSeller = await authFetch(
          apiUrl(API_CONFIG.endpoints.searchSellerByUserId(userId)),
          { headers: { Accept: "application/json" } }
        );
        const dataSeller = await resSeller.json().catch(() => ({}));
        if (!resSeller.ok) throw new Error(dataSeller?.message || "Lỗi seller");
        const sid = dataSeller?.result?.id || dataSeller?.result?.sellerId;
        if (!cancelled && sid) {
          setSellerId(sid);
          localStorage.setItem("seller_id", sid);
        }
      } catch (e) {
        setToast({
          type: "error",
          msg: e?.message || "Không tìm được sellerId",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // ===== Seller data =====
  const [seller, setSeller] = useState(null);
  const [shopName, setShopName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const avatarFileRef = useRef(null);

  // ➕ state mới cho Email & Địa chỉ (sửa ở hero)
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (!authFetch || !sellerId) return;
    let stop = false;
    (async () => {
      try {
        setLoading(true);
        const res = await authFetch(
          apiUrl(API_CONFIG.endpoints.searchSellerBySellerId(sellerId)),
          { headers: { Accept: "application/json" } }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
        if (stop) return;
        setSeller(data.result);
        setShopName(data.result?.shop_name || "");
        setAvatarPreview(data.result?.avatar_link || "");
        // nạp email & address
        setEmail(data.result?.email || "");
        setAddress(data.result?.address || "");
      } catch (e) {
        setToast({ type: "error", msg: e?.message || "Tải hồ sơ thất bại" });
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [authFetch, sellerId]);

  const prettyDate = (iso) =>
    iso ? new Date(iso).toLocaleString("vi-VN") : "—";

  // chỉ cho chọn ảnh khi đang chỉnh sửa
  const onPickAvatar = (e) => {
    if (!editing) {
      setToast({ type: "error", msg: "Hãy bấm 'Cập nhật' trước khi đổi ảnh." });
      e.target.value = "";
      return;
    }
    const f = e.target.files?.[0];
    if (f) {
      const url = URL.createObjectURL(f);
      setAvatarPreview(url);
    }
  };

  // ================== Helpers: LUÔN CÓ ẢNH GỬI LÊN ==================
  const dataURLToBlob = (dataUrl) => {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  };

  const TINY_PNG_DATAURL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9U6W8kQAAAAASUVORK5CYII=";

  const urlToFile = async (url, filename = "avatar-old") => {
    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) throw new Error(`Fetch avatar failed: HTTP ${resp.status}`);
    const blob = await resp.blob();
    const ext =
      blob.type === "image/png"
        ? "png"
        : blob.type === "image/jpeg"
        ? "jpg"
        : blob.type === "image/webp"
        ? "webp"
        : "bin";
    return new File([blob], `${filename}.${ext}`, {
      type: blob.type || "application/octet-stream",
    });
  };

  const getAvatarFileToSend = async (inputRef, currentAvatarUrl) => {
    const picked = inputRef.current?.files?.[0];
    if (picked) return picked;
    if (currentAvatarUrl) {
      try {
        return await urlToFile(currentAvatarUrl, "avatar-old");
      } catch (_) {}
    }
    const blob = dataURLToBlob(TINY_PNG_DATAURL);
    return new File([blob], "avatar-fallback.png", { type: "image/png" });
  };
  // =================================================================

  // Nút chính: Cập nhật ⇄ Lưu thay đổi
  const onPrimary = async () => {
    if (!editing) {
      setEditing(true);
      return;
    }
    await onSave();
  };

  const onSave = async () => {
    if (!authFetch || !sellerId) {
      setToast({ type: "error", msg: "Chưa có sellerId hoặc token." });
      return;
    }

    // (tuỳ chọn) validate email nhẹ
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setToast({ type: "error", msg: "Email không hợp lệ." });
      return;
    }

    try {
      setSaving(true);

      const fd = new FormData();

      // ✅ luôn gắn avatar: file mới | ảnh cũ từ URL | ảnh PNG nhỏ
      const avatarFile = await getAvatarFileToSend(
        avatarFileRef,
        seller?.avatar_link
      );
      fd.append("avatar", avatarFile);

      fd.append("sellerId", sellerId);
      fd.append("shopName", (shopName || "").trim());
      // ➕ gửi thêm email & address như API hỗ trợ
      fd.append("email", (email || "").trim());
      fd.append("address", (address || "").trim());

      const res = await authFetch(
        apiUrl(API_CONFIG.endpoints.updateSellerInfo),
        { method: "POST", body: fd }
      );

      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (_) {}

      if (!res.ok) {
        const beMsg = data?.message || text || `HTTP ${res.status}`;
        throw new Error(beMsg);
      }

      const result = data.result ?? data;
      setSeller(result);
      setShopName(result?.shop_name || "");
      setAvatarPreview(result?.avatar_link || avatarPreview);
      // cập nhật lại state để UI phản chiếu ngay
      setEmail(result?.email || "");
      setAddress(result?.address || "");

      try {
        localStorage.setItem("seller_store_name", result?.shop_name || "");
      } catch {}

      setToast({ type: "success", msg: "Cập nhật hồ sơ thành công!" });
      setEditing(false);
    } catch (e) {
      console.error("❌ updateInfSeller:", e);
      setToast({ type: "error", msg: `Cập nhật thất bại: ${e.message}` });
    } finally {
      setSaving(false);
    }
  };

  // Tabs & scroll
  const [tab, setTab] = useState("login");
  const secLoginRef = useRef(null);
  const secShopRef = useRef(null);
  const sectionRefs = useMemo(
    () => ({ login: secLoginRef, shop: secShopRef }),
    []
  );
  const go = (key) => {
    setTab(key);
    setTimeout(() => {
      sectionRefs[key]?.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  return (
    <div className="sp-page">
      {/* Header */}
      <div className="sp-header">
        <div className="sp-breadcrumb">
          <NavLink to="/seller/home" className="sp-crumb-link">
            Trang chủ
          </NavLink>
        </div>
        <div className="sp-head-row">
          <h1 className="sp-title">Hồ sơ nhà bán</h1>
        </div>
      </div>

      {/* ⭐ SHOP HERO */}
      <div className="sp-card fade-in shop-hero">
        <div className="shop-hero-left">
          {/* Avatar tròn */}
          <div
            className={`hero-avatar ${editing ? "editable" : "locked"}`}
            role="button"
            tabIndex={0}
            aria-label={
              editing ? "Chọn ảnh gian hàng" : "Bấm 'Cập nhật' để đổi ảnh"
            }
            onClick={() => {
              if (!editing) {
                setToast({ type: "error", msg: "Bấm 'Cập nhật' để đổi ảnh." });
                return;
              }
              avatarFileRef.current?.click();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!editing) {
                  setToast({
                    type: "error",
                    msg: "Bấm 'Cập nhật' để đổi ảnh.",
                  });
                  return;
                }
                avatarFileRef.current?.click();
              }
            }}
          >
            {avatarPreview ? (
              <img
                className="hero-avatar-img hero-avatar-img--cover"
                src={avatarPreview}
                alt="shop avatar"
              />
            ) : (
              <div className="hero-avatar-ph">🏪</div>
            )}

            {/* Dấu cộng chỉ hiện khi đang chỉnh sửa */}
            {editing && (
              <span className="hero-plus" aria-hidden="true">
                +
              </span>
            )}

            <input
              ref={avatarFileRef}
              id="avatarFile"
              type="file"
              accept="image/*"
              onChange={onPickAvatar}
              style={{ display: "none" }}
            />
          </div>

          {/* Info bên phải ảnh */}
          <div className="hero-info">
            {/* Tên shop */}
            {editing ? (
              <input
                className="hero-name-input"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                maxLength={80}
                placeholder="Tên gian hàng"
                autoFocus
              />
            ) : (
              <div className="hero-name">{seller?.shop_name || "—"}</div>
            )}

            {/* Email */}
            {editing ? (
              <input
                className="hero-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email liên hệ"
              />
            ) : (
              <div className="hero-email">{seller?.email ?? email ?? "—"}</div>
            )}

            {/* Địa chỉ */}
            {editing ? (
              <input
                className="hero-email-input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Địa chỉ"
              />
            ) : (
              <div className="hero-address">
                {seller?.address ?? address ?? "—"}
              </div>
            )}
          </div>
        </div>

        <div className="shop-hero-right">
          {/* Meta cùng hàng với nút */}
          <div className="shop-meta">
            <span
              className={`badge-status ${
                seller?.status === "APPROVED" ? "approved" : "pending"
              }`}
            >
              {seller?.status === "APPROVED"
                ? "✓ Đã duyệt"
                : "⏳ Chưa được duyệt"}
            </span>
            <span className="meta-date">
              Đăng ký: {prettyDate(seller?.registration_date)}
            </span>
          </div>

          <button
            className={`sp-btn primary ${saving ? "is-loading" : ""}`}
            onClick={onPrimary}
            disabled={loading || saving}
          >
            {editing
              ? saving
                ? "Đang lưu…"
                : "💾 Lưu thay đổi"
              : "✏️ Cập nhật"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="sp-body">
        <aside className="sp-side">
          <button
            className={`sp-side-item ${
              tab === "login" ? "is-active" : ""
            } done`}
            onClick={() => go("login")}
          >
            <span className="state">✓</span>
            <div className="t1">Tài khoản đăng nhập</div>
          </button>
          <button
            className={`sp-side-item ${tab === "shop" ? "is-active" : ""} done`}
            onClick={() => go("shop")}
          >
            <span className="state">✓</span>
            <div className="t1">Thông tin gian hàng và quản lý</div>
          </button>
        </aside>

        <section className="sp-panel">
          {/* Tài khoản đăng nhập */}
          <div ref={secLoginRef} className="sp-section">
            <div className="sp-section-head">
              <h2>Tài khoản đăng nhập</h2>
            </div>
            <div className="sp-subdesc">
              Quản lý email, mật khẩu đăng nhập Shopping Seller Center
            </div>
            <div className="sp-table">
              <div className="row">
                <div className="label">Email</div>
                <div className="value">{seller?.email ?? email ?? "—"}</div>
              </div>
              <div className="row">
                <div className="label">Ngày đăng ký</div>
                <div className="value">
                  {prettyDate(seller?.registration_date)}
                </div>
              </div>
            </div>
          </div>

          {/* Thông tin gian hàng */}
          <div ref={secShopRef} className="sp-section">
            <div className="sp-section-head">
              <h2>Thông tin gian hàng và quản lý</h2>
            </div>
            <div className="sp-subdesc">
              Điều chỉnh thông tin công khai của gian hàng
            </div>
            <div className="sp-table">
              {/* ID nhà bán */}
              <div className="row">
                <div className="label">ID nhà bán</div>
                <div className="value">
                  <span className="id-badge">{sellerId || "—"}</span>
                </div>
              </div>
              {/* Tên gian hàng - CÓ THỂ CHỈNH SỬA */}
              <div className="row">
                <div className="label">Tên gian hàng</div>
                <div className="value">
                  <input
                    className="sp-input"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    maxLength={80}
                    placeholder="Tên gian hàng"
                    disabled={!editing}
                  />
                </div>
              </div>
              {/* Email liên hệ - KHÓA giống Tên gian hàng (mở khi editing) */}
              <div className="row">
                <div className="label">Email liên hệ</div>
                <div className="value">
                  <input
                    className="sp-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email liên hệ"
                    disabled={!editing}
                  />
                </div>
              </div>
              {/* Địa chỉ - KHÓA giống Tên gian hàng (mở khi editing) */}
              <div className="row">
                <div className="label">Địa chỉ</div>
                <div className="value">
                  <input
                    className="sp-input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Địa chỉ"
                    disabled={!editing}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="sp-loading">
          <div className="spinner" />
          <div>Đang tải hồ sơ…</div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`sp-toast ${toast.type}`}
          onAnimationEnd={() => setToast(null)}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
