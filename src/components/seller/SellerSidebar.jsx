import React, { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  faHouse,
  faBuilding,
  faBoxArchive,
  faWarehouse,
  faChartLine,
  faBullhorn,
  faPalette,
  faStore,
  faChevronDown,
  faChevronRight,
  faHeadphones,
  faChevronLeft,
  faMagnifyingGlass,
  faReceipt,
  faListCheck,
  faFileInvoiceDollar,
  faFileLines,
  faClockRotateLeft,
  faUpload,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "../../styles/sellersidebar.css";

export default function SellerSidebar({ isOpen = true, onToggle }) {
  const { pathname } = useLocation();
  const [query, setQuery] = useState("");

  // MENU GIỮ NGUYÊN THEO CODE CỦA BẠN
  const menu = useMemo(
    () => [
      { type: "item", label: "Trang chủ", icon: faHouse, to: "/seller/home" },
      {
        type: "group",
        label: "Đơn hàng",
        icon: faBuilding,
        key: "orders",
        children: [
          {
            label: "Danh sách đơn hàng",
            to: "/seller/orders",
            icon: faListCheck,
          },
          {
            label: "Quản lý hóa đơn",
            to: "/seller/invoices",
            icon: faFileInvoiceDollar,
          },
        ],
      },
      {
        type: "group",
        label: "Sản phẩm",
        icon: faBoxArchive,
        key: "products",
        children: [
          {
            label: "Danh sách sản phẩm",
            to: "/seller/products",
            icon: faListCheck,
          },
          { label: "Tạo sản phẩm", to: "/seller/create-products", icon: faUpload },
          {
            label: "Quản lý đánh giá",
            to: "/seller/reviews",
            icon: faFileLines,
          },
          {
            label: "Xuất sản phẩm",
            to: "/seller/products/export",
            icon: faReceipt,
          },
          {
            label: "Lịch sử thay đổi",
            to: "/seller/products/history",
            icon: faClockRotateLeft,
          },
          {
            label: "Tạo mới/ cập nhật hàng loạt",
            to: "/seller/products/bulk",
            icon: faUpload,
          },
        ],
      },
      {
        type: "group",
        label: "Kho & hàng tồn",
        icon: faWarehouse,
        key: "inventory",
        children: [
          { label: "Tồn kho", to: "/seller/inventory" },
          { label: "Phiếu nhập/xuất", to: "/seller/stock-moves" },
        ],
      },
      {
        type: "group",
        label: "Trung tâm phát triển",
        icon: faChartLine,
        key: "growth",
        children: [
          {
            label: "Hiệu quả kinh doanh",
            to: "/seller/performance",
            icon: faChartLine,
          },
          {
            label: "Chỉ số lượt truy cập",
            to: "/seller/traffic",
            icon: faChartLine,
          },
        ],
      },
      {
        type: "group",
        label: "Trung tâm marketing",
        icon: faBullhorn,
        key: "marketing",
        children: [
          { label: "Chiến dịch", to: "/seller/campaigns" },
          { label: "Mã giảm giá", to: "/seller/vouchers" },
        ],
      },
      {
        type: "group",
        label: "Thiết kế gian hàng",
        icon: faPalette,
        key: "design",
        children: [
          {
            label: "Trang trí gian hàng",
            to: "/seller/storefront",
            icon: faPalette,
          },
        ],
      },
      {
        type: "item",
        label: "Quản lý tài chính",
        icon: faStore,
        to: "/seller/finance",
      },
    ],
    []
  );

  const [openKeys, setOpenKeys] = useState(
    () => new Set(["orders", "products"])
  );

  const toggleGroup = (key) => {
    if (!isOpen) return; // đang thu gọn thì không xổ
    setOpenKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const showItem = (label = "") =>
    label.toLowerCase().includes(query.trim().toLowerCase());

  return (
    <aside className={`seller-sidebar ${isOpen ? "open" : "collapsed"}`}>
      {/* Top: Search (fixed) */}
      <div className="ssb-search">
        <FontAwesomeIcon icon={faMagnifyingGlass} />
        <input
          placeholder="Tìm kiếm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={!isOpen}
        />
      </div>

      {/* Middle: Scrollable menu */}
      <nav className="ssb-nav">
        {menu.map((m) => {
          // ===== ITEM (Trang chủ, Quản lý tài chính) =====
          if (m.type === "item") {
            return showItem(m.label) ? (
              <NavLink
                key={m.label}
                to={m.to}
                end={m.to === "/seller/home"} // << chỉ active khi đúng /seller
                className={({ isActive }) =>
                  `ssb-item headlike ${isActive ? "active" : ""}`
                }
                title={!isOpen ? m.label : undefined}
              >
                <div className="left">
                  <FontAwesomeIcon className="ssb-icon" icon={m.icon} />
                  {isOpen && <span className="label">{m.label}</span>}
                </div>
                {isOpen && <span className="chev-spacer" />}
              </NavLink>
            ) : null;
          }

          // ===== GROUP =====
          const filteredChildren =
            m.children?.filter((c) => showItem(m.label) || showItem(c.label)) ??
            [];
          if (filteredChildren.length === 0) return null;

          const open = openKeys.has(m.key);
          const groupActive = filteredChildren.some((c) =>
            pathname.startsWith(c.to)
          );

          return (
            <div
              key={m.key}
              className={`ssb-group ${groupActive ? "active" : ""}`}
            >
              <button
                className="ssb-group-head"
                onClick={() => toggleGroup(m.key)}
                title={!isOpen ? m.label : undefined}
              >
                <div className="left">
                  <FontAwesomeIcon className="ssb-icon" icon={m.icon} />
                  {isOpen && <span className="label">{m.label}</span>}
                </div>
                {isOpen && (
                  <FontAwesomeIcon
                    icon={open ? faChevronDown : faChevronRight}
                  />
                )}
              </button>

              {isOpen && open && (
                <div className="ssb-group-body">
                  {filteredChildren.map((c) => (
                    <NavLink
                      key={c.to}
                      to={c.to}
                      className={({ isActive }) =>
                        `ssb-subitem ${isActive ? "active" : ""}`
                      }
                    >
                      <span className="dot" />
                      <span>{c.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom fixed: Support + Collapse */}
      <div className="ssb-bottom">
        <div className="ssb-support">
          <button
            className={`ssb-support-btn ${!isOpen ? "circle" : ""}`}
            title={!isOpen ? "Support" : undefined}
          >
            <FontAwesomeIcon className="ssb-icon" icon={faHeadphones} />
            {isOpen && <span>Support</span>}
          </button>
        </div>

        <div className="ssb-collapse">
          <button onClick={onToggle} title={isOpen ? "Thu gọn" : "Mở rộng"}>
            <FontAwesomeIcon className="ssb-icon" icon={faChevronLeft} />
            {isOpen && <span>Thu gọn</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
