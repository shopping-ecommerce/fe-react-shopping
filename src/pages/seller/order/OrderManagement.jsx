// src/pages/seller/orders/OrderManagement.jsx
"use client";

import React, { useMemo, useRef, useState, useEffect, useContext } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "../../../styles/OrderManagement.css";
import { AuthContext } from "../../../contexts/AuthContext";

// ⚠️ DÙNG service đúng tên file đã chuẩn hóa statuses
import { fetchOrdersBySeller } from "../../../services/sellerOrders";
import { updateOrder } from "../../../services/orderActions"; // dùng chung cho confirm/cancel
import { ConfirmOrderModal, CancelOrderModal } from "./OrderModals";

// API config để gọi profile & seller
import { API_CONFIG, apiUrl } from "../../../config/api";

/** Map tab -> status backend (Enum từ BE) */
const STATUS_MAP = {
  all: null,
  pending: "PENDING",
  processing: "CONFIRMED",
  shipping: "SHIPPED",
  delivered: "DELIVERED",
  cancelled: "CANCELLED",
};

/** Chuẩn hóa status BE -> UI key */
const normalizeStatusForUI = (s) => {
  switch (s) {
    case "CONFIRMED":
      return "processing";
    case "SHIPPED":
      return "shipping";
    case "DELIVERED":
      return "delivered";
    case "CANCELLED":
      return "cancelled";
    case "PENDING":
    default:
      return "pending";
  }
};

/** Map 1 record BE -> model UI cho bảng */
const toUiOrder = (o) => {
  const items = Array.isArray(o.orderItems) ? o.orderItems : [];
  const quantity = items.reduce(
    (sum, it) => sum + (Number(it?.quantity) || 0),
    0
  );

  // Null-safe tiền tệ
  const subtotal = Number(o.subtotal ?? 0);
  const discountAmount = Number(o.discountAmount ?? 0);
  const shippingFee = Number(o.shippingFee ?? 0);
  const revenue = subtotal - discountAmount;
  const orderValue =
    (o.totalAmount ?? null) != null
      ? Number(o.totalAmount)
      : revenue + shippingFee;

  return {
    id: o.id,
    orderDate: o.createdTime?.slice(0, 10) || "", // YYYY-MM-DD
    status: normalizeStatusForUI(o.status),
    quantity,
    revenue,
    orderValue,
    customerName: o.recipientName || "",
    labels: [], // nếu có nhãn thì map vào
    isOverdue: false,
    isNearDeadline: false,
    _raw: o, // giữ lại bản gốc
  };
};

