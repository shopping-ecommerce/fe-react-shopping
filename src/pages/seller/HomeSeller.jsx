// src/pages/seller/HomeSeller.jsx
"use client";

import React, { useEffect, useMemo, useRef, useState, useContext } from "react";
import "../../styles/SellerHome.css";
/* ✅ Dùng lại toàn bộ class .be-* từ trang thống kê */
import "../../styles/BusinessEfficiency.css";

import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../config/api";

/* ⬇️ Lấy API để đếm đơn theo trạng thái */
import { fetchOrdersBySeller } from "../../services/sellerOrders";

/* ===== utils ngắn gọn ===== */
const vnCurrency = (n) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(+n) ? +n : 0);
const pct = (v) => `${Number(v || 0).toFixed(1)}%`;
const ddMM = (d) =>
  new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });
const last7d = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 6);
  return {
    startDate: from.toISOString().slice(0, 10),
    endDate: to.toISOString().slice(0, 10),
  };
};
const buildOrderStatsUrl = (sellerId, { startDate, endDate }) =>
  apiUrl(
    `/order/order-statistics/seller/${encodeURIComponent(
      sellerId
    )}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(
      endDate
    )}`
  );

/* Map status BE -> key UI để đếm nhanh bốn trạng thái cần hiển thị */
const BE_TO_UI_STATUS = {
  PENDING: "pending",
  CONFIRMED: "processing",
  SHIPPED: "shipping",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

export default function HomeSeller() {
  const navigate = useNavigate();

  // Điểm đến dùng chung cho “Địa chỉ kho hàng” và CTA “Thêm kho hàng”
  const PROFILE_STORE_INFO_PATH = "/seller/profile#warehouse";

  // ----- Steps (cards) -----
  const steps = useMemo(
    () => [
      {
        title: "Tài khoản & thông tin cửa hàng",
        status: "Hoàn thành!",
        done: true,
        go: "/seller/profile",
      },
      {
        title: "Địa chỉ kho hàng",
        status: "Vui lòng cung cấp địa chỉ kho lấy và trả hàng",
        done: false,
        highlight: true,
        go: PROFILE_STORE_INFO_PATH,
      },
      {
        title: "Giấy tờ pháp lý",
        status: "Hoàn thành!",
        done: true,
        disabled: true,
      },
      { title: "Kích hoạt hồ sơ", status: "Hoàn thành!", done: true },
      {
        title: "Tài khoản ngân hàng",
        status: "",
        done: false,
        go: "/seller/bank-account",
      },
    ],
    []
  );

  // ----- Slides / banner -----
  const slides = useMemo(
    () => [
      {
        id: "warehouse",
        tag: "Cung cấp",
        h1: "Địa chỉ kho lấy và",
        h2: "trả hàng",
        sub: "Vui lòng điền địa chỉ kho của bạn để tránh gây chậm trễ trong quá trình lấy hàng!",
        cta: "Thêm kho hàng",
      },
      {
        id: "create",
        tag: "Tạo sản phẩm",
        h1: "Bán hàng ngay hôm nay!",
        h2: "",
        sub: "Cửa hàng của bạn đã sẵn sàng để nhận những đơn hàng đầu tiên! Hãy bắt đầu tạo sản phẩm nào!",
        cta: "Tạo sản phẩm",
      },
    ],
    []
  );

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);
  const next = () => setIdx((i) => (i + 1) % slides.length);
  const prev = () => setIdx((i) => (i - 1 + slides.length) % slides.length);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(next, 3000);
    return () => clearInterval(timerRef.current);
  }, [paused, slides.length]);

  const handleCTA = (slide) => {
    if (!slide) return;
    if (slide.id === "warehouse") {
      navigate(PROFILE_STORE_INFO_PATH);
      return;
    }
    if (slide.id === "create") {
      navigate("/seller/create-products");
      return;
    }
  };

  const handleClickStep = (step) => {
    if (!step || step.disabled) return;
    if (step.go) navigate(step.go);
  };

  /* ===========================
     (MỚI) Khối THỐNG KÊ dưới banner
     Tái dùng BusinessEfficiency.css — bố cục giống trang thống kê
  =========================== */
  const { authFetch, authReady, isAuthenticated } = useContext(AuthContext);
  const [sellerId, setSellerId] = useState("");
  const [stats, setStats] = useState(null);
  const [prevStats, setPrevStats] = useState(null);
  const [productNameMap, setProductNameMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const range = useMemo(() => last7d(), []);

  // ⬇️ NEW: Đếm bốn trạng thái đơn để show ngay dưới banner
  const [orderCounts, setOrderCounts] = useState({
    pending: 0,
    processing: 0,
    shipping: 0,
    delivered: 0,
  });

  // resolve sellerId
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      try {
        setErr("");
        if (!isAuthenticated) return;
        const r1 = await authFetch(
          apiUrl(API_CONFIG.endpoints.getMyProfile),
          { headers: { Accept: "application/json" } }
        );
        const j1 = await r1.json().catch(() => ({}));
        if (!r1.ok) throw new Error(j1?.message || `HTTP ${r1.status}`);
        const userId = j1?.result?.id;
        if (!userId) throw new Error("Không lấy được userId.");

        const r2 = await authFetch(
          apiUrl(API_CONFIG.endpoints.searchSellerByUserId(userId)),
          { headers: { Accept: "application/json" } }
        );
        const j2 = await r2.json().catch(() => ({}));
        if (!r2.ok) throw new Error(j2?.message || `HTTP ${r2.status}`);
        const sid = j2?.result?.id;
        if (!sid) throw new Error("Tài khoản chưa có sellerId.");
        if (!cancelled) setSellerId(sid);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không xác định được sellerId.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated, authFetch]);

  // ⬇️ NEW: fetch tất cả đơn để đếm 4 trạng thái
  useEffect(() => {
    if (!sellerId || !authFetch) return;
    let stop = false;
    (async () => {
      try {
        const raw = await fetchOrdersBySeller(authFetch, sellerId, null);
        if (stop) return;
        const cnt = { pending: 0, processing: 0, shipping: 0, delivered: 0 };
        for (const o of raw || []) {
          const key = BE_TO_UI_STATUS[o?.status];
          if (key && key in cnt) cnt[key] += 1;
        }
        setOrderCounts(cnt);
      } catch {
        // giữ nguyên 0 nếu lỗi
      }
    })();
    return () => { stop = true; };
  }, [sellerId, authFetch]);

  // fetch 7 ngày hiện tại + 7 ngày trước
  useEffect(() => {
    if (!sellerId) return;
    let cancelled = false;

    const prevRange = (() => {
      const d = new Date(range.startDate);
      d.setDate(d.getDate() - 1);
      const end = d.toISOString().slice(0, 10);
      const start = new Date(d);
      start.setDate(start.getDate() - 6);
      return { startDate: start.toISOString().slice(0, 10), endDate: end };
    })();

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const [rNow, rPrev] = await Promise.all([
          authFetch(buildOrderStatsUrl(sellerId, range), {
            headers: { Accept: "application/json" },
          }),
          authFetch(buildOrderStatsUrl(sellerId, prevRange), {
            headers: { Accept: "application/json" },
          }),
        ]);
        const [jNow, jPrev] = await Promise.all([
          rNow.json().catch(() => ({})),
          rPrev.json().catch(() => ({})),
        ]);

        if (!rNow.ok || jNow?.code !== 200)
          throw new Error(jNow?.message || `HTTP ${rNow.status}`);
        if (!rPrev.ok || jPrev?.code !== 200)
          throw new Error(jPrev?.message || `HTTP ${rPrev.status}`);

        if (cancelled) return;
        const cur = jNow?.result || null;
        const prv = jPrev?.result || null;
        setStats(cur);
        setPrevStats(prv);

        // map tên sản phẩm Top 5
        const ids = [
          ...new Set(
            (cur?.topProductSales || [])
              .slice(0, 5)
              .map((x) => x.productId)
              .filter(Boolean)
          ),
        ].filter((id) => !productNameMap[id]);
        if (ids.length) {
          const entries = await Promise.all(
            ids.map(async (id) => {
              try {
                const rs = await authFetch(
                  apiUrl(API_CONFIG.endpoints.productById(id)),
                  { headers: { Accept: "application/json" } }
                );
                const j = await rs.json().catch(() => ({}));
                return [id, j?.result?.name || id];
              } catch {
                return [id, id];
              }
            })
          );
          if (!cancelled)
            setProductNameMap((m) => ({ ...m, ...Object.fromEntries(entries) }));
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e.message || "Không tải được thống kê.");
          setStats(null);
          setPrevStats(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sellerId, range, authFetch]);

  // derive
  const revenueStats = stats?.revenueStats || {
    totalRevenue: 0,
    todayRevenue: 0,
    monthRevenue: 0,
    averageOrderValue: 0,
    revenueGrowthRate: 0,
  };
  const orderStats = stats?.orderCountStats || {
    totalOrders: 0,
    pendingOrders: 0,
    shippingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    completionRate: 0,
    cancellationRate: 0,
  };

  const chartData = useMemo(() => {
    const arr = Array.isArray(stats?.revenueChart) ? stats.revenueChart : [];
    return arr
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((x) => ({
        date: x.date,
        label: ddMM(x.date),
        revenue: Number(x.revenue || 0),
        orders: Number(x.orderCount || 0),
      }));
  }, [stats]);

  const allDays = useMemo(() => {
    if (!range.startDate || !range.endDate) return [];
    const out = [];
    const cur = new Date(range.startDate + "T00:00:00");
    const end = new Date(range.endDate + "T00:00:00");
    while (cur.getTime() <= end.getTime()) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [range]);

  const filledChartData = useMemo(() => {
    const map = new Map(chartData.map((d) => [d.date, d]));
    return allDays.map((d) => {
      const rec = map.get(d) || { revenue: 0, orders: 0 };
      return {
        date: d,
        label: ddMM(d),
        revenue: Number(rec.revenue || 0),
        orders: Number(rec.orders || 0),
      };
    });
  }, [chartData, allDays]);

  const maxRevenue = Math.max(1, ...filledChartData.map((d) => d.revenue));
  const xStep =
    filledChartData.length > 1 ? 760 / (filledChartData.length - 1) : 0;

  // Donut trạng thái đơn hàng (Hoàn tất/Hủy) giống trang thống kê
  const statusDonut = useMemo(() => {
    const completed = Number(orderStats.completedOrders ?? 0);
    const cancelled = Number(orderStats.cancelledOrders ?? 0);
    const items = [
      { name: "Hoàn tất", value: completed, color: "#22c55e" },
      { name: "Hủy", value: cancelled, color: "#ef4444" },
    ];
    const total = items.reduce((s, x) => s + x.value, 0);
    const safeItems =
      total === 0
        ? [
            {
              name: "Chưa có dữ liệu",
              value: 1,
              color: "#e5e7eb",
              pct: 100,
            },
          ]
        : items.map((it) => ({
            ...it,
            pct: Math.round((it.value * 100) / total),
          }));
    return { total, items: safeItems };
  }, [orderStats]);

  // Top 5 sản phẩm
  const topProducts = useMemo(() => {
    const now = Array.isArray(stats?.topProductSales) ? stats.topProductSales : [];
    const prev = Array.isArray(prevStats?.topProductSales)
      ? prevStats.topProductSales
      : [];
    const pm = new Map(prev.map((x) => [x.productId, x]));
    return now.slice(0, 5).map((x, i) => {
      const p = pm.get(x.productId);
      const cur = Number(x.totalSold || 0);
      const old = Number(p?.totalSold || 0);
      let g = 0;
      if (old === 0 && cur > 0) g = 100;
      else if (old > 0) g = ((cur - old) / old) * 100;
      return {
        rank: i + 1,
        id: x.productId,
        name: productNameMap[x.productId] || x.productId,
        revenue: Number(x.revenue || 0),
        orders: cur,
        growth: g,
      };
    });
  }, [stats, prevStats, productNameMap]);

  /* ===== render ===== */
  return (
    <div className="seller-home-container">
      {/* Header progress (GIỮ NGUYÊN) */}
      <div className="seller-progress">
        <h2>
          Hồ sơ nhà bán đã hoàn thành <span className="progress-badge">60%</span>
        </h2>
      </div>

      {/* Steps (GIỮ NGUYÊN) */}
      <div className="seller-steps">
        {steps.map((step, index) => (
          <div
            key={index}
            className={[
              "seller-step-card",
              step.highlight ? "highlight" : "",
              step.done ? "done" : "",
              step.go && !step.disabled ? "clickable" : "",
            ].join(" ")}
            onClick={() => handleClickStep(step)}
            role={step.go && !step.disabled ? "button" : undefined}
            tabIndex={step.go && !step.disabled ? 0 : undefined}
            aria-disabled={step.disabled ? true : undefined}
            onKeyDown={(e) => {
              if (step.disabled) return;
              if ((e.key === "Enter" || e.key === " ") && step.go) {
                e.preventDefault();
                navigate(step.go);
              }
            }}
            title={step.disabled ? undefined : step.title}
          >
            <div className="icon-circle">{step.done ? "✔" : "🏛"}</div>
            <h4>{step.title}</h4>
            <p className="status-text">{step.status}</p>
          </div>
        ))}
      </div>

      {/* Carousel banner (GIỮ NGUYÊN) */}
      <div
        className="seller-carousel"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <button className="sc-arrow sc-arrow--left" onClick={prev} aria-label="Trước">
          ‹
        </button>

        <div className="sc-viewport">
          <div className="sc-track" style={{ transform: `translateX(-${idx * 100}%)` }}>
            {slides.map((s) => (
              <div key={s.id} className={`sc-slide sc-${s.id}`}>
                <div className="sc-art" aria-hidden />
                <div className="sc-content">
                  <div className="sc-left">
                    <div className="sc-tag">{s.tag}</div>
                    <h3 className="sc-headline">
                      <span className="line1">{s.h1}</span>
                      {s.h2 && <span className="line2">{s.h2}</span>}
                    </h3>
                  </div>
                  <div className="sc-right">
                    <p className="sc-sub">{s.sub}</p>
                    <button className="sc-cta" onClick={() => handleCTA(s)}>
                      {s.cta}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button className="sc-arrow sc-arrow--right" onClick={next} aria-label="Tiếp">
          ›
        </button>

        <div className="sc-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={`dot ${i === idx ? "active" : ""}`}
              onClick={() => setIdx(i)}
              aria-label={`Tới slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* ✅ TỔNG QUAN ĐƠN HÀNG — 4 trạng thái ngay dưới banner */}
      <div className="be-wrap be-light" style={{ paddingTop: 12, paddingBottom: 0 }}>
        <div className="be-section-sep" style={{ marginTop: 0 }}>
          <span className="sep-dot sep-blue" />
          <span>Tổng quan đơn hàng</span>
        </div>

        <div className="be-grid" style={{ marginBottom: 8 }}>
          {/* Chờ xác nhận */}
          <button
            type="button"
            onClick={() => navigate("/seller/orders")}
            className="be-card kpi kpi-amber lift"
            style={{ textAlign: "left", cursor: "pointer" }}
            aria-label="Xem đơn Chờ xác nhận"
          >
            <div className="be-card__title">Chờ xác nhận</div>
            <div className="be-card__value">{orderCounts.pending.toLocaleString("vi-VN")}</div>
            <div className="be-subline">Nhấp để xem chi tiết</div>
          </button>

          {/* Đã xác nhận */}
          <button
            type="button"
            onClick={() => navigate("/seller/orders")}
            className="be-card kpi kpi-violet lift"
            style={{ textAlign: "left", cursor: "pointer" }}
            aria-label="Xem đơn Đã xác nhận"
          >
            <div className="be-card__title">Đã xác nhận</div>
            <div className="be-card__value">{orderCounts.processing.toLocaleString("vi-VN")}</div>
            <div className="be-subline">Nhấp để xem chi tiết</div>
          </button>

          {/* Đang vận chuyển */}
          <button
            type="button"
            onClick={() => navigate("/seller/orders")}
            className="be-card kpi kpi-sky lift"
            style={{ textAlign: "left", cursor: "pointer" }}
            aria-label="Xem đơn Đang vận chuyển"
          >
            <div className="be-card__title">Đang vận chuyển</div>
            <div className="be-card__value">{orderCounts.shipping.toLocaleString("vi-VN")}</div>
            <div className="be-subline">Nhấp để xem chi tiết</div>
          </button>

          {/* Đã giao hàng */}
          <button
            type="button"
            onClick={() => navigate("/seller/orders")}
            className="be-card kpi kpi-indigo lift"
            style={{ textAlign: "left", cursor: "pointer" }}
            aria-label="Xem đơn Đã giao hàng"
          >
            <div className="be-card__title">Đã giao hàng</div>
            <div className="be-card__value">{orderCounts.delivered.toLocaleString("vi-VN")}</div>
            <div className="be-subline">Nhấp để xem chi tiết</div>
          </button>
        </div>
      </div>
      {/* /4 trạng thái */}


      {/* ===========================
          THỐNG KÊ — bố cục & class giống BusinessEfficiency.jsx
      =========================== */}
      <div className={`be-wrap be-light`} style={{ paddingTop: 16 }}>
        {/* Bộ lọc / tiêu đề giống trang thống kê */}
        <div className="be-head fade-in" style={{ marginTop: 8 }}>
          <div className="be-efficiency-breadcrumb">
            <span className="be-crumb-link">Trang chủ</span>
          </div>
          <h1>Thống kê bán hàng (7 ngày gần nhất)</h1>
        </div>

        {err && <div className="be-alert be-alert--error">{err}</div>}

        {/* Trạng thái lọc */}
        <div className="be-panel be-filter-status lift">
          <div className="be-panel__head">
            <h2>
              Trạng thái lọc: Từ ngày {range.startDate} đến {range.endDate}
            </h2>
          </div>
        </div>

        {/* KPI theo kỳ — dùng .be-card.kpi với theme như trang thống kê */}
        <div className="be-grid">
          {/* Tổng doanh thu (trong kỳ) – SKY */}
          <div className={`be-card kpi kpi-sky lift ${loading ? "is-skeleton" : ""}`}>
            <div className="be-card__title">Tổng doanh thu (trong kỳ)</div>
            <div className="be-card__value">
              {vnCurrency(
                filledChartData.reduce((s, x) => s + (x.revenue || 0), 0)
              )}
            </div>
            <div className="be-subline">
              Hôm nay: {vnCurrency(revenueStats.todayRevenue)} • Tháng này:{" "}
              {vnCurrency(revenueStats.monthRevenue)}
            </div>
          </div>

          {/* Tổng đơn (trong kỳ) – ROSE */}
          <div className={`be-card kpi kpi-rose lift ${loading ? "is-skeleton" : ""}`}>
            <div className="be-card__title">Tổng đơn (trong kỳ)</div>
            <div className="be-card__value">
              {filledChartData
                .reduce((s, x) => s + (x.orders || 0), 0)
                .toLocaleString("vi-VN")}
            </div>
            <div className="be-subline">
              Hoàn tất: {orderStats.completedOrders ?? 0} • Hủy:{" "}
              {orderStats.cancelledOrders ?? 0}
            </div>
          </div>

          {/* Giá trị TB/đơn – AMBER */}
          <div className={`be-card kpi kpi-amber lift ${loading ? "is-skeleton" : ""}`}>
            <div className="be-card__title">Giá trị TB/đơn</div>
            <div className="be-card__value">
              {vnCurrency(revenueStats.averageOrderValue)}
            </div>
            <div className="be-subline">
              Tỷ lệ hoàn tất: {pct(orderStats.completionRate || 0)}
            </div>
          </div>

          {/* Tăng trưởng doanh thu – VIOLET */}
          <div className={`be-card kpi kpi-violet lift ${loading ? "is-skeleton" : ""}`}>
            <div className="be-card__title">Tăng trưởng doanh thu</div>
            <div className="be-card__value">
              {pct(revenueStats.revenueGrowthRate || 0)}
            </div>
            <div className="be-subline">
              Tỷ lệ hủy: {pct(orderStats.cancellationRate || 0)}
            </div>
          </div>
        </div>

        {/* Biểu đồ theo ngày — giống trang thống kê (SVG thu gọn) */}
        <div className={`be-panel lift ${loading ? "is-skeleton" : ""}`}>
          <div className="be-panel__head">
            <h2>Biểu đồ theo ngày</h2>
            <div className="be-note">
              Khoảng áp dụng: {range.startDate} → {range.endDate}
            </div>
          </div>

          <div className="be-chart">
            <svg viewBox="0 0 820 340" className="be-chart-svg">
              {(() => {
                const w = 760;
                const h = 260;
                const left = 40;
                const top = 40;
                const bottom = 300;
                const stepX =
                  filledChartData.length > 1
                    ? w / (filledChartData.length - 1)
                    : 0;
                const maxRev = Math.max(
                  1,
                  ...filledChartData.map((d) => d.revenue)
                );

                const labelsX = filledChartData.map((d, i) => {
                  const x = left + i * stepX;
                  const show =
                    filledChartData.length <= 8 ||
                    i % Math.ceil(filledChartData.length / 8) === 0 ||
                    i === filledChartData.length - 1;
                  return { x, show, text: d.label };
                });

                const points = filledChartData
                  .map((d, i) => {
                    const x = left + i * stepX;
                    const y = bottom - (d.revenue / maxRev) * h;
                    return `${x},${y}`;
                  })
                  .join(" ");

                return (
                  <>
                    {labelsX.map((l, i) => (
                      <line
                        key={`g-${i}`}
                        x1={l.x}
                        y1={top}
                        x2={l.x}
                        y2={bottom}
                        stroke="#eef2f7"
                        strokeWidth="1"
                        opacity={l.show ? 1 : 0.4}
                      />
                    ))}

                    {[0.0, 0.25, 0.5, 0.75, 1.0].map((t, idx) => {
                      const y = bottom - t * h;
                      const val = Math.round(maxRev * t);
                      return (
                        <g key={`y-${idx}`}>
                          <line
                            x1={left}
                            y1={y}
                            x2={left + w}
                            y2={y}
                            stroke="#f5f7fb"
                            strokeWidth="1"
                          />
                          <text x={5} y={y - 4} fontSize="10" fill="#6b7280">
                            {vnCurrency(val)}
                          </text>
                        </g>
                      );
                    })}

                    <polyline
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                      points={points}
                    />

                    {filledChartData.map((d, i) => {
                      const x = left + i * stepX;
                      const y = bottom - (d.revenue / maxRev) * h;
                      return (
                        <circle
                          key={`p-${i}`}
                          cx={x}
                          cy={y}
                          r="3.5"
                          fill="#2563eb"
                        >
                          <title>{`${d.label}: Doanh thu ${vnCurrency(
                            d.revenue
                          )} • ${d.orders} đơn`}</title>
                        </circle>
                      );
                    })}

                    {labelsX.map((l, i) => (
                      <text
                        key={`xl-${i}`}
                        x={l.x}
                        y={330}
                        fontSize="11"
                        textAnchor="middle"
                        fill="#6b7280"
                      >
                        {l.show ? l.text : ""}
                      </text>
                    ))}
                  </>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* Donut trạng thái đơn hàng (trong kỳ) — giống BusinessEfficiency */}
        <div className={`be-panel lift ${loading ? "is-skeleton" : ""}`}>
          <div className="be-panel__head">
            <h2>Tỷ lệ trạng thái đơn hàng (trong kỳ)</h2>
            <div className="be-note">Hoàn tất vs Hủy</div>
          </div>

          <div className="be-flex-row">
            <svg
              viewBox="0 0 280 280"
              className="be-donut-svg"
              style={{ width: 280, height: 280 }}
            >
              {(() => {
                const cx = 140,
                  cy = 140,
                  r = 82,
                  t = 26;
                const C = 2 * Math.PI * r;
                let acc = 0;
                const items = statusDonut.items;
                const total =
                  items.reduce((s, x) => s + x.value, 0) || 1;

                return items.map((it, idx) => {
                  const len = (it.value / total) * C;
                  const dash = `${len} ${C - len}`;
                  const rot = (acc / C) * 360 - 90;
                  acc += len;
                  return (
                    <g
                      key={`st-${idx}`}
                      transform={`rotate(${rot}, ${cx}, ${cy})`}
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill="none"
                        stroke={it.color}
                        strokeWidth={t}
                        strokeDasharray={dash}
                      />
                    </g>
                  );
                });
              })()}
              <circle cx="140" cy="140" r="70" fill="#fff" />
              <text
                x="140"
                y="132"
                textAnchor="middle"
                fontSize="12"
                fill="#6b7280"
              >
                Tổng đơn
              </text>
              <text
                x="140"
                y="154"
                textAnchor="middle"
                fontSize="16"
                fontWeight="800"
                fill="#111827"
              >
                {statusDonut.total.toLocaleString("vi-VN")}
              </text>
            </svg>

            <div className="be-donut-legend">
              {statusDonut.items.map((it, idx) => (
                <div className="be-donut-row" key={`stlg-${idx}`}>
                  <span
                    className="be-donut-dot"
                    style={{ background: it.color }}
                  />
                  <div className="be-donut-name">{it.name}</div>
                  <div className="be-donut-pct">
                    {it.pct ??
                      Math.round(
                        (it.value * 100) / (statusDonut.total || 1)
                      )}
                    %
                  </div>
                  <div className="be-donut-val">
                    {(
                      it.name === "Chưa có dữ liệu" ? 0 : it.value
                    ).toLocaleString("vi-VN")}{" "}
                    đơn
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top 5 sản phẩm bán chạy — bảng giống trang thống kê */}
        <div className={`be-panel lift ${loading ? "is-skeleton" : ""}`}>
          <div className="be-panel__head">
            <h2>Top sản phẩm bán chạy</h2>
            <div className="be-note">Nguồn: API đơn hàng (7 ngày)</div>
          </div>
          <div className="be-table">
            <div className="be-thead">
              <div>#</div>
              <div>Tên</div>
              <div>Đã bán</div>
              <div>Doanh thu</div>
              <div>Tăng trưởng</div>
            </div>
            <div className="be-tbody">
              {loading ? (
                <div className="be-empty">Đang tải...</div>
              ) : topProducts.length ? (
                topProducts.map((p) => (
                  <div className="be-row hover-row" key={p.id}>
                    <div className="be-td">#{p.rank}</div>
                    <div
                      className="be-td be-td--name"
                      title={p.name}
                      style={{ fontWeight: 700 }}
                    >
                      {p.name}
                    </div>
                    <div className="be-td">
                      {(p.orders || 0).toLocaleString("vi-VN")}
                    </div>
                    <div className="be-td">{vnCurrency(p.revenue || 0)}</div>
                    <div
                      className="be-td"
                      style={{
                        fontWeight: 800,
                        color:
                          p.growth > 0
                            ? "#16a34a"
                            : p.growth < 0
                            ? "#dc2626"
                            : "#374151",
                      }}
                    >
                      {p.growth > 0 ? "+" : ""}
                      {pct(p.growth)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="be-empty">Chưa có dữ liệu.</div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* /THỐNG KÊ */}
    </div>
  );
}
