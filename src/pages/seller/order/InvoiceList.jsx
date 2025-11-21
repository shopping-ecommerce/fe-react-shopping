"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import "../../../styles/InvoiceList.css";
/* Dùng lại style bộ lọc ngày giống OrderManagement */
import "../../../styles/OrderManagement.css";

import { AuthContext } from "../../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../../config/api";

/* Các trạng thái đơn được phép xuất hóa đơn */
const INVOICE_ELIGIBLE_STATUSES = ["CONFIRMED", "SHIPPED", "DELIVERED"];

const isInvoiceOrder = (status) =>
  INVOICE_ELIGIBLE_STATUSES.includes(String(status).toUpperCase());

/* ===== Helpers chuẩn hoá options (biến thể) ===== */
const normalizeKey = (k) => String(k || "").trim().toLowerCase();

/** Trả về map { "Màu sắc": "...", "Kích cỡ": "...", ... } từ nhiều dạng structure khác nhau */
const buildOptionsMap = (raw) => {
  const out = {};

  // object { key: value }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, vRaw] of Object.entries(raw)) {
      const v = String(vRaw ?? "").trim();
      if (!v || v.toUpperCase() === "FREE") continue;
      const kk = normalizeKey(k);
      if (["size", "kích cỡ", "kích thước"].includes(kk)) out["Kích cỡ"] = v;
      else if (["màu sắc", "màu", "color", "colour"].includes(kk))
        out["Màu sắc"] = v;
      else out[k] = v;
    }
    return out;
  }

  // array {optionKey, optionValue} | {key,value} | {name,value}
  if (Array.isArray(raw)) {
    for (const o of raw) {
      const k =
        o?.optionKey ??
        o?.key ??
        o?.name ??
        o?.label ??
        o?.option_name ??
        o?.optionName;
      const v =
        o?.optionValue ??
        o?.value ??
        o?.selected ??
        o?.option_value ??
        o?.optionValue;
      const vv = String(v ?? "").trim();
      if (!k || !vv || vv.toUpperCase() === "FREE") continue;
      const kk = normalizeKey(k);
      if (["size", "kích cỡ", "kích thước"].includes(kk)) out["Kích cỡ"] = vv;
      else if (["màu sắc", "màu", "color", "colour"].includes(kk))
        out["Màu sắc"] = vv;
      else out[k] = vv;
    }
    return out;
  }

  return out;
};

const optionsToText = (optsMap) => {
  const entries = Object.entries(optsMap || {});
  if (!entries.length) return "";
  return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
};

/* Map order -> invoice UI */
const mapOrderToInvoice = (o) => {
  const items = Array.isArray(o.orderItems) ? o.orderItems : [];
  const totalAmount =
    (o.totalAmount ?? null) != null
      ? Number(o.totalAmount)
      : Number(o.subtotal ?? 0) -
        Number(o.discountAmount ?? 0) +
        Number(o.shippingFee ?? 0);

  return {
    id: o.id,
    status: o.status, // giữ lại trạng thái đơn
    customerName: o.recipientName || "",
    customerPhone: o.phoneNumber || "",
    orderDate: o.createdTime || "",
    totalAmount,
    items: items.map((it) => {
      // cố gắng đọc nhiều nguồn: it.options | it.orderItemOptions | it.itemOptions
      const rawOptions =
        it?.options ?? it?.orderItemOptions ?? it?.itemOptions;
      const optsMap = buildOptionsMap(rawOptions);
      const variantText =
        optionsToText(optsMap) || (it.size ? `Kích cỡ: ${it.size}` : ""); // fallback nếu BE cũ còn trả size
      return {
        name: it.productName,
        quantity: Number(it.quantity || 0),
        price: Number(it.unitPrice || 0),
        image: it.productImage || "",
        variantText, // dùng để hiển thị
      };
    }),
    shippingAddress: o.shippingAddress || "",
    paymentStatus: o.paymentStatus || "", // là "phương thức" theo enum BE
    _raw: o,
  };
};

/* Map phương thức thanh toán (đúng enum BE) -> label hiển thị */
const paymentInfo = (method) => {
  const s = String(method || "").toUpperCase();
  switch (s) {
    case "CASH_ON_DELIVERY":
    case "COD":
      return { label: "Thanh toán khi nhận (COD)", icon: "💵" };
    case "BANK_TRANSFER":
      return { label: "Chuyển khoản ngân hàng", icon: "🏦" };
    case "CREDIT_CARD":
      return { label: "Thẻ tín dụng", icon: "💳" };
    case "DEBIT_CARD":
      return { label: "Thẻ ghi nợ", icon: "💳" };
    case "DIGITAL_WALLET":
      return { label: "Ví điện tử", icon: "📱" };
    default:
      return { label: "Không xác định", icon: "ℹ️" };
  }
};