export default function OrderManagement() {
  const { authFetch } = useContext(AuthContext) || {};
  const navigate = useNavigate();

  // sellerId động (thay vì hardcode)
  const [sellerId, setSellerId] = useState("");
  const [resolvingSeller, setResolvingSeller] = useState(false);
  const [sellerErr, setSellerErr] = useState("");

  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFilterSidebar, setShowFilterSidebar] = useState(false);

  // Ngày đặt hàng
  const [selectedDateRange, setSelectedDateRange] = useState("all");
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [headerChecked, setHeaderChecked] = useState(false);

  // Lọc khác
  const [activeFilters, setActiveFilters] = useState({
    labels: [],
    deadlines: [],
  });

  // Chọn đơn
  const [selectedIds, setSelectedIds] = useState(new Set());
  const headerCheckboxRef = useRef(null);

  // Data từ API
  const [allOrders, setAllOrders] = useState([]); // đếm từng tab
  const [tableOrders, setTableOrders] = useState([]); // render theo tab
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [tab, setTab] = useState("pending");
  const [q, setQ] = useState("");

  // Modal state
  const [orderForConfirm, setOrderForConfirm] = useState(null);
  const [orderForCancel, setOrderForCancel] = useState(null);

  // Options
  const dateRangeOptions = [
    { key: "today", label: "Hôm nay" },
    { key: "7days", label: "7 ngày qua" },
    { key: "30days", label: "30 ngày qua" },
    { key: "all", label: "Toàn thời gian" },
    { key: "custom", label: "Tuỳ chỉnh" },
  ];

  const filterOptions = {
    labels: [
      { key: "cần thu tiền", label: "Cần thu tiền" },
      { key: "chưa in phiếu", label: "Chưa in phiếu" },
      { key: "cần xuất hóa đơn", label: "Cần xuất hóa đơn" },
      { key: "đã xuất hóa đơn", label: "Đã xuất hóa đơn" },
    ],
    deadlines: [
      { key: "quá hạn", label: "Quá hạn" },
      { key: "sắp quá hạn", label: "Sắp quá hạn" },
    ],
  };

  // --- Helpers chuẩn hoá & thu thập option (hỗ trợ object & array) ---
  const normalizeOptionKey = (key) => {
    const raw = String(key || "").trim();
    const lower = raw.toLowerCase();
    if (
      ["size", "kích cỡ", "kích thước", "kich co", "kich thuoc"].includes(lower)
    )
      return "Kích cỡ";
    if (["color", "màu", "màu sắc", "mau", "mau sac"].includes(lower))
      return "Màu sắc";
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const collectItemOptions = (item) => {
    const out = [];

    // 1) Dạng object: { "Dung tích": "1000ML", "Khối lượng": "10kg" }
    if (
      item &&
      item.options &&
      typeof item.options === "object" &&
      !Array.isArray(item.options)
    ) {
      for (const [k, v] of Object.entries(item.options)) {
        const val = String(v ?? "").trim();
        if (!val) continue;
        out.push([normalizeOptionKey(k), val]);
      }
    }

    // 2) Dạng mảng: [{ optionKey, optionValue }] hoặc [{ key, value }]
    if (Array.isArray(item?.options)) {
      for (const node of item.options) {
        const k = node?.optionKey ?? node?.key;
        const v = node?.optionValue ?? node?.value;
        const key = normalizeOptionKey(k);
        const val = String(v ?? "").trim();
        if (!key || !val) continue;
        out.push([key, val]);
      }
    }

    // 3) Tương thích ngược nếu BE cũ để riêng size/color
    const size = item?.size ?? item?.variantSize ?? null;
    const color = item?.color ?? item?.colorName ?? null;
    if (size && !out.some(([k]) => k === "Kích cỡ"))
      out.push(["Kích cỡ", String(size)]);
    if (color && !out.some(([k]) => k === "Màu sắc"))
      out.push(["Màu sắc", String(color)]);

    // Loại trùng key-value
    const seen = new Set();
    return out.filter(([k, v]) => {
      const key = `${k}::${v}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // Helper lấy giá trị màu (để vẽ swatch)
  const getColorValue = (item) => {
    const pairs = collectItemOptions(item);
    const found = pairs.find(([k]) => k === "Màu sắc");
    if (found) return found[1];
    return item?.color ?? item?.colorName ?? null;
  };

  // Map tên màu thường gặp -> mã màu
  const colorNameToCss = (name) => {
    if (!name) return null;
    const t = String(name).trim().toLowerCase();
    const map = {
      đen: "#111111",
      trắng: "#ffffff",
      nâu: "#8b4513",
      "xanh navy": "#001f3f",
      "xanh dương": "#1e88e5",
      "xanh lá": "#2e7d32",
      đỏ: "#d32f2f",
      xám: "#9e9e9e",
      be: "#f5f5dc",
      black: "#111111",
      white: "#ffffff",
      navy: "#001f3f",
      blue: "#1e88e5",
      green: "#2e7d32",
      red: "#d32f2f",
      gray: "#9e9e9e",
      grey: "#9e9e9e",
      brown: "#8b4513",
    };
    return map[t] || null;
  };

  const extractSizeColor = (item) => {
    const opts = item?.options || {};
    const size =
      opts["Kích cỡ"] ??
      opts["Kich cỡ"] ??
      opts["Kich co"] ??
      opts["Size"] ??
      item.size ??
      item.variantSize ??
      null;
    const color =
      opts["Màu sắc"] ??
      opts["Mau sac"] ??
      opts["Color"] ??
      item.color ??
      item.colorName ??
      null;
    return { size, color };
  };

  // Thu gọn/mở rộng danh sách phân loại theo từng order
  const [expandedVariants, setExpandedVariants] = useState(() => new Set());
  const toggleExpandVariants = (orderId) => {
    setExpandedVariants((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const renderVariantChips = (items, orderId, max = 1) => {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      return (
        <div className="variants-wrap">
          <div className="variant-row">
            <span className="chip none">Không phân loại</span>
          </div>
        </div>
      );
    }

    const expanded = expandedVariants.has(orderId);
    const visible = expanded ? list : list.slice(0, max);

    return (
      <div className="variants-wrap">
        {visible.map((it, idx) => {
          const pairs = collectItemOptions(it); // [[key, value], ...]
          const colorVal = getColorValue(it);
          const swatch = colorNameToCss(colorVal);

          return (
            <div className="variant-row" key={idx}>
              {pairs.length === 0 ? (
                <span className="chip none">Không phân loại</span>
              ) : (
                pairs.map(([k, v], i) => {
                  if (k === "Màu sắc") {
                    return (
                      <span className="chip color" key={`${k}-${i}`}>
                        {swatch ? (
                          <span className="sw" style={{ background: swatch }} />
                        ) : null}
                        {k}: {v}
                      </span>
                    );
                  }
                  return (
                    <span className="chip size" key={`${k}-${i}`}>
                      {k}: {v}
                    </span>
                  );
                })
              )}
              <span className="chip qty">x{it.quantity}</span>
            </div>
          );
        })}

        {list.length > max && (
          <button
            type="button"
            className="variants-toggle"
            onClick={() => toggleExpandVariants(orderId)}
            aria-expanded={expanded}
            title={expanded ? "Thu gọn" : "Xem tất cả"}
          >
            {expanded ? "Thu gọn ▲" : `Xem tất cả ▼`}
          </button>
        )}
      </div>
    );
  };

  // ====== Resolve sellerId theo user đang đăng nhập ======
  useEffect(() => {
    if (!authFetch) return;
    let cancelled = false;

    (async () => {
      try {
        setResolvingSeller(true);
        setSellerErr("");

        // 1) Lấy profile (GET /info/profiles/getMyProfile)
        const resProf = await authFetch(
          apiUrl(API_CONFIG.endpoints.getMyProfile),
          {
            method: "GET",
            headers: { Accept: "application/json" },
          }
        );
        const dataProf = await resProf.json().catch(() => ({}));
        if (!resProf.ok)
          throw new Error(dataProf?.message || `HTTP ${resProf.status}`);

        const userId = dataProf?.result?.id;
        if (!userId) throw new Error("Không lấy được userId từ profile.");

        // 2) Lấy seller theo userId (GET /info/sellers/searchByUserId/{userId})
        const resSeller = await authFetch(
          apiUrl(API_CONFIG.endpoints.searchSellerByUserId(userId)),
          {
            method: "GET",
            headers: { Accept: "application/json" },
          }
        );
        const dataSeller = await resSeller.json().catch(() => ({}));
        if (!resSeller.ok)
          throw new Error(dataSeller?.message || `HTTP ${resSeller.status}`);

        const seller = dataSeller?.result;
        const sid = seller?.id || seller?.sellerId;
        if (!sid) throw new Error("Tài khoản hiện chưa có sellerId.");

        if (!cancelled) setSellerId(sid);
      } catch (e) {
        if (!cancelled) {
          setSellerErr(e?.message || "Không xác định được sellerId.");
        }
      } finally {
        if (!cancelled) setResolvingSeller(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // ====== Utils ngày ======
  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString("vi-VN");
  const formatDateObj = (d) =>
    d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const getSelectedRange = () => {
    const today = startOfToday();
    if (selectedDateRange === "today") return { from: today, to: today };
    if (selectedDateRange === "7days")
      return { from: addDays(today, -6), to: today };
    if (selectedDateRange === "30days")
      return { from: addDays(today, -29), to: today };
    if (selectedDateRange === "custom" && customDateStart && customDateEnd) {
      const from = new Date(customDateStart);
      const to = new Date(customDateEnd);
      to.setHours(0, 0, 0, 0);
      return { from, to };
    }
    return null; // "all"
  };

  const dateRangeLabel = () => {
    if (selectedDateRange === "all") return null;
    const map = {
      today: "Hôm nay",
      "7days": "7 ngày qua",
      "30days": "30 ngày qua",
      custom: "Tùy chỉnh",
    };
    const rng = getSelectedRange();
    if (!rng) return map[selectedDateRange];
    return `${map[selectedDateRange]} (${formatDateObj(
      rng.from
    )} - ${formatDateObj(rng.to)})`;
  };

  // ====== FETCH TẤT CẢ (đếm tab) ======
  useEffect(() => {
    if (!authFetch || !sellerId) return;
    let stop = false;
    (async () => {
      try {
        setErr("");
        const raw = await fetchOrdersBySeller(authFetch, sellerId, null);
        if (stop) return;
        const converted = raw.map(toUiOrder);
        setAllOrders(converted);
      } catch (e) {
        if (!stop) setErr(e.message || "Không tải được đơn hàng");
      }
    })();
    return () => {
      stop = true;
    };
  }, [authFetch, sellerId]);

  // ====== FETCH THEO TAB (render bảng) ======
  useEffect(() => {
    if (!authFetch || !sellerId) return;
    let stop = false;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const backendStatus = STATUS_MAP[tab]; // null => all
        const raw = await fetchOrdersBySeller(
          authFetch,
          sellerId,
          backendStatus
        );
        if (stop) return;
        const converted = raw.map(toUiOrder);
        setTableOrders(converted);
      } catch (e) {
        if (!stop) setErr(e.message || "Không tải được danh sách theo tab");
        setTableOrders([]);
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [authFetch, sellerId, tab]);

  // ====== Tabs data + counts ======
  const tabs = useMemo(() => {
    const all = allOrders;
    return [
      { key: "all", label: "Tất cả", count: all.length },
      {
        key: "pending",
        label: "Chờ xác nhận",
        count: all.filter((o) => o.status === "pending").length,
        overdueCount: 0,
      },
      {
        key: "processing",
        label: "Đã xác nhận",
        count: all.filter((o) => o.status === "processing").length,
      },
      {
        key: "shipping",
        label: "Đang vận chuyển",
        count: all.filter((o) => o.status === "shipping").length,
      },
      {
        key: "delivered",
        label: "Đã giao hàng",
        count: all.filter((o) => o.status === "delivered").length,
      },
      {
        key: "cancelled",
        label: "Đã hủy",
        count: all.filter((o) => o.status === "cancelled").length,
      },
    ];
  }, [allOrders]);

  // ====== Lọc dữ liệu cho bảng ======
  const filteredOrders = useMemo(() => {
    let orders = tableOrders;

    if (q.trim()) {
      const t = q.trim().toLowerCase();
      orders = orders.filter(
        (o) =>
          o.id.toLowerCase().includes(t) ||
          (o.customerName || "").toLowerCase().includes(t)
      );
    }

    if (activeFilters.labels.length > 0) {
      orders = orders.filter((o) =>
        activeFilters.labels.some((label) => o.labels.includes(label))
      );
    }

    if (activeFilters.deadlines.length > 0) {
      orders = orders.filter((o) => {
        if (activeFilters.deadlines.includes("quá hạn") && o.isOverdue)
          return true;
        if (activeFilters.deadlines.includes("sắp quá hạn") && o.isNearDeadline)
          return true;
        return false;
      });
    }

    const rng = getSelectedRange();
    if (rng) {
      const fromTime = rng.from.getTime();
      const toTime = rng.to.getTime();
      orders = orders.filter((o) => {
        const t = new Date(o.orderDate).setHours(0, 0, 0, 0);
        return t >= fromTime && t <= toTime;
      });
    }

    return orders;
  }, [
    tableOrders,
    q,
    activeFilters,
    selectedDateRange,
    customDateStart,
    customDateEnd,
  ]);

  // ====== Chọn đơn (header checkbox indeterminate) ======
  const visiblePendingIds = useMemo(
    () => filteredOrders.filter((o) => o.status === "pending").map((o) => o.id),
    [filteredOrders]
  );

  const allVisiblePendingSelected =
    visiblePendingIds.length > 0 &&
    visiblePendingIds.every((id) => selectedIds.has(id));

  const someVisiblePendingSelected =
    visiblePendingIds.some((id) => selectedIds.has(id)) &&
    !allVisiblePendingSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someVisiblePendingSelected;
    }
  }, [someVisiblePendingSelected]);

  const toggleHeaderSelect = (checked) => {
    setHeaderChecked(checked);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        visiblePendingIds.forEach((id) => next.add(id));
      } else {
        visiblePendingIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const toggleRowSelect = (order) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(order.id)) next.delete(order.id);
      else next.add(order.id);
      return next;
    });
  };

  // ====== Buttons logic ======
  const hasActiveFilters =
    activeFilters.labels.length > 0 || activeFilters.deadlines.length > 0;

  const showClearAll =
    hasActiveFilters ||
    selectedDateRange !== "all" ||
    (selectedDateRange === "custom" && customDateStart && customDateEnd);

  const handleApplyFilters = (newFilters) => {
    setActiveFilters(newFilters);
    setShowFilterSidebar(false);
  };

  const handleClearAllFilters = () => {
    setActiveFilters({ labels: [], deadlines: [] });
    setSelectedDateRange("all");
    setCustomDateStart("");
    setCustomDateEnd("");
    setSelectedIds(new Set());
  };

  const handleDateRangeSelect = (range) => {
    setSelectedDateRange(range);
    if (range !== "custom") {
      setShowDatePicker(false);
      setCustomDateStart("");
      setCustomDateEnd("");
    }
  };

  const canBulkConfirm = headerChecked && visiblePendingIds.length > 0;

  const onBulkConfirm = () => {
    const ids = Array.from(selectedIds).filter((id) =>
      filteredOrders.some((o) => o.id === id && o.status === "pending")
    );
    if (ids.length === 0) return;
    alert(`Xác nhận hàng loạt các đơn: ${ids.join(", ")}`);
  };

  // Helpers
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(Math.round(Number(amount || 0)));

  const getStatusLabel = (status) => {
    const statusMap = {
      pending: "Chờ xác nhận",
      processing: "Đã xác nhận",
      shipping: "Đang vận chuyển",
      delivered: "Đã giao hàng",
      cancelled: "Đã hủy",
    };
    return statusMap[status] || status;
  };

  // ====== Modal handlers ======
  const onConfirmOrder = (order) => setOrderForConfirm(order._raw);
  const onDeleteOrder = (order) => setOrderForCancel(order._raw);
  const onViewOrder = (order) => navigate(`/seller/orders/${order.id}`);

  const refreshLists = async () => {
    if (!sellerId) return;
    const backendStatus = STATUS_MAP[tab];
    const raw = await fetchOrdersBySeller(authFetch, sellerId, backendStatus);
    setTableOrders(raw.map(toUiOrder));
    const rawAll = await fetchOrdersBySeller(authFetch, sellerId, null);
    setAllOrders(rawAll.map(toUiOrder));
  };

  // ngay cạnh các handler khác
  const onShipOrder = async (order) => {
    try {
      await updateOrder(authFetch, {
        orderId: order._raw.id, // nhớ dùng id thực từ BE
        sellerId, // sellerId động
        status: "SHIPPED", // đẩy sang trạng thái Đang vận chuyển
        reason: "",
      });
      await refreshLists();
    } catch (e) {
      alert(e?.message || "Chuyển sang vận chuyển thất bại");
    }
  };

  return (
    <div className="order-mgmt-page">
      {/* HEADER */}
      <div className="order-mgmt-header">
        <div className="order-mgmt-breadcrumb">
          <NavLink to="/seller/home" className="order-mgmt-crumb-link">
            Trang chủ
          </NavLink>
          <span className="order-mgmt-crumb-sep">›</span>
          <NavLink to="/seller/orders" className="order-mgmt-crumb-link">
            Đơn hàng
          </NavLink>
          <span className="order-mgmt-crumb-sep">›</span>
          <span className="order-mgmt-crumb-current">Danh sách đơn hàng</span>
        </div>

        <div className="order-mgmt-head-row">
          <h1 className="order-mgmt-title">Danh sách đơn hàng</h1>
        </div>

        {/* HƯỚNG DẪN */}
        <div className="orders-guide">
          <span className="guide-text">
            Vui lòng xem hướng dẫn & gửi góp ý:
          </span>
          <button className="link-inline">Hướng dẫn xử lý đơn hàng</button>
          <button className="link-inline">Gửi góp ý</button>
        </div>

        {/* TABS */}
        <div className="order-mgmt-actions-row">
          <div className="order-mgmt-tabs">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`order-mgmt-tab ${tab === t.key ? "active" : ""}`}
                onClick={() => {
                  setTab(t.key);
                  setSelectedIds(new Set());
                  setHeaderChecked(false);
                }}
              >
                <span className="order-mgmt-tab-top">
                  <span className="order-mgmt-tab-label">{t.label}</span>
                  <span className="order-mgmt-tab-count">({t.count})</span>
                </span>
                {t.key === "pending" && t.overdueCount > 0 && (
                  <div className="order-mgmt-tab-subtitle">
                    <span className="overdue-indicator">⚠️</span>
                    {t.overdueCount} đơn quá hạn XN
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* THÔNG BÁO SELLER */}
      {!sellerId && (
        <div className="order-mgmt-section">
          {resolvingSeller ? (
            <div className="om-note">🔎 Đang xác định Seller ID…</div>
          ) : sellerErr ? (
            <div className="om-note om-warn">⚠️ {sellerErr}</div>
          ) : null}
        </div>
      )}

      {/* BỘ LỌC & TÌM KIẾM */}
      <div className="order-mgmt-section orders-filter">
        <div className="filter-row">
          <div className="date-select">
            <button
              className="date-btn"
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              Ngày đặt hàng <span className="dropdown-arrow">▾</span>
            </button>

            {showDatePicker && (
              <div className="date-dropdown improved">
                <div className="date-quick-grid">
                  {dateRangeOptions
                    .filter((o) => o.key !== "custom")
                    .map((option) => (
                      <button
                        key={option.key}
                        className={`date-pill ${
                          selectedDateRange === option.key ? "active" : ""
                        }`}
                        onClick={() => handleDateRangeSelect(option.key)}
                      >
                        {option.label}
                      </button>
                    ))}
                </div>

                <div className="date-custom-block">
                  <div className="custom-title">Tuỳ chỉnh khoảng ngày</div>
                  <div className="date-inputs">
                    <input
                      type="date"
                      value={customDateStart}
                      onChange={(e) => {
                        setSelectedDateRange("custom");
                        setCustomDateStart(e.target.value);
                      }}
                    />
                    <span className="date-separator">đến</span>
                    <input
                      type="date"
                      value={customDateEnd}
                      onChange={(e) => {
                        setSelectedDateRange("custom");
                        setCustomDateEnd(e.target.value);
                      }}
                    />
                  </div>
                  <button
                    className="apply-custom-date"
                    disabled={!customDateStart || !customDateEnd}
                    onClick={() => setShowDatePicker(false)}
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            className="order-mgmt-btn outline"
            onClick={() => setShowFilterSidebar(true)}
          >
            Bộ lọc khác
          </button>
        </div>
      </div>

      {/* CONTROLS TỔNG QUAN */}
      <div className="order-mgmt-section order-controls">
        <div className="date-filter-section">
          <div className="date-tag">
            <span className="tag-label">Dạng lọc:</span>

            {dateRangeLabel() && (
              <span className="date-range-tag">
                <span className="tag-content">
                  Ngày đặt hàng: {dateRangeLabel()}
                </span>
                <button
                  className="remove-tag"
                  onClick={() => {
                    setSelectedDateRange("all");
                    setCustomDateStart("");
                    setCustomDateEnd("");
                  }}
                  title="Bỏ lọc ngày"
                >
                  ×
                </button>
              </span>
            )}

            {(() => {
              const hasActiveFilters =
                activeFilters.labels.length > 0 ||
                activeFilters.deadlines.length > 0;
              const showClearAll =
                hasActiveFilters ||
                selectedDateRange !== "all" ||
                (selectedDateRange === "custom" &&
                  customDateStart &&
                  customDateEnd);
              if (!showClearAll) return null;
              return (
                <button
                  className="clear-filter"
                  onClick={handleClearAllFilters}
                >
                  Xóa tất cả
                </button>
              );
            })()}
          </div>
        </div>

        <div className="order-summary">
          <div className="summary-item">
            <span className="label">Đơn hàng:</span>
            <span className="count">{filteredOrders.length}</span>
          </div>
          <div className="summary-actions">
            <button className="order-mgmt-btn ghost">Xuất đơn hàng</button>

            <button
              className={`order-mgmt-btn confirm-bulk ${
                canBulkConfirm ? "" : "disabled"
              }`}
              disabled={!canBulkConfirm}
              onClick={onBulkConfirm}
              title={
                canBulkConfirm
                  ? "Xác nhận các đơn đã chọn"
                  : "Bấm tick ở hàng đầu để bật nút"
              }
            >
              Xác nhận hàng loạt
            </button>
          </div>
        </div>
      </div>

      {/* BẢNG */}
      <div className="order-mgmt-section orders-table">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <div className="order-mgmt-th-content">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={headerChecked}
                      onChange={(e) => toggleHeaderSelect(e.target.checked)}
                      title="Chọn tất cả đơn Chờ xác nhận đang hiển thị"
                    />
                  </div>
                </th>
                <th>
                  <div className="order-mgmt-th-content">
                    <div className="order-mgmt-th-text">
                      <span>Mã đơn hàng</span>
                    </div>
                  </div>
                </th>
                <th>
                  <div className="order-mgmt-th-content">
                    <span>Trạng thái</span>
                  </div>
                </th>
                {/* ❌ BỎ cột Hạn xác nhận */}
                <th>
                  <div className="order-mgmt-th-content">
                    <div className="order-mgmt-th-text">
                      <span>Số lượng/</span>
                      <span>Phân loại/GTĐH</span>
                    </div>
                  </div>
                </th>

                <th>
                  <div className="order-mgmt-th-content">
                    <div className="order-mgmt-th-text">
                      <span className="red-dot">●</span>
                      <span>Nhận đơn hàng</span>
                    </div>
                  </div>
                </th>
                <th>
                  <div className="order-mgmt-th-content">
                    <span>Thao tác</span>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {!sellerId ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    {resolvingSeller
                      ? "Đang xác định Seller..."
                      : sellerErr || "Chưa xác định được Seller"}
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    Đang tải…
                  </td>
                </tr>
              ) : err ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    {err}
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    <div className="no-data">
                      <div className="no-data-text">Không có đơn hàng nào</div>
                      <div className="no-data-subtitle">
                        Các đơn hàng sẽ hiển thị tại đây khi có
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="order-row">
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(order.id)}
                        onChange={() => toggleRowSelect(order)}
                        title={
                          order.status === "pending"
                            ? "Chọn để xác nhận"
                            : "Không thể xác nhận đơn không ở trạng thái chờ"
                        }
                      />
                    </td>

                    <td>
                      <div className="order-info">
                        <div className="order-id">{order.id}</div>
                        <div className="order-date">
                          {formatDate(order.orderDate)}
                        </div>
                        <div className="customer-name">
                          {order.customerName}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={`status-badge status-${order.status}`}>
                        <span className="status-icon">
                          {order.status === "pending" && "⏳"}
                          {order.status === "processing" && "⚙️"}
                          {order.status === "shipping" && "🚚"}
                          {order.status === "delivered" && "✅"}
                          {order.status === "cancelled" && "❌"}
                        </span>
                        {getStatusLabel(order.status)}
                      </span>

                      {order.labels.length > 0 && (
                        <div className="order-labels">
                          {order.labels.map((label) => (
                            <span key={label} className="label-tag">
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* ❌ BỎ cột deadline */}

                    <td>
                      <td>
                        <div className="order-col-qty">
                          {/* Meta tổng quan: SL tổng + GTĐH dạng chip */}
                          <div className="variant-meta-row">
                            <span className="chip qty total">
                              SL: {order.quantity}
                            </span>
                            <span className="chip value">
                              GTĐH: {formatCurrency(order.orderValue)}
                            </span>
                          </div>

                          {/* Phân loại (mặc định chỉ 1 sản phẩm; bấm để xem hết) */}
                          <div className="variant-item">
                            {renderVariantChips(
                              order._raw?.orderItems || [],
                              order.id,
                              1
                            )}
                          </div>
                        </div>
                      </td>
                    </td>

                    <td>
                      <div className="receive-order">
                        <span className="receive-status">Đã nhận</span>
                      </div>
                    </td>

                    <td className="action-cell">
                      <div className="action-buttons-cell">
                        {order.status === "pending" && (
                          <>
                            {/* Xem chi tiết: nền đen, icon trắng */}
                            <NavLink
                              to={`/seller/orders/${order.id}`}
                              className="icon-btn icon-view"
                              title="Xem chi tiết"
                              aria-label="Xem chi tiết"
                            >
                              {/* Eye icon */}
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  fill="currentColor"
                                  d="M12 5c5.05 0 9.27 3.11 10.8 7.5C21.27 16.89 17.05 20 12 20S2.73 16.89 1.2 12.5C2.73 8.11 6.95 5 12 5zm0 2C7.89 7 4.36 9.44 3.03 12.5 4.36 15.56 7.89 18 12 18s7.64-2.44 8.97-5.5C19.64 9.44 16.11 7 12 7zm0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z"
                                />
                              </svg>
                            </NavLink>

                            {/* Xác nhận: nền xanh dương, icon trắng */}
                            <button
                              className="icon-btn icon-confirm"
                              onClick={() => onConfirmOrder(order)}
                              disabled={!sellerId}
                              title="Xác nhận đơn"
                              aria-label="Xác nhận đơn"
                            >
                              {/* Check icon */}
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  fill="currentColor"
                                  d="M9 16.2 4.8 12l-1.4 1.4L9 19l12-12-1.4-1.4z"
                                />
                              </svg>
                            </button>

                            {/* Hủy: nền đỏ, icon trắng */}
                            <button
                              className="icon-btn icon-cancel"
                              onClick={() => onDeleteOrder(order)}
                              disabled={!sellerId}
                              title="Hủy đơn hàng"
                              aria-label="Hủy đơn hàng"
                            >
                              {/* X icon */}
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  fill="currentColor"
                                  d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z"
                                />
                              </svg>
                            </button>
                          </>
                        )}

                        {order.status === "processing" && (
                          <>
                            {/* (tuỳ chọn) vẫn để nút xem */}
                            <NavLink
                              to={`/seller/orders/${order.id}`}
                              className="icon-btn icon-view"
                              title="Xem chi tiết"
                              aria-label="Xem chi tiết"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  fill="currentColor"
                                  d="M12 5c5.05 0 9.27 3.11 10.8 7.5C21.27 16.89 17.05 20 12 20S2.73 16.89 1.2 12.5C2.73 8.11 6.95 5 12 5zm0 2C7.89 7 4.36 9.44 3.03 12.5 4.36 15.56 7.89 18 12 18s7.64-2.44 8.97-5.5C19.64 9.44 16.11 7 12 7zm0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z"
                                />
                              </svg>
                            </NavLink>

                            {/* (giữ logic giao hàng nếu cần – icon truck, có thể dùng màu xanh dương chung) */}
                            <button
                              className="icon-btn icon-confirm"
                              onClick={() => onShipOrder(order)}
                              disabled={!sellerId}
                              title="Chuyển sang Đang vận chuyển"
                              aria-label="Chuyển sang Đang vận chuyển"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  fill="currentColor"
                                  d="M3 6h11v7h2l3 3v2h-2a2 2 0 11-4 0H9a2 2 0 11-4 0H3zM7 19a1 1 0 100-2 1 1 0 000 2zm10 0a1 1 0 100-2 1 1 0 000 2z"
                                />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SIDEBAR LỌC KHÁC */}
      {showFilterSidebar && (
        <>
          <div
            className="sidebar-overlay"
            onClick={() => setShowFilterSidebar(false)}
          />
          <div className="filter-sidebar">
            <div className="sidebar-header">
              <h3>Bộ lọc khác</h3>
              <button
                className="close-btn"
                onClick={() => setShowFilterSidebar(false)}
              >
                ×
              </button>
            </div>

            <div className="sidebar-content">
              <FilterSidebar
                filterOptions={filterOptions}
                activeFilters={activeFilters}
                onApply={(f) => {
                  handleApplyFilters(f);
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* ===== Modals ===== */}
      {orderForConfirm && (
        <ConfirmOrderModal
          order={orderForConfirm}
          onClose={() => setOrderForConfirm(null)}
          onSubmit={async () => {
            try {
              await updateOrder(authFetch, {
                orderId: orderForConfirm.id,
                sellerId,
                status: "CONFIRMED",
                reason: "",
              });
              setOrderForConfirm(null);
              await refreshLists();
            } catch (e) {
              alert(e?.message || "Xác nhận đơn thất bại");
            }
          }}
        />
      )}

      {orderForCancel && (
        <CancelOrderModal
          order={orderForCancel}
          onClose={() => setOrderForCancel(null)}
          onSubmit={async (reason) => {
            try {
              if (!reason) return alert("Vui lòng chọn hoặc nhập lý do hủy.");
              await updateOrder(authFetch, {
                orderId: orderForCancel.id,
                sellerId,
                status: "CANCELLED",
                reason,
              });
              setOrderForCancel(null);
              await refreshLists();
            } catch (e) {
              alert(e?.message || "Hủy đơn thất bại");
            }
          }}
        />
      )}
    </div>
  );
}

/** Sidebar lọc phụ */
function FilterSidebar({ filterOptions, activeFilters, onApply }) {
  const [tempFilters, setTempFilters] = useState(activeFilters);

  const handleLabelToggle = (label) => {
    setTempFilters((prev) => ({
      ...prev,
      labels: prev.labels.includes(label)
        ? prev.labels.filter((l) => l !== label)
        : [...prev.labels, label],
    }));
  };

  const handleDeadlineToggle = (deadline) => {
    setTempFilters((prev) => ({
      ...prev,
      deadlines: prev.deadlines.includes(deadline)
        ? prev.deadlines.filter((d) => d !== deadline)
        : [...prev.deadlines, deadline],
    }));
  };

  const handleApply = () => onApply(tempFilters);

  return (
    <div className="filter-content">
      <div className="filter-section">
        <h4>Nhãn đơn hàng</h4>
        {filterOptions.labels.map((option) => (
          <label key={option.key} className="filter-checkbox">
            <input
              type="checkbox"
              checked={tempFilters.labels.includes(option.key)}
              onChange={() => handleLabelToggle(option.key)}
            />
            <span className="checkbox-label">{option.label}</span>
          </label>
        ))}
      </div>

      <div className="filter-section">
        <h4>Hạn xác nhận đơn hàng</h4>
        {filterOptions.deadlines.map((option) => (
          <label key={option.key} className="filter-checkbox">
            <input
              type="checkbox"
              checked={tempFilters.deadlines.includes(option.key)}
              onChange={() => handleDeadlineToggle(option.key)}
            />
            <span className="checkbox-label">
              <span className="checkbox-icon">
                {option.key === "quá hạn" ? "🚨" : "⚠️"}
              </span>
              {option.label}
            </span>
          </label>
        ))}
      </div>

      <div className="filter-actions">
        <button className="apply-btn" onClick={handleApply}>
          Áp dụng
        </button>
      </div>
    </div>
  );
}
