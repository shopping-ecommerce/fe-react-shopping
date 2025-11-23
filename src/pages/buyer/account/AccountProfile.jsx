// src/pages/buyer/AccountProfile.jsx
"use client";

import { useState, useEffect, useContext } from "react";
import "../../../styles/account-profile.css";
import { AuthContext } from "../../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../../config/api";

const pickBestEmail = (user, data = {}, prev = "") => {
  const fromUser =
    user?.email ||
    user?.user_email ||
    user?.preferred_username ||
    "";
  const fromData =
    data?.account?.email ||
    data?.email ||
    data?.user_email ||
    data?.userEmail ||
    data?.contact_email ||
    "";
  return (fromUser || fromData || prev || "").trim();
};

// UUID v4 (thả lỏng)
const looksLikeUUID = (s) => typeof s === "string" && /^[0-9a-fA-F-]{32,}$/.test(s);

// Chọn accountId từ token/profile
const pickAccountId = (user, profile = {}) => {
  const cands = [
    user?.account_id,
    user?.accountId,
    user?.uid,
    user?.sub,
    user?.id,
    profile?.account_id,
    profile?.accountId,
  ].filter(Boolean);
  const found = cands.find(looksLikeUUID);
  return found || null;
};

// Chuẩn hoá URL avatar (nếu BE trả key)
const normalizeAvatarUrl = (val) => {
  if (!val) return "";
  if (/^https?:\/\//i.test(val)) return val;
  const CDN_BASE = "https://shopping-iuh-application.s3.ap-southeast-1.amazonaws.com/";
  return CDN_BASE + String(val).replace(/^\/+/, "");
};

// Parse DOB nhiều định dạng
function parseDobFromData(data = {}) {
  const raw =
    data.birthdate ||
    data.date_of_birth ||
    data.dateOfBirth ||
    data.dob ||
    data.birthday ||
    "";

  if (!raw) return null;

  const m = String(raw).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    return {
      year: String(m[1]),
      month: String(Number(m[2])),
      day: String(Number(m[3])),
    };
  }

  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return {
      year: String(d.getFullYear()),
      month: String(d.getMonth() + 1),
      day: String(d.getDate()),
    };
  }
  return null;
}