/* Map status order -> label hiển thị */
const orderStatusLabel = (status) => {
  const s = String(status || "").toUpperCase();
  switch (s) {
    case "CONFIRMED":
      return "Đã xác nhận";
    case "SHIPPED":
      return "Đang vận chuyển";
    case "DELIVERED":
      return "Đã giao hàng";
    case "PENDING":
      return "Chờ xác nhận";
    case "CANCELLED":
      return "Đã hủy";
    default:
      return "Không xác định";
  }
};

const orderStatusKey = (status) =>
  String(status || "").toLowerCase().replace(/[^a-z0-9]+/g, "-") || "unknown";

export default function InvoiceList() {
  const { authFetch } = useContext(AuthContext) || {};

  // Seller resolve
  const [sellerId, setSellerId] = useState("");
  const [resolvingSeller, setResolvingSeller] = useState(false);
  const [sellerErr, setSellerErr] = useState("");

  // Data
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);

  // Phân trang
  const [page, setPage] = useState(0); // 0-based
  const [size, setSize] = useState(10);

  // ====== Chỉ giữ LỌC THEO NGÀY ======
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState("all");
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");

  const dateRangeOptions = [
    { key: "today", label: "Hôm nay" },
    { key: "7days", label: "7 ngày qua" },
    { key: "30days", label: "30 ngày qua" },
    { key: "all", label: "Toàn thời gian" },
    { key: "custom", label: "Tuỳ chỉnh" },
  ];

  // Resolve sellerId
  useEffect(() => {
    if (!authFetch) return;
    let cancelled = false;
    (async () => {
      try {
        setResolvingSeller(true);
        setSellerErr("");

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
        if (!userId) throw new Error("Không lấy được userId.");

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
        const sid = dataSeller?.result?.id || dataSeller?.result?.sellerId;
        if (!sid) throw new Error("Chưa có sellerId.");

        if (!cancelled) setSellerId(sid);
      } catch (e) {
        if (!cancelled)
          setSellerErr(e?.message || "Không xác định được sellerId.");
      } finally {
        if (!cancelled) setResolvingSeller(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // Fetch orders -> invoices (CONFIRMED, SHIPPED, DELIVERED đều được)
  useEffect(() => {
    if (!authFetch || !sellerId) return;
    let stop = false;
    (async () => {
      try {
        const res = await authFetch(
          apiUrl(API_CONFIG.endpoints.ordersBySeller(sellerId)),
          {
            method: "GET",
            headers: { Accept: "application/json" },
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data?.message || `HTTP ${res.status}`);

        const list = Array.isArray(data?.result) ? data.result : [];
        const eligible = list
          .filter((o) => isInvoiceOrder(o.status))
          .map(mapOrderToInvoice);

        if (!stop) {
          setInvoices(eligible);
          setFilteredInvoices(eligible);
          setPage(0); // reset page khi load lại
        }
      } catch (e) {
        if (!stop) {
          setInvoices([]);
          setFilteredInvoices([]);
          console.error("Load invoices failed:", e);
        }
      }
    })();
    return () => {
      stop = true;
    };
  }, [authFetch, sellerId]);

  // ====== Date utils ======
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
    dateString ? new Date(dateString).toLocaleDateString("vi-VN") : "";
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
    return null;
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

  // ====== Filter only by date ======
  const filtered = useMemo(() => {
    let data = invoices;
    const rng = getSelectedRange();
    if (rng) {
      const fromTime = rng.from.getTime();
      const toTime = rng.to.getTime();
      data = data.filter((inv) => {
        const t = new Date(inv.orderDate).setHours(0, 0, 0, 0);
        return t >= fromTime && t <= toTime;
      });
    }
    return data;
  }, [invoices, selectedDateRange, customDateStart, customDateEnd]);

  useEffect(() => {
    setFilteredInvoices(filtered);
    setPage(0); // đổi filter thì quay về trang 1
  }, [filtered]);

  const handleDateRangeSelect = (range) => {
    setSelectedDateRange(range);
    if (range !== "custom") setShowDatePicker(false);
  };
  const handleClearAllFilters = () => {
    setSelectedDateRange("all");
    setCustomDateStart("");
    setCustomDateEnd("");
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(Math.round(Number(amount || 0)));

  // ====== Phân trang (client-side, dùng filteredInvoices) ======
  const totalPages = useMemo(
    () =>
      filteredInvoices.length === 0
        ? 1
        : Math.max(1, Math.ceil(filteredInvoices.length / size)),
    [filteredInvoices.length, size]
  );

  // đảm bảo page không vượt totalPages khi dữ liệu thay đổi
  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(totalPages - 1);
    }
  }, [page, totalPages]);

  const pagedInvoices = useMemo(() => {
    if (!filteredInvoices.length) return [];
    const start = page * size;
    return filteredInvoices.slice(start, start + size);
  }, [filteredInvoices, page, size]);

  const handleJumpPage = (val) => {
    const n = Number(val);
    if (!n || n < 1) return;
    const max = totalPages;
    const target = Math.min(max, Math.max(1, n)); // 1..max
    setPage(target - 1);
  };

  const exportInvoices = (list = filteredInvoices) => {
    const win = window.open("", "_blank");
    if (!win) return;
    const html = `
      <html><head><meta charset="utf-8" />
      <title>Hóa đơn</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color:#111; }
        .inv { border:1px solid #ddd; border-radius:10px; padding:16px 18px; margin-bottom:18px; }
        .inv h3 { margin:0 0 10px 0; font-size:18px; }
        .meta { font-size:13px; color:#444; margin-bottom:8px; }
        .items { width:100%; border-collapse: collapse; margin-top:8px; }
        .items th, .items td { border:1px solid #e5e7eb; padding:8px 10px; font-size:13px; }
        .right { text-align:right; }
        .total { margin-top:8px; font-weight:800; text-align:right; }
        .pay { margin-top:4px; font-size:13px; color:#374151; }
        .badge { background:#d1ecf1; color:#0c5460; padding:2px 8px; border-radius:999px; font-size:11px; }
        @page { size: A4; margin: 16mm; }
      </style></head>
      <body>
        ${list
          .map((inv) => {
            const pay = paymentInfo(inv.paymentStatus);
            const stLabel = orderStatusLabel(inv.status);
            return `
            <div class="inv">
              <h3>Hóa đơn #${inv.id} <span class="badge">${stLabel}</span></h3>
              <div class="meta">
                <div><b>Khách hàng:</b> ${inv.customerName}</div>
                ${inv.customerPhone ? `<div><b>SĐT:</b> ${inv.customerPhone}</div>` : ""}
                ${inv.shippingAddress ? `<div><b>Địa chỉ:</b> ${inv.shippingAddress}</div>` : ""}
                <div><b>Ngày đặt:</b> ${new Date(inv.orderDate).toLocaleDateString("vi-VN")}</div>
              </div>
              <table class="items">
                <thead><tr><th style="width:50%">Sản phẩm</th><th>SL</th><th class="right">Đơn giá</th><th class="right">Thành tiền</th></tr></thead>
                <tbody>
                  ${inv.items
                    .map(
                      (it) => `
                    <tr>
                      <td>${it.name}${it.variantText ? ` (${it.variantText})` : ""}</td>
                      <td class="right">${it.quantity}</td>
                      <td class="right">${Math.round(it.price).toLocaleString("vi-VN")}₫</td>
                      <td class="right">${Math.round(it.price * it.quantity).toLocaleString("vi-VN")}₫</td>
                    </tr>`
                    )
                    .join("")}
                </tbody>
              </table>
              <div class="total">Tổng cộng: ${Math.round(inv.totalAmount).toLocaleString("vi-VN")}₫</div>
              <div class="pay">Phương thức thanh toán: ${pay.icon} ${pay.label}</div>
            </div>`;
          })
          .join("")}
        <script>window.onload = () => window.print();</script>
      </body></html>`;
    win.document.write(html);
    win.document.close();
  };

  // CSV UTF-8 có BOM (Excel không lỗi font)
  const exportExcel = () => {
    const rows = [
      ["Mã đơn", "Khách hàng", "SĐT", "Ngày đặt", "Tổng tiền (VND)", "Thanh toán"],
      ...filteredInvoices.map((inv) => {
        const pay = paymentInfo(inv.paymentStatus).label;
        const idTxt = `\t${inv.id}`;
        const nameTxt = inv.customerName || "";
        const phoneTxt = inv.customerPhone ? `\t${inv.customerPhone}` : "";
        const dateTxt = inv.orderDate
          ? `\t${new Date(inv.orderDate).toLocaleDateString("vi-VN")}`
          : "";
        const amountNum = Math.round(inv.totalAmount || 0);
        return [idTxt, nameTxt, phoneTxt, dateTxt, amountNum, pay];
      }),
    ];
    const csv = rows
      .map((r) =>
        r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\r\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    a.href = url;
    a.download = `invoices_${now.getFullYear()}${pad(
      now.getMonth() + 1
    )}${pad(now.getDate())}_${pad(now.getHours())}${pad(
      now.getMinutes()
    )}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="invoice-list-container">
      <div className="invoice-header">
        <h1>Quản lý hóa đơn</h1>
        <div className="header-actions">
          <button className="btn-export" onClick={exportExcel}>
            Xuất Excel
          </button>
          <button
            className="btn-export-invoice"
            onClick={() => exportInvoices()}
          >
            Xuất hóa đơn
          </button>
        </div>
      </div>

      {/* Thông báo seller */}
      {!sellerId && (
        <div className="order-mgmt-section">
          {resolvingSeller ? (
            <div className="om-note">🔎 Đang xác định Seller ID…</div>
          ) : sellerErr ? (
            <div className="om-note om-warn">⚠️ {sellerErr}</div>
          ) : null}
        </div>
      )}

      {/* CHỈ CÒN BỘ LỌC NGÀY */}
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
        </div>
      </div>

      {/* Tag + Clear chỉ cho ngày */}
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
                  onClick={handleClearAllFilters}
                  title="Bỏ lọc ngày"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>

        <div className="order-summary">
          <div className="summary-item">
            <span className="label">Hóa đơn:</span>
            <span className="count">{filteredInvoices.length}</span>
          </div>
        </div>
      </div>

      {/* BẢNG */}
      <div className="invoice-table">
        <div className="table-header">
          <div className="col-invoice-id">Mã đơn</div>
          <div className="col-customer">Khách hàng</div>
          <div className="col-date">Ngày đặt</div>
          <div className="col-amount">Tổng tiền</div>
          <div className="col-status">Trạng thái</div>
          <div className="col-actions">Thao tác</div>
        </div>

        <div className="table-body">
          {pagedInvoices.map((inv) => (
            <div key={inv.id} className="table-row">
              <div className="col-invoice-id">
                <strong>{inv.id}</strong>
              </div>
              <div className="col-customer">
                <div className="customer-name-full">
                  {inv.customerName}
                </div>
              </div>
              <div className="col-date">{formatDate(inv.orderDate)}</div>
              <div className="col-amount">
                <strong>{formatCurrency(inv.totalAmount)}</strong>
              </div>
              <div className="col-status">
                <span
                  className={`status-badge status-${orderStatusKey(
                    inv.status
                  )}`}
                >
                  {orderStatusLabel(inv.status)}
                </span>
              </div>
              <div className="col-actions">
                <button
                  className="btn-icon"
                  title="Xem chi tiết"
                  onClick={() => exportInvoices([inv])}
                  aria-label="In"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path
                      fill="currentColor"
                      d="M6 7V3h12v4H6zm12 2H6c-1.66 0-3 1.34-3 3v5h4v4h10v-4h4v-5c0-1.66-1.34-3-3-3zm-3 10H9v-5h6v5z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {filteredInvoices.length === 0 && (
        <div className="empty-state">
          <p>Không có hóa đơn nào</p>
        </div>
      )}

      {/* PHÂN TRANG – dùng class "order-pg-*" để đồng bộ với các trang khác */}
      <div className="order-mgmt-section">
        <div className="order-pager">
          <div className="order-pg-group">
            <button
              className="order-pg-btn"
              disabled={page <= 0 || filteredInvoices.length === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ← Trước
            </button>

            <div className="order-pg-status">
              <span>Trang</span>
              <input
                className="order-page-input"
                type="number"
                min={1}
                max={totalPages}
                value={filteredInvoices.length === 0 ? 0 : page + 1}
                onChange={(e) => handleJumpPage(e.target.value)}
                disabled={filteredInvoices.length === 0}
              />
              <span>/ {totalPages}</span>
            </div>

            <button
              className="order-pg-btn"
              disabled={
                page >= totalPages - 1 || filteredInvoices.length === 0
              }
              onClick={() =>
                setPage((p) =>
                  p < totalPages - 1 ? p + 1 : p
                )
              }
            >
              Sau →
            </button>
          </div>

          <div className="order-pg-size">
            <label className="order-size-label">Trang</label>
            <select
              className="order-size-select"
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value) || 10);
                setPage(0);
              }}
              disabled={filteredInvoices.length === 0}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
