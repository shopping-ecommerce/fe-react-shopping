"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import "../../../styles/OrderManagement.css";

/** MOCK DATA - bạn có thể thay bằng API thật sau */
const mockOrders = [
  {
    id: "DH001234567",
    orderDate: "2025-01-18",
    status: "pending",
    confirmDeadline: "2025-01-19 14:00",
    quantity: 2,
    revenue: 450000,
    orderValue: 500000,
    customerName: "Nguyễn Văn A",
    labels: ["cần thu tiền", "chưa in phiếu"],
    isOverdue: false,
    isNearDeadline: true,
  },
  {
    id: "DH001234568",
    orderDate: "2025-01-17",
    status: "pending",
    confirmDeadline: "2025-01-18 10:00",
    quantity: 1,
    revenue: 200000,
    orderValue: 250000,
    customerName: "Trần Thị B",
    labels: ["cần thu tiền", "cần xuất hóa đơn"],
    isOverdue: true,
    isNearDeadline: false,
  },
  {
    id: "DH001234569",
    orderDate: "2025-01-16",
    status: "processing",
    confirmDate: "2025-01-16 15:30",
    quantity: 3,
    revenue: 750000,
    orderValue: 800000,
    customerName: "Lê Văn C",
    labels: ["đã xuất hóa đơn"],
    isOverdue: false,
    isNearDeadline: false,
  },
  {
    id: "DH001234570",
    orderDate: "2025-01-15",
    status: "shipping",
    confirmDate: "2025-01-15 09:15",
    quantity: 1,
    revenue: 300000,
    orderValue: 350000,
    customerName: "Phạm Thị D",
    labels: ["đã xuất hóa đơn"],
    isOverdue: false,
    isNearDeadline: false,
  },
  {
    id: "DH001234571",
    orderDate: "2025-01-14",
    status: "delivered",
    confirmDate: "2025-01-14 11:20",
    quantity: 2,
    revenue: 600000,
    orderValue: 650000,
    customerName: "Hoàng Văn E",
    labels: ["đã xuất hóa đơn"],
    isOverdue: false,
    isNearDeadline: false,
  },
  {
    id: "DH001234572",
    orderDate: "2025-01-13",
    status: "cancelled",
    confirmDate: "2025-01-13 16:45",
    quantity: 1,
    revenue: 0,
    orderValue: 400000,
    customerName: "Vũ Thị F",
    labels: [],
    isOverdue: false,
    isNearDeadline: false,
  },
];