function buildDob({ year, month, day }) {
  if (!year || !month || !day) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// Chuẩn hoá/validate số điện thoại VN (nhẹ nhàng)
const normalizePhone = (raw) => {
  if (!raw) return "";
  let s = String(raw).trim();
  // bỏ mọi ký tự không phải số hoặc dấu +
  s = s.replace(/[^\d+]/g, "");
  // nếu dùng +84 thì chuẩn lại 0
  if (s.startsWith("+84")) {
    s = "0" + s.slice(3);
  }
  return s;
};

const isValidVNPhone = (raw) => {
  const s = normalizePhone(raw);
  // 10 số bắt đầu bằng 0
  return /^0\d{9}$/.test(s);
};

/* ----------------------- Component ----------------------- */

const AccountProfile = () => {
  const { user, authFetch, authReady } = useContext(AuthContext);

  // profileId: dùng cho updateProfile (tuỳ BE)
  const [profileId, setProfileId] = useState(null);

  // avatarUserId: id dành cho updateAvatar (== result.id từ getMyProfile)
  const [avatarUserId, setAvatarUserId] = useState(null);

  const [accountId, setAccountId] = useState(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false); // Thêm trạng thái cho SĐT

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    day: "",
    month: "",
    year: "",
    address: "",
  });

  // Avatar
  const [avatarImage, setAvatarImage] = useState(null); // preview tạm khi chọn file
  const [avatarUrl, setAvatarUrl] = useState("");       // URL thật từ BE (public_id)
  const [avatarBust, setAvatarBust] = useState("");     // cache-busting

  // Nếu email chưa có, lấy từ token trước
  useEffect(() => {
    if (!authReady || !user) return;
    setFormData((prev) => {
      if (prev.email?.trim()) return prev;
      const email = pickBestEmail(user, {}, prev.email);
      return email ? { ...prev, email } : prev;
    });
  }, [authReady, user]);

  // Load profile + email by accountId + avatar public_id
  useEffect(() => {
    if (!authReady || !user) return;

    let ignore = false;
    const ac = new AbortController();
    const { signal } = ac;

    const load = async () => {
      setMsg("");
      setEditing(false); // Reset trạng thái chỉnh sửa
      setEditingPhone(false); // Reset trạng thái chỉnh sửa SĐT

      try {
        // 1) Lấy profile
        const res = await authFetch(
          apiUrl(API_CONFIG.endpoints.getMyProfile),   // ✅ dùng apiUrl
          { method: "GET", headers: { Accept: "application/json" }, signal }
        );
        const text = await res.text();
        const json = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);

        const data = json.result ?? json;
        if (ignore) return;

        const dob = parseDobFromData(data);

        // 2) accountId (nếu cần gọi API lấy email theo account)
        const accId =
          pickAccountId(user, data) ||
          "8cfb8be3-b1ca-45ab-a673-ff372d85c4c7"; // fallback nếu cần
        setAccountId(accId);

        // 3) Email theo accountId
        let emailFromAccount = "";
        try {
          if (accId && API_CONFIG?.endpoints?.getUserByAccountId) {
            const uRes = await authFetch(
              apiUrl(API_CONFIG.endpoints.getUserByAccountId(accId)),
              { headers: { Accept: "application/json" }, signal }
            );
            const uText = await uRes.text();
            const uJson = uText ? JSON.parse(uText) : {};
            if (uRes.ok) {
              const ud = uJson.result ?? uJson;
              emailFromAccount =
                ud?.email ||
                ud?.user_email ||
                ud?.userEmail ||
                ud?.contact_email ||
                "";
            } else {
              console.warn("⚠️ getUserByAccountId lỗi:", uJson?.message || uRes.status);
            }
          }
        } catch (e) {
          console.warn("⚠️ Lỗi gọi getUserByAccountId:", e);
        }

        // 4) Chọn email tốt nhất
        const email = pickBestEmail(user, { email: emailFromAccount, ...data }, formData.email);

        // 5) Avatar từ public_id
        const fromApiAvatar = normalizeAvatarUrl(data.public_id);
        setAvatarUrl(fromApiAvatar);
        setAvatarBust(String(Date.now())); // tránh cache lần đầu

        // 6) Set UI + IDs
        setProfileId(data.id ?? null);     // profileId cho updateProfile (nếu BE cần)
        setAvatarUserId(data.id);          // ✅ userId cho updateAvatar lấy từ getMyProfile

        setFormData((prev) => ({
          ...prev,
          firstName: data.first_name || "",
          lastName: data.last_name || "",
          email,
          day: dob?.day || "",
          month: dob?.month || "",
          year: dob?.year || "",
          address:
            data.addresses?.find((addr) => addr.is_default)?.address ||
            data.addresses?.[0]?.address ||
            "",
          phone: data.phone || prev.phone || "",
        }));

        // cache last_name cho Header
        const ln = data.last_name || "";
        try {
          if (ln) localStorage.setItem("profile:last_name", ln);
        } catch {}
      } catch (e) {
        console.warn("⚠️ Không load được profile:", e);
        if (ignore) return;

        setFormData((prev) => {
          const email = pickBestEmail(user, {}, prev.email);
          return { ...prev, email };
        });
        setMsg("⚠️ Không tải được hồ sơ. Bạn vẫn có thể cập nhật họ tên/ngày sinh.");
      }
    };

    load();
    return () => {
      ignore = true;
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user, authFetch]);

  // Upload avatar — dùng userId cho field "id"
  const uploadAvatar = async (file) => {
    if (!editing) {
      setMsg("⚠️ Hãy bấm ‘Cập nhật’ trước khi đổi ảnh.");
      return;
    }
    if (!avatarUserId) {
      setMsg("⚠️ Chưa có userId (id cho updateAvatar). Hãy reload hồ sơ hoặc kiểm tra AuthContext.");
      return;
    }
    try {
      const form = new FormData();
      form.append("id", avatarUserId); // ✅ id = result.id từ getMyProfile
      form.append("files", file);      // ✅ field name 'files'

      const res = await authFetch(
        apiUrl(API_CONFIG.endpoints.updateAvatar),   // ✅ dùng apiUrl
        { method: "POST", body: form } // KHÔNG set Content-Type
      );

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);

      const payload = json.result ?? json;
      const url = normalizeAvatarUrl(
        payload.public_id || payload.avatar || payload.url
      );

      if (url) {
        setAvatarUrl(url);
        setAvatarBust(String(Date.now())); // bust cache
        setMsg("✅ Cập nhật ảnh đại diện thành công!");
      } else {
        setMsg("⚠️ Cập nhật xong nhưng không nhận được URL ảnh.");
      }
    } catch (e) {
      console.error("Upload avatar lỗi:", e);
      setMsg(`❌ Upload avatar thất bại: ${e.message}`);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (!editing && !editingPhone) return; // Chỉ cho phép thay đổi khi ở chế độ chỉnh sửa
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (e) => {
    if (!editing) {
      setMsg("⚠️ Hãy bấm ‘Cập nhật’ trước khi đổi ảnh.");
      e.target.value = "";
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview tạm
    const reader = new FileReader();
    reader.onload = (evt) => setAvatarImage(evt.target.result);
    reader.readAsDataURL(file);

    // Upload thật
    uploadAvatar(file);
  };

  const handleEditAvatar = () => {
    if (!editing) {
      setMsg("⚠️ Hãy bấm ‘Cập nhật’ trước khi đổi ảnh.");
      return;
    }
    if (!avatarUserId) {
      setMsg("⚠️ Đang tải hồ sơ, vui lòng thử lại sau…");
      return;
    }
    document.getElementById("avatar-input").click();
  };

  // Update profile (họ tên, ngày sinh, ảnh, địa chỉ)
  const postVariant = async (body) => {
    const res = await authFetch(
      apiUrl(API_CONFIG.endpoints.updateProfile),     // ✅ dùng apiUrl
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch (parseError) {
      console.error("❌ Lỗi parse JSON:", parseError);
    }

    if (!res.ok) {
      const msg = json.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return json.result ?? json;
  };

  const tryUpdateProfile = async () => {
    if (!profileId)
      throw new Error("Chưa xác định được ID hồ sơ. Vui lòng tải lại trang.");

    const birthdate = buildDob({
      year: formData.year,
      month: formData.month,
      day: formData.day,
    });

    const fn = (formData.firstName || "").trim();
    const ln = (formData.lastName || "").trim();
    const phoneNorm = normalizePhone(formData.phone);

    const variants = [
      { id: profileId, first_name: fn, last_name: ln, birthdate, phone: phoneNorm },
      {
        id: profileId,
        first_name: fn,
        last_name: ln,
        birthdate,
        phone: phoneNorm,
        addresses: [{ address: formData.address || "622 cong hoa", is_default: true }],
      },
      { first_name: fn, last_name: ln, birthdate, phone: phoneNorm },
      { id: profileId, firstName: fn, lastName: ln, birthdate, phone: phoneNorm },
      {
        id: profileId,
        first_name: fn,
        last_name: ln,
        birthdate,
        phone: phoneNorm,
        addresses: [{ address: formData.address || "622 cong hoa", is_default: true }],
        status: "AVAILABLE",
      },
    ];

    let lastErr = null;
    for (let i = 0; i < variants.length; i++) {
      try {
        const result = await postVariant(variants[i]);
        return result;
      } catch (e) {
        lastErr = e;
        if (!/invalid|bad|request body|unknown|unsupported|validation/i.test(e.message)) {
          throw e;
        }
      }
    }
    throw lastErr || new Error("Tất cả các format đều thất bại");
  };

  // Update phone number
  const tryUpdatePhone = async () => {
    if (!profileId) {
      throw new Error("Chưa xác định được ID hồ sơ. Vui lòng tải lại trang.");
    }

    const phoneNorm = normalizePhone(formData.phone);
    if (!phoneNorm || !isValidVNPhone(phoneNorm)) {
      throw new Error("Số điện thoại không hợp lệ. Vui lòng nhập 10 số, bắt đầu bằng 0.");
    }

    const variants = [
      { id: profileId, phone: phoneNorm },
      { phone: phoneNorm },
      { id: profileId, phone_number: phoneNorm }, // thêm variant nếu BE dùng phone_number
    ];

    let lastErr = null;
    for (let i = 0; i < variants.length; i++) {
      try {
        const res = await authFetch(
          apiUrl(API_CONFIG.endpoints.updateProfile), // ✅ dùng apiUrl
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(variants[i]),
          }
        );

        const text = await res.text();
        let json = {};
        try {
          json = text ? JSON.parse(text) : {};
        } catch (parseError) {
          console.error("❌ Lỗi parse JSON:", parseError);
        }

        if (!res.ok) {
          const msg = json.message || `HTTP ${res.status}`;
          throw new Error(msg);
        }
        return json.result ?? json;
      } catch (e) {
        lastErr = e;
        if (!/invalid|bad|request body|unknown|unsupported|validation/i.test(e.message)) {
          throw e;
        }
      }
    }
    throw lastErr || new Error("Tất cả các format đều thất bại");
  };

  const handlePrimaryButton = async () => {
    if (!editing) {
      setEditing(true);
      return;
    }

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setMsg("❌ Vui lòng nhập đầy đủ họ và tên");
      return;
    }

    if (formData.phone && !isValidVNPhone(formData.phone)) {
      setMsg("❌ Số điện thoại không hợp lệ. Vui lòng nhập 10 số, bắt đầu bằng 0.");
      return;
    }

    setMsg("");
    setSaving(true);
    try {
      await tryUpdateProfile();

      const ln = (formData.lastName || "").trim();
      try {
        localStorage.setItem("profile:last_name", ln);
      } catch {}

      window.dispatchEvent(new CustomEvent("profile:nameChanged", { detail: { lastName: ln } }));

      setMsg("✅ Cập nhật hồ sơ thành công!");
      setEditing(false);
    } catch (e) {
      setMsg(`❌ Cập nhật thất bại: ${e.message}`);
      console.error("❌ Update profile lỗi:", e);
    } finally {
      setSaving(false);
    }
  };

  const handlePhoneUpdate = async () => {
    if (!editingPhone) {
      setEditingPhone(true);
      return;
    }

    setMsg("");
    setSaving(true);
    try {
      await tryUpdatePhone();
      setMsg("✅ Cập nhật số điện thoại thành công!");
      setEditingPhone(false);
    } catch (e) {
      setMsg(`❌ Cập nhật số điện thoại thất bại: ${e.message}`);
      console.error("❌ Update phone lỗi:", e);
    } finally {
      setSaving(false);
    }
  };

  const isDisabled = !editing;

  /* ----------------------- Render ----------------------- */

  return (
    <div className="account-profile">
      <h1 className="profile-title">Thông tin tài khoản</h1>

      {msg && (
        <div
          style={{
            margin: "8px 0 16px",
            padding: "10px 12px",
            borderRadius: 8,
            background: msg.startsWith("✅") ? "#e6ffed" : "#ffecec",
            color: msg.startsWith("✅") ? "#0a7b34" : "#b00020",
            fontWeight: 500,
          }}
        >
          {msg}
        </div>
      )}

      <div className="profile-content">
        <div className="profile-section">
          <h2 className="section-title">Thông tin cá nhân</h2>

          <div className="profile-avatar-section">
            <div className={`avatar-container ${isDisabled ? "locked" : ""}`}>
              <div className="avatar-placeholder">
                {(avatarUrl || avatarImage) ? (
                  <img
                    src={(avatarUrl ? `${avatarUrl}?t=${avatarBust}` : avatarImage) || "/placeholder.svg"}
                    alt="Avatar"
                    className="avatar-image"
                  />
                ) : (
                  <svg className="avatar-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                )}
              </div>
              <button
                className={`edit-avatar-btn ${isDisabled ? "disabled" : ""}`}
                onClick={handleEditAvatar}
                disabled={isDisabled}
                title={isDisabled ? "Bấm ‘Cập nhật’ để chỉnh sửa ảnh" : "Đổi ảnh đại diện"}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
              </button>
              <input
                id="avatar-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: "none" }}
              />
            </div>

            <div className="profile-fields">
              <div className="field-group">
                <label>Họ đệm</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="profile-input"
                  placeholder="Nhập họ đệm"
                  disabled={isDisabled}
                />
              </div>

              <div className="field-group">
                <label>Tên</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Nhập tên"
                  className="profile-input"
                  disabled={isDisabled}
                />
              </div>
            </div>
          </div>

          {/* Ngày sinh */}
          <div className="field-group">
            <label>Ngày sinh</label>
            <div className="date-selectors">
              <select name="day" value={formData.day} onChange={handleInputChange} disabled={isDisabled}>
                <option value="">Ngày</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <select name="month" value={formData.month} onChange={handleInputChange} disabled={isDisabled}>
                <option value="">Tháng</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Tháng {i + 1}
                  </option>
                ))}
              </select>
              <select name="year" value={formData.year} onChange={handleInputChange} disabled={isDisabled}>
                <option value="">Năm</option>
                {Array.from({ length: 100 }, (_, i) => {
                  const y = new Date().getFullYear() - i;
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <button className="save-btn" onClick={handlePrimaryButton} disabled={saving}>
            {editing ? (saving ? "Đang lưu…" : "Lưu thay đổi") : "Cập nhật"}
          </button>
        </div>

        {/* Liên hệ */}
        <div className="profile-section contact-section">
          <h2 className="section-title">Số điện thoại và Email</h2>

          {/* Số điện thoại */}
          <div className="contact-item">
            <div className="contact-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
            </div>

            <div className="contact-info">
              <div className="contact-label">Số điện thoại</div>
              <input
                type="tel"
                name="phone"
                className="profile-input"
                placeholder="Nhập số điện thoại"
                value={formData.phone}
                onChange={handleInputChange}
                disabled={!editingPhone}
                onInput={(e) => {
                  if (!editingPhone) return;
                  e.target.value = e.target.value.replace(/[^\d+\s]/g, "");
                }}
              />
            </div>

            <button
              className="update-btn"
              onClick={handlePhoneUpdate}
              disabled={saving}
              title={editingPhone ? "Lưu số điện thoại" : "Chỉnh sửa số điện thoại"}
            >
              {editingPhone ? (saving ? "Đang lưu…" : "Lưu thay đổi") : "Cập nhật"}
            </button>
          </div>

          {/* Email (chỉ hiển thị) */}
          <div className="contact-item">
            <div className="contact-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
            </div>
            <div className="contact-info">
              <div className="contact-label">Địa chỉ email</div>
              <div className="contact-value">{formData.email?.trim() || "—"}</div>
            </div>
          </div>
        </div>

        {/* Bảo mật */}
        <div className="profile-section">
          <h2 className="section-title">Bảo mật</h2>

          {/* Đổi mật khẩu */}
          <div className="security-item">
            <div className="security-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
            </div>
            <div className="security-info">
              <div className="security-label">Đổi mật khẩu</div>
            </div>
            <button
              className="update-btn"
              onClick={() => alert("Tuỳ bạn triển khai")}
            >
              Cập nhật
            </button>
          </div>

          {/* Yêu cầu xóa tài khoản */}
          <div className="security-item danger">
            <div className="security-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            </div>
            <div className="security-info">
              <div className="security-label">Yêu cầu xóa tài khoản</div>
            </div>
            <button
              className="update-btn danger"
              onClick={() => alert("Tuỳ bạn triển khai")}
            >
              Cập nhật
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountProfile;
