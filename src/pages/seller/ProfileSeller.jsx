// ProfileSeller.jsx
import React, { useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import "../../styles/SellerProfile.css";

export default function ProfileSeller() {
  function ToggleSwitch() {
  const [on, setOn] = React.useState(false);

  const toggle = () => setOn(v => !v);

  return (
    <button
      type="button"
      className={`tk-switch ${on ? "is-on" : ""}`}
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Tắt gian hàng" : "Bật gian hàng"}
    >
      <span className="tk-track" />
      <span className="tk-thumb" />
      <span className="tk-text">{on ? "Bật" : "Tắt"}</span>
      <span className="tk-info">i</span>
    </button>
  );
}
  const [tab, setTab] = useState("login"); // login | shop | warehouse | legal

  // refs cho từng section bên phải
  const secLoginRef = useRef(null);
  const secShopRef = useRef(null);
  const secWarehouseRef = useRef(null);
  const secLegalRef = useRef(null);

  const sectionRefs = {
    login: secLoginRef,
    shop: secShopRef,
    warehouse: secWarehouseRef,
    legal: secLegalRef,
  };

  const go = (key) => {
    setTab(key);
    // scroll mượt tới section, sidebar vẫn sticky
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
          <span className="sp-crumb-sep">/</span>
          <span className="sp-crumb-current">Hồ sơ nhà bán</span>
        </div>

        <div className="sp-head-row">
          <h1 className="sp-title">Hồ sơ nhà bán</h1>
          <button className="sp-btn ghost">⏱ Lịch sử bật tắt gian hàng</button>
        </div>
      </div>

      {/* Alert vàng */}
      <div className="sp-alert">
        <div className="left">
          <span className="ic-box">🏬</span>
          <span>Vui lòng cung cấp địa chỉ kho lấy và trả hàng</span>
        </div>
        <button className="sp-btn primary">Cung cấp địa chỉ kho</button>
      </div>

      {/* Card shop */}
      <div className="sp-card">
        <div className="shop-left">
          <div className="avatar">🏪</div>
          <div>
            <div className="shop-name">TAHIShop</div>
            <div className="shop-meta">
              <span className="badge warn">Chưa được duyệt</span>
              <span className="muted">
                ID nhà bán: <strong>S00362859</strong> 📋
              </span>
            </div>
          </div>
        </div>

       <div className="shop-right">
  <ToggleSwitch />
  <button className="sp-btn outline">
    Thiết lập gian hàng <span className="arrow">›</span>
  </button>
</div>

      </div>

      {/* body */}
      <div className="sp-body">
        {/* SIDEBAR (sticky) */}
        {/* SIDEBAR (sticky) */}
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

          <button
            className={`sp-side-item ${
              tab === "warehouse" ? "is-active" : ""
            } pending`}
            onClick={() => go("warehouse")}
          >
            <span className="state">?</span>
            <div className="t1">
              Thông tin kho hàng, mô hình vận hành và liên lạc
            </div>
          </button>

          <button
            className={`sp-side-item ${
              tab === "legal" ? "is-active" : ""
            } pending`}
            onClick={() => go("legal")}
          >
            <span className="state">?</span>
            <div className="t1">Giấy tờ pháp lý</div>
          </button>
        </aside>

        {/* PANEL: render tất cả section, dùng ref để scroll */}
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
                <div className="label">Tài khoản</div>
                <div className="value">nguyenquocthai001005@gmail.com</div>
              </div>
              <div className="row">
                <div className="label">ID tài khoản</div>
                <div className="value">362859</div>
              </div>
            </div>
          </div>

          {/* Thông tin gian hàng và quản lý */}
          <div ref={secShopRef} className="sp-section">
            <div className="sp-section-head">
              <h2>Thông tin gian hàng và quản lý</h2>
              <button className="sp-link">Chi tiết ›</button>
            </div>
            <div className="sp-subdesc">
              Điều chỉnh loại hình kinh doanh, thông tin của gian hàng và quản
              lý
            </div>
            <div className="sp-table">
              <div className="row">
                <div className="label">Tên gian hàng</div>
                <div className="value">TAHIShop</div>
              </div>
              <div className="row">
                <div className="label">Quản lý gian hàng</div>
                <div className="value">Nguyễn Quốc Thái / +84358097747</div>
              </div>
              <div className="row">
                <div className="label">Mã gian hàng</div>
                <div className="value">S00362859</div>
              </div>
              <div className="row">
                <div className="label">Loại hình kinh doanh</div>
                <div className="value">Tài khoản Cá nhân</div>
              </div>
            </div>
          </div>

          {/* Thông tin kho hàng… */}
          <div ref={secWarehouseRef} className="sp-section">
            <div className="sp-section-head">
              <h2>Thông tin kho hàng, mô hình vận hành và liên lạc</h2>
              <button className="sp-link">Chi tiết ›</button>
            </div>
            <div className="sp-subdesc">
              Điều chỉnh mô hình vận hành, tài khoản ngân hàng và các thông tin
              khác
            </div>
            <div className="sp-table">
              <div className="row">
                <div className="label">Mô hình vận hành & Kho hàng</div>
                <div className="value value-group">
                  <span className="text-strong">
                    Lưu kho Shopping, Giao thẳng từ Nhà Bán
                  </span>
                  <span className="sp-pill warn">
                    ⚠ Cần địa chỉ kho lấy & trả hàng
                  </span>
                </div>
              </div>
              <div className="row">
                <div className="label">Tài khoản ngân hàng</div>
                <div className="value value-group">
                  <span className="text-mute">—</span>
                  <span className="sp-pill warn">
                    ⚠ Cần tài khoản ngân hàng
                  </span>
                </div>
              </div>
              <div className="row">
                <div className="label">Thông tin liên lạc</div>
                <div className="value">
                  <span className="text-mute">—</span>
                </div>
              </div>
            </div>
          </div>

          {/* Giấy tờ pháp lý */}
          <div ref={secLegalRef} className="sp-section">
            <div className="sp-section-head">
              <h2>Giấy tờ pháp lý</h2>
              <button className="sp-link">Chi tiết ›</button>
            </div>
            <div className="sp-subdesc">
              Lưu trữ các giấy tờ pháp lý và hợp đồng của Nhà bán
            </div>
            <div className="sp-table">
              <div className="row">
                <div className="label">Giấy tờ tùy thân</div>
                <div className="value">
                  <span className="sp-pill warn">⚠ Cần giấy tờ tùy thân</span>
                </div>
              </div>
              <div className="row">
                <div className="label">Số hợp đồng</div>
                <div className="value">364452/MP/SHOP/T7-2025</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
