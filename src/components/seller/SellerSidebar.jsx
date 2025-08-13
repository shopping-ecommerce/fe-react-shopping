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
  faUpload
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "../../styles/sellersidebar.css"; 

export default function SellerSidebar({ isOpen = true, onToggle }) {
  const { pathname } = useLocation();
  const [query, setQuery] = useState("");

  // Cấu hình menu
  const menu = useMemo(
    () => [
      {
        type: "item",
        label: "Trang chủ",
        icon: faHouse,
        to: "/seller",
      },
      {
        type: "group",
        label: "Đơn hàng",
        icon: faBuilding,
        key: "orders",
        children: [
          { label: "Danh sách đơn hàng", to: "/seller/orders", icon: faListCheck },
          { label: "Quản lý hóa đơn", to: "/seller/invoices", icon: faFileInvoiceDollar },
        ],
      },
      {
        type: "group",
        label: "Sản phẩm",
        icon: faBoxArchive,
        key: "products",
        children: [
          { label: "Danh sách sản phẩm", to: "/seller/products", icon: faListCheck },
          { label: "Tạo sản phẩm", to: "/seller/products/new", icon: faUpload },
          { label: "Quản lý đánh giá", to: "/seller/reviews", icon: faFileLines },
          { label: "Xuất sản phẩm", to: "/seller/products/export", icon: faReceipt },
          { label: "Lịch sử thay đổi", to: "/seller/products/history", icon: faClockRotateLeft },
          { label: "Tạo mới/ cập nhật hàng loạt", to: "/seller/products/bulk", icon: faUpload },
        ],
      },
      {
        type: "group",
        label: "Trung tâm phát triển",
        icon: faChartLine,
        key: "growth",
        children: [
          { label: "Hiệu quả kinh doanh", to: "/seller/performance", icon: faChartLine },
          { label: "Chỉ số lượt truy cập", to: "/seller/traffic", icon: faChartLine },
        ],
      },
      {
        type: "group",
        label: "Thiết kế gian hàng",
        icon: faPalette,
        key: "design",
        children: [
          { label: "Trang trí gian hàng", to: "/seller/storefront", icon: faPalette },
        ],
      },
      {
        type: "item",
        label: "Thông tin nhà bán",
        icon: faStore,
        to: "/seller/profile",
      },
    ],
    []
  );

  // Nhóm nào đang mở
  const [openKeys, setOpenKeys] = useState(() => new Set(["orders", "products"]));

  const toggleGroup = (key) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Lọc theo ô tìm kiếm
  const showItem = (label = "") =>
    label.toLowerCase().includes(query.trim().toLowerCase());

  return (
    <aside className={`seller-sidebar ${isOpen ? "open" : "collapsed"}`}>
      {/* Search */}
      <div className="ssb-search">
        <FontAwesomeIcon icon={faMagnifyingGlass} />
        <input
          placeholder="Tìm kiếm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Menu */}
      <nav className="ssb-nav">
        {menu.map((m) => {
          if (m.type === "item") {
            if (!showItem(m.label)) return null;
            return (
              <NavLink
                key={m.label}
                to={m.to}
                className={({ isActive }) =>
                  `ssb-item ${isActive ? "active" : ""}`
                }
              >
                <FontAwesomeIcon icon={m.icon} />
                <span>{m.label}</span>
              </NavLink>
            );
          }

          // group
          const filteredChildren =
            m.children?.filter((c) => showItem(m.label) || showItem(c.label)) ??
            [];
          if (filteredChildren.length === 0) return null;

          const open = openKeys.has(m.key);
          const groupActive = filteredChildren.some((c) => pathname.startsWith(c.to));

          return (
            <div key={m.key} className={`ssb-group ${groupActive ? "active" : ""}`}>
              <button className="ssb-group-head" onClick={() => toggleGroup(m.key)}>
                <div className="left">
                  <FontAwesomeIcon icon={m.icon} />
                  <span>{m.label}</span>
                </div>
                <FontAwesomeIcon icon={open ? faChevronDown : faChevronRight} />
              </button>
              {open && (
                <div className="ssb-group-body">
                  {filteredChildren.map((c) => (
                    <NavLink
                      key={c.to}
                      to={c.to}
                      className={({ isActive }) =>
                        `ssb-subitem ${isActive ? "active" : ""}`
                      }
                    >
                      <FontAwesomeIcon icon={c.icon} />
                      <span>{c.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Support */}
      <div className="ssb-support">
        <button className="ssb-support-btn">
          <FontAwesomeIcon icon={faHeadphones} />
          <span>Support</span>
        </button>
      </div>

      {/* Thu gọn */}
      <div className="ssb-collapse">
        <button onClick={onToggle}>
          <FontAwesomeIcon icon={faChevronLeft} />
          <span>Thu gọn</span>
        </button>
      </div>
    </aside>
  );
}
