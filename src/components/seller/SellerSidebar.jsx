// src/components/seller/SellerSidebar.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useContext,
  useCallback,
} from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  faHouse,
  faBuilding,
  faBoxArchive,
  faWarehouse,
  faChartLine,
  faBullhorn,
  faStore,
  faChevronDown,
  faChevronRight,
  faHeadphones,
  faChevronLeft,
  faMagnifyingGlass,
  faListCheck,
  faFileInvoiceDollar,
  faFileLines,
  faClockRotateLeft,
  faUpload,
  faComments,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { AuthContext } from "../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../config/api";
import "../../styles/sellersidebar.css";

const safeJson = async (res) => {
  const t = await res.text();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return { message: t };
  }
};

export default function SellerSidebar({
  isOpen = true,
  onToggle,
  sellerStatus: sellerStatusProp,
}) {
  const { pathname } = useLocation();
  const { authFetch } = useContext(AuthContext);

  const [query, setQuery] = useState("");
  const [sellerStatus, setSellerStatus] = useState(
    typeof sellerStatusProp === "string" ? sellerStatusProp.toUpperCase() : null
  );

  // Tự fetch sellerStatus nếu không truyền prop
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof sellerStatusProp === "string") return;
        if (!authFetch) return;

        const r1 = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile), {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const j1 = await safeJson(r1);
        const userId = (j1.result ?? j1)?.id;
        if (!userId) return;

        const r2 = await authFetch(
          apiUrl(API_CONFIG.endpoints.searchSellerByUserId(userId)),
          { method: "GET", headers: { Accept: "application/json" } }
        );
        if (!r2.ok) return;
        const j2 = await safeJson(r2);
        const status = (j2.result?.status || "").toString().toUpperCase();
        if (!cancelled) setSellerStatus(status || null);
      } catch {
        if (!cancelled) setSellerStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, sellerStatusProp]);

  const isSuspended = (sellerStatus || "").toUpperCase() === "SUSPENDED";

  // ===== MENU =====
  const baseMenu = useMemo(
    () => [
      // 1) Trang chủ
      { type: "item", label: "Trang chủ", icon: faHouse, to: "/seller/home" },

      // 2) Sản phẩm (⛔ lock khi SUSPENDED)
      {
        type: "group",
        label: "Sản phẩm",
        icon: faBoxArchive,
        key: "products",
        locked: isSuspended,
        children: [
          {
            label: "Tạo sản phẩm",
            to: "/seller/create-products",
            icon: faUpload,
          },
          {
            label: "Danh sách sản phẩm",
            to: "/seller/products",
            icon: faListCheck,
          },
          {
            label: "Sản phẩm tạm ngưng",
            to: "/seller/products-suspended",
            icon: faClockRotateLeft,
          },
        ],
      },

      // 3) Đơn hàng
      {
        type: "group",
        label: "Đơn hàng",
        icon: faBuilding,
        key: "orders",
        locked: false,
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

      // 4) Kho & hàng tồn (⛔ lock khi SUSPENDED)
      {
        type: "group",
        label: "Kho & hàng tồn",
        icon: faWarehouse,
        key: "inventory",
        locked: isSuspended,
        children: [{ label: "Tồn kho", to: "/seller/inventory" }],
      },

      // 5) Chat khách hàng
      {
        type: "item",
        label: "Chat khách hàng",
        icon: faComments,
        to: "/seller/chat-customers",
      },

      // 6) Báo cáo vi phạm → đổi thành group với 2 mục con
      {
        type: "group",
        label: "Báo cáo vi phạm",
        icon: faTriangleExclamation,
        key: "violations",
        locked: false,
        children: [
          // trang hiện tại đổi tên thành Lịch sử báo cáo và GIỮ đường dẫn cũ
          { label: "Lịch sử báo cáo", to: "/seller/violations" },
          // trang lịch sử khiếu nại
          { label: "Lịch sử khiếu nại", to: "/seller/appeals-history" },
        ],
      },

      // 7) Quản lý tài chính
      {
        type: "item",
        label: "Quản lý tài chính",
        icon: faStore,
        to: "/seller/finance",
      },

      // 8) Trung tâm marketing (⛔ lock khi SUSPENDED)
      {
        type: "group",
        label: "Trung tâm marketing",
        icon: faBullhorn,
        key: "marketing",
        locked: isSuspended,
        children: [{ label: "Mã giảm giá", to: "/seller/vouchers" }],
      },

      // 9) Trung tâm phát triển
      {
        type: "group",
        label: "Trung tâm phát triển",
        icon: faChartLine,
        key: "growth",
        locked: false,
        children: [
          {
            label: "Hiệu quả kinh doanh",
            to: "/seller/business-efficiency",
            icon: faChartLine,
          },
          {
            label: "Chỉ số lượt truy cập",
            to: "/seller/traffic",
            icon: faChartLine,
          },
        ],
      },

      // 10) Chính sách bán hàng
      {
        type: "item",
        label: "Chính sách bán hàng",
        icon: faFileLines,
        to: "/seller/policy",
      },
    ],
    [isSuspended]
  );

  // Nếu SUSPENDED: đẩy phần locked xuống cuối; nếu không: giữ nguyên
  const menu = useMemo(() => {
    const withIndex = baseMenu.map((m, i) => ({ ...m, _i: i }));
    const unlocked = withIndex.filter((m) => !m.locked);
    const locked = withIndex.filter((m) => m.locked);
    return [...unlocked, ...locked];
  }, [baseMenu]);

  // mở sẵn groups thường dùng (thêm "violations")
  const [openKeys, setOpenKeys] = useState(
    () => new Set(["orders", "products", "violations"])
  );

  // Nếu một key đang mở mà bị khoá → đóng lại
  useEffect(() => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      menu.forEach((m) => {
        if (m.type === "group" && m.locked && next.has(m.key))
          next.delete(m.key);
      });
      return next;
    });
  }, [menu]);

  const toggleGroup = useCallback(
    (key, locked) => {
      if (!isOpen || locked) return;
      setOpenKeys((prev) => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
      });
    },
    [isOpen]
  );

  const showItem = (label = "") =>
    label.toLowerCase().includes(query.trim().toLowerCase());
  const lockTooltip =
    "Tài khoản đang bị tạm ngưng. Vui lòng khôi phục để sử dụng.";

  return (
    <aside className={`seller-sidebar ${isOpen ? "open" : "collapsed"}`}>
      {/* Top: Search */}
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
          // ===== ITEM =====
          if (m.type === "item") {
            return showItem(m.label) ? (
              <NavLink
                key={m.label}
                to={m.to}
                end={m.to === "/seller/home"}
                className={({ isActive }) =>
                  `ssb-item headlike ${isActive ? "active" : ""}`
                }
                title={!isOpen ? m.label : undefined}
              >
                <div className="left oneline">
                  <FontAwesomeIcon className="ssb-icon" icon={m.icon} />
                  {isOpen && <span className="label ellip">{m.label}</span>}
                </div>
                {isOpen && <span className="chev-spacer" />}
              </NavLink>
            ) : null;
          }

          // ===== GROUP =====
          const filteredChildren =
            m.children?.filter((c) => showItem(m.label) || showItem(c.label)) ??
            [];
          if (filteredChildren.length === 0 && !m.locked) return null;

          const open = openKeys.has(m.key);
          const groupActive = filteredChildren.some((c) =>
            pathname.startsWith(c.to)
          );

          // 🔒 Nhóm bị khoá: chỉ head, không children
          if (m.locked) {
            return (
              <div
                key={m.key}
                className={`ssb-group locked ${groupActive ? "active" : ""}`}
                title={lockTooltip}
              >
                <div
                  className="ssb-group-head locked-head"
                  aria-disabled="true"
                >
                  <div className="left oneline">
                    <FontAwesomeIcon className="ssb-icon" icon={m.icon} />
                    {isOpen && <span className="label ellip">{m.label}</span>}
                  </div>
                  {isOpen && <span className="ssb-tag-locked">Tạm ngưng</span>}
                </div>
              </div>
            );
          }

          // Nhóm bình thường
          return (
            <div
              key={m.key}
              className={`ssb-group ${groupActive ? "active" : ""}`}
            >
              <button
                className="ssb-group-head"
                onClick={() => toggleGroup(m.key, m.locked)}
                title={!isOpen ? m.label : undefined}
              >
                <div className="left oneline">
                  <FontAwesomeIcon className="ssb-icon" icon={m.icon} />
                  {isOpen && <span className="label ellip">{m.label}</span>}
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
                      <span className="ellip">{c.label}</span>
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
