import { NavLink, useNavigate } from "react-router-dom";
import { useState, useContext, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faBell,
  faClipboardList,
  faHeart, 
  faLocationDot,
  faRightFromBracket,
  faWallet,
  faFlag, // Báo cáo của tôi
  faFileLines, // 👈 NEW: Chính sách của bạn
} from "@fortawesome/free-solid-svg-icons";
import { AuthContext } from "../../../contexts/AuthContext";
import { apiUrl } from "../../../config/api";
import "../../../styles/AccountSidebar.css";

export default function AccountSidebar() {
  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);
  const [busy, setBusy] = useState(false);

  // 👇 NEW: đếm số chính sách mới nhất (để hiển thị badge)
  const [policyCount, setPolicyCount] = useState(0);


  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
      console.log("✅ Logout successful, navigating to login...");
    } catch (e) {
      console.warn("Logout error:", e?.message || e);
    } finally {
      setBusy(false);
      navigate("/login");
    }
  };

  return (
    <aside className="account-sidebar">
      <div className="account-sidebar__title">Tài khoản của tôi</div>
      <nav className="account-sidebar__nav">
        <NavLink
          to="/account/profile"
          className={({ isActive }) =>
            "account-sidebar__link" + (isActive ? " is-active" : "")
          }
        >
          <FontAwesomeIcon icon={faUser} /> Thông tin tài khoản
        </NavLink>

        <NavLink
          to="/account/notifications"
          className={({ isActive }) =>
            "account-sidebar__link" + (isActive ? " is-active" : "")
          }
        >
          <FontAwesomeIcon icon={faBell} /> Thông báo của tôi
        </NavLink>

        {/* Báo cáo của tôi */}
        <NavLink
          to="/account/reports"
          className={({ isActive }) =>
            "account-sidebar__link" + (isActive ? " is-active" : "")
          }
        >
          <FontAwesomeIcon icon={faFlag} /> Báo cáo của tôi
        </NavLink>

        <NavLink
          to="/account/orders"
          className={({ isActive }) =>
            "account-sidebar__link" + (isActive ? " is-active" : "")
          }
        >
          <FontAwesomeIcon icon={faClipboardList} /> Quản lý đơn hàng
        </NavLink>

        {/* Lịch sử giao dịch */}
        <NavLink
          to="/account/wallet"
          className={({ isActive }) =>
            "account-sidebar__link" + (isActive ? " is-active" : "")
          }
        >
          <FontAwesomeIcon icon={faWallet} /> Lịch sử giao dịch
        </NavLink>

        <NavLink
          to="/account/favorites"
          className={({ isActive }) =>
            "account-sidebar__link" + (isActive ? " is-active" : "")
          }
        >
          <FontAwesomeIcon icon={faHeart} /> Sản phẩm yêu thích
        </NavLink>

        <NavLink
          to="/account/addresses"
          className={({ isActive }) =>
            "account-sidebar__link" + (isActive ? " is-active" : "")
          }
        >
          <FontAwesomeIcon icon={faLocationDot} /> Địa chỉ
        </NavLink>

        {/* 👇 NEW: Chính sách của bạn */}
        <NavLink
          to="/account/policies"
          className={({ isActive }) =>
            "account-sidebar__link" + (isActive ? " is-active" : "")
          }
        >
          <FontAwesomeIcon icon={faFileLines} /> Chính sách của bạn
          {policyCount > 0 && (
            <span
              style={{
                marginLeft: "auto",
                background: "#ef4444",
                color: "#fff",
                borderRadius: "12px",
                padding: "2px 8px",
                fontSize: 12,
                lineHeight: 1.4,
              }}
            >
              {policyCount}
            </span>
          )}
        </NavLink>
      </nav>

      <div className="account-sidebar__divider" />

      <button
        type="button"
        className="account-sidebar__logout"
        onClick={handleLogout}
        disabled={busy}
        title="Đăng xuất"
      >
        <FontAwesomeIcon icon={faRightFromBracket} />
        <span style={{ marginLeft: 8 }}>
          {busy ? "Đang đăng xuất..." : "Đăng xuất"}
        </span>
      </button>
    </aside>
  );
}
