import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faCommentDots,
  faBell,
  faEllipsis,
  faChevronDown,
  faBorderAll,
  faUser,
  faKey,
  faIdCard,
  faPlus,
  faRightFromBracket,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import "../../styles/SellerHeader.css";

export default function SellerHeader({
  onToggleSidebar,
  storeName = localStorage.getItem("seller_store_name") || "nguyenquoct...",
  userAvatar = "/store-avatar.png",
  notifications = 1,
  userFullName = "Nguyễn Quốc Thái",
  userEmail = "nguyenquocthai001005@gmail.com",
  onAcademyClick = () => {},
}) {
  const [openStoreMenu, setOpenStoreMenu] = useState(false);
  const [openNotif, setOpenNotif] = useState(false);

  const storeBtnRef = useRef(null);
  const storeMenuRef = useRef(null);

  // Đóng dropdown store khi click ra ngoài / ESC
  useEffect(() => {
    const onClickOutside = (e) => {
      if (
        openStoreMenu &&
        storeMenuRef.current &&
        !storeMenuRef.current.contains(e.target) &&
        storeBtnRef.current &&
        !storeBtnRef.current.contains(e.target)
      ) {
        setOpenStoreMenu(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === "Escape") {
        setOpenStoreMenu(false);
        setOpenNotif(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [openStoreMenu]);

  // Nội dung thông báo demo
  const notifItems = [
    {
      id: 1,
      title: "Điều khoản đã được chấp nhận",
      desc:
        "Xin chào TAHiShop, Điều khoản & Điều kiện của bạn đã được chấp nhận thành công. Cảm ơn bạn đã hợp tác cùng chúng tôi.",
      time: "12/08/2025 23:00:04",
      unread: true,
      icon: "/shopping-logo-48.png", // để một icon 48x48 trong public
    },
  ];

  return (
    <>
      <header className="tk-header tk-lg">
        {/* Left: logo + title + sidebar toggle */}
        <div className="tk-left">
          <div className="tk-brand">
            {/* Logo: Shopping */}
            <div className="tk-logo shopping tk-lgtext">
              <span className="shop-blue">S</span>
              <span className="shop-blue">h</span>
              <span className="shop-blue">o</span>
              <span className="shop-blue">p</span>
              <span className="shop-blue">p</span>
              <span className="shop-blue">i</span>
              <span className="shop-yellow">n</span>
              <span className="shop-blue">g</span>
            </div>
            <span className="tk-divider" />
            <span className="tk-seller-center tk-lgtext">SELLER CENTER</span>
          </div>
        </div>

        {/* Right: icons + actions */}
        <div className="tk-right">
          <button className="tk-icon-btn tk-lg" title="Tin nhắn">
            <FontAwesomeIcon icon={faCommentDots} />
          </button>

          {/* Bell with badge */}
          <div className="tk-icon-wrap" title="Thông báo">
            <button
              className="tk-icon-btn tk-lg"
              onClick={() => setOpenNotif(true)}
              aria-haspopup="dialog"
              aria-expanded={openNotif}
            >
              <FontAwesomeIcon icon={faBell} />
            </button>
            {notifications > 0 && <span className="tk-badge tk-lg">{notifications}</span>}
          </div>

          <button className="tk-icon-btn tk-lg" title="Khác">
            <FontAwesomeIcon icon={faEllipsis} />
          </button>

          <button className="tk-pill tk-lg" onClick={onAcademyClick}>
            <span className="tk-pill-icon">📄</span>
            Học viện Shopping
          </button>

          {/* Store switcher + DROPDOWN */}
          <button
            ref={storeBtnRef}
            className={`tk-store-switch tk-lg ${openStoreMenu ? "active" : ""}`}
            onClick={() => setOpenStoreMenu((s) => !s)}
          >
            <img className="tk-avatar" src={userAvatar} alt="store avatar" />
            <span className="tk-store-name">{storeName}</span>
            <FontAwesomeIcon icon={faChevronDown} className="tk-caret" />
          </button>

          {openStoreMenu && (
            <div ref={storeMenuRef} className="tk-dropdown tk-store-menu">
              <div className="tk-menu-head">
                <img className="tk-avatar lg" src={userAvatar} alt="avatar" />
                <div className="tk-user-info">
                  <div className="tk-fullname">{userFullName}</div>
                  <div className="tk-email">{userEmail}</div>
                </div>
              </div>

              <button className="tk-menu-item">
                <FontAwesomeIcon icon={faUser} />
                <span>Hồ sơ nhà bán</span>
              </button>
              <button className="tk-menu-item">
                <FontAwesomeIcon icon={faKey} />
                <span>Thay đổi mật khẩu</span>
              </button>
              <button className="tk-menu-item">
                <FontAwesomeIcon icon={faIdCard} />
                <span>Cập nhật CCCD</span>
              </button>

              <div className="tk-sep" />

              <button className="tk-menu-item">
                <FontAwesomeIcon icon={faPlus} />
                <span>Thêm tài khoản khác</span>
              </button>
              <button className="tk-menu-item danger">
                <FontAwesomeIcon icon={faRightFromBracket} />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}

          {/* Language */}
          <button className="tk-lang tk-lg">
            <img src="/vn-flag.png" alt="vi" />
            <FontAwesomeIcon icon={faChevronDown} className="tk-caret" />
          </button>

          <button className="tk-icon-btn tk-lg" title="Ứng dụng">
            <FontAwesomeIcon icon={faBorderAll} />
          </button>
        </div>
      </header>

      {/* Overlay + Notification Drawer */}
      {openNotif && <div className="tk-overlay" onClick={() => setOpenNotif(false)} />}

      <aside className={`tk-drawer ${openNotif ? "open" : ""}`} role="dialog" aria-label="Cập nhật nhà bán">
        <div className="tk-drawer-head">
          <div className="tk-drawer-title">Cập nhật nhà bán</div>
          <button className="tk-icon-btn" onClick={() => setOpenNotif(false)} aria-label="Đóng">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="tk-drawer-actions">
          <button className="link">Xem tất cả</button>
          <button className="link">Đã đọc tất cả</button>
        </div>

        <div className="tk-drawer-list">
          {notifItems.map((n) => (
            <div key={n.id} className="tk-notif-item">
              <img className="tk-notif-icon" src={n.icon} alt="" />
              <div className="tk-notif-body">
                <div className="tk-notif-title">
                  {n.title}
                  {n.unread && <span className="dot" />}
                </div>
                <div className="tk-notif-desc">{n.desc}</div>
                <div className="tk-notif-time">{n.time}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