export default function OrderManagement() {
  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFilterSidebar, setShowFilterSidebar] = useState(false);

  // Ngày đặt hàng
  const [selectedDateRange, setSelectedDateRange] = useState("all"); // mặc định "Toàn thời gian"
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

  // Tabs data + counts
  const tabs = useMemo(() => {
    const allOrders = mockOrders;
    const pendingOrders = allOrders.filter((o) => o.status === "pending");
    const overdueCount = pendingOrders.filter((o) => o.isOverdue).length;

    return [
      { key: "all", label: "Tất cả", count: allOrders.length },
      {
        key: "pending",
        label: "Chờ xác nhận",
        count: pendingOrders.length,
        overdueCount,
      },
      {
        key: "processing",
        label: "Đang xử lý",
        count: allOrders.filter((o) => o.status === "processing").length,
      },
      {
        key: "shipping",
        label: "Đang vận chuyển",
        count: allOrders.filter((o) => o.status === "shipping").length,
      },
      {
        key: "delivered",
        label: "Đã giao hàng",
        count: allOrders.filter((o) => o.status === "delivered").length,
      },
      {
        key: "cancelled",
        label: "Đã hủy",
        count: allOrders.filter((o) => o.status === "cancelled").length,
      },
    ];
  }, []);

  const [tab, setTab] = useState("pending");
  const [q, setQ] = useState("");
  const [dateType] = useState("order"); // để sẵn nếu mở rộng

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
    if (selectedDateRange === "today") {
      return { from: today, to: today };
    }
    if (selectedDateRange === "7days") {
      return { from: addDays(today, -6), to: today };
    }
    if (selectedDateRange === "30days") {
      return { from: addDays(today, -29), to: today };
    }
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

  // ====== Lọc dữ liệu (tab/search/filters/date) ======
  const filteredOrders = useMemo(() => {
    let orders = mockOrders;

    if (tab !== "all") {
      orders = orders.filter((order) => order.status === tab);
    }

    if (q.trim()) {
      orders = orders.filter(
        (order) =>
          order.id.toLowerCase().includes(q.toLowerCase()) ||
          order.customerName.toLowerCase().includes(q.toLowerCase())
      );
    }

    if (activeFilters.labels.length > 0) {
      orders = orders.filter((order) =>
        activeFilters.labels.some((label) => order.labels.includes(label))
      );
    }

    if (activeFilters.deadlines.length > 0) {
      orders = orders.filter((order) => {
        if (activeFilters.deadlines.includes("quá hạn") && order.isOverdue)
          return true;
        if (
          activeFilters.deadlines.includes("sắp quá hạn") &&
          order.isNearDeadline
        )
          return true;
        return false;
      });
    }

    // Lọc theo Ngày đặt hàng
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
    tab,
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

  // tính toán như cũ
  const allVisiblePendingSelected =
    visiblePendingIds.length > 0 &&
    visiblePendingIds.every((id) => selectedIds.has(id));

  const someVisiblePendingSelected =
    visiblePendingIds.some((id) => selectedIds.has(id)) &&
    !allVisiblePendingSelected;

  // vẫn dùng indeterminate để hiển thị UI
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someVisiblePendingSelected;
    }
  }, [someVisiblePendingSelected]);

  // NHƯNG trạng thái "checked" của header lấy từ headerChecked, không dựa vào allVisiblePendingSelected

  const toggleHeaderSelect = (checked) => {
    setHeaderChecked(checked); // <-- nhớ trạng thái header checkbox
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        // chọn tất cả đơn CHỜ XÁC NHẬN đang hiển thị
        visiblePendingIds.forEach((id) => next.add(id));
      } else {
        // bỏ chọn các đơn CHỜ XÁC NHẬN đang hiển thị
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
    // KHÔNG setHeaderChecked ở đây -> tick lẻ không unlock bulk
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
      // reset custom nếu rời khỏi custom
      if (range !== "custom") {
        setCustomDateStart("");
        setCustomDateEnd("");
      }
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
    }).format(amount);

  const getStatusLabel = (status) => {
    const statusMap = {
      pending: "Chờ xác nhận",
      processing: "Đang xử lý",
      shipping: "Đang vận chuyển",
      delivered: "Đã giao hàng",
      cancelled: "Đã hủy",
    };
    return statusMap[status] || status;
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

      {/* BỘ LỌC & TÌM KIẾM */}
      <div className="order-mgmt-section orders-filter">
        <div className="filter-row">
          <div className="id-box">
            <div className="select-like">
              <span>Mã đơn hàng</span>
              <span className="chev">▾</span>
            </div>
            <input
              className="q-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nhập tối đa 20 mã đơn hàng (cách nhau bằng dấu ;)"
            />
          </div>

          <div className="date-select">
            <button
              className="date-btn"
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              Ngày đặt hàng
              <span className="dropdown-arrow">▾</span>
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

            {/* Tag Ngày đặt hàng (chỉ hiển thị khi KHÔNG phải "Toàn thời gian") */}
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

            {/* Tag lọc khác */}
            {hasActiveFilters && (
              <div className="active-filters">
                {activeFilters.labels.map((label) => (
                  <span key={label} className="filter-tag">
                    {label}
                    <button
                      onClick={() =>
                        setActiveFilters((prev) => ({
                          ...prev,
                          labels: prev.labels.filter((l) => l !== label),
                        }))
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
                {activeFilters.deadlines.map((deadline) => (
                  <span key={deadline} className="filter-tag">
                    {deadline}
                    <button
                      onClick={() =>
                        setActiveFilters((prev) => ({
                          ...prev,
                          deadlines: prev.deadlines.filter(
                            (d) => d !== deadline
                          ),
                        }))
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Chỉ hiện "Xóa tất cả" khi có lọc đang áp dụng */}
            {showClearAll && (
              <button className="clear-filter" onClick={handleClearAllFilters}>
                Xóa tất cả
              </button>
            )}
          </div>
        </div>

        <div className="order-summary">
          <div className="summary-item">
            <span className="label">Đơn hàng:</span>
            <span className="count">{filteredOrders.length}</span>
          </div>
          <div className="summary-actions">
            <button className="order-mgmt-btn ghost">Xuất đơn hàng</button>

            {/* Nút Xác nhận hàng loạt */}
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
                <th>
                  <div className="order-mgmt-th-content">
                    <div className="order-mgmt-th-text">
                      <span>Hạn xác nhận</span>
                    </div>
                  </div>
                </th>
                <th>
                  <div className="order-mgmt-th-content">
                    <div className="order-mgmt-th-text">
                      <span>Số lượng/</span>
                      <span>DT/GTĐH</span>
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
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-state">
                    <div className="no-data">
                      <div className="no-data-text">Không có đơn hàng nào</div>
                      <div className="no-data-subtitle">
                        Các đơn hàng sẽ hiển thị tại đây khi có
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isChecked = selectedIds.has(order.id);
                  const canConfirmThis =
                    order.status === "pending" && isChecked;

                  return (
                    <tr
                      key={order.id}
                      className={`order-row ${
                        order.isOverdue ? "overdue-row" : ""
                      }`}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={isChecked}
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
                      <td>
                        {order.confirmDeadline && (
                          <div
                            className={`deadline ${
                              order.isOverdue
                                ? "overdue"
                                : order.isNearDeadline
                                ? "near-deadline"
                                : ""
                            }`}
                          >
                            <span className="deadline-icon">
                              {order.isOverdue
                                ? "🚨"
                                : order.isNearDeadline
                                ? "⚠️"
                                : "⏰"}
                            </span>
                            {formatDate(order.confirmDeadline.split(" ")[0])}{" "}
                            {order.confirmDeadline.split(" ")[1]}
                          </div>
                        )}
                        {order.confirmDate && (
                          <div className="confirm-date">
                            Đã xác nhận:{" "}
                            {formatDate(order.confirmDate.split(" ")[0])}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="quantity-revenue">
                          <div className="quantity-item">
                            SL: {order.quantity}
                          </div>
                          <div className="revenue-item">
                            DT: {formatCurrency(order.revenue)}
                          </div>
                          <div className="value-item">
                            GTĐH: {formatCurrency(order.orderValue)}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="receive-order">
                          <span className="receive-status">Đã nhận</span>
                        </div>
                      </td>
                      <td className="action-cell">
                        <div className="action-buttons-cell">
                          <button
                            className="action-btn primary"
                            onClick={() =>
                              alert(`Xem chi tiết đơn hàng ${order.id}`)
                            }
                          >
                            Xem chi tiết
                          </button>

                          {/* Chỉ hiện khi chọn riêng đơn đang chờ */}
                          {canConfirmThis && (
                            <button
                              className="action-btn secondary"
                              onClick={() =>
                                alert(`Xem & xác nhận đơn ${order.id}`)
                              }
                            >
                              Xem & xác nhận
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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
                onApply={handleApplyFilters}
                onClose={() => setShowFilterSidebar(false)}
              />
            </div>
          </div>
        </>
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

  const handleApply = () => {
    onApply(tempFilters);
  };

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
