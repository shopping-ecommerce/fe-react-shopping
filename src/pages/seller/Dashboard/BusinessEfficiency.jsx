// src/pages/seller/Dashboard/BusinessEfficiency.jsx
"use client";

import React, { useEffect, useMemo, useState, useContext } from "react";
import "../../../styles/BusinessEfficiency.css";
import { NavLink } from "react-router-dom";
import { AuthContext } from "../../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../../config/api";

/* ===== Utils ===== */
const vnCurrency = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    Number.isFinite(+n) ? +n : 0
  );

const ddMM = (d) =>
  new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
const toYMD = (d) => new Date(d).toISOString().slice(0, 10);
const todayYmd = () => toYMD(new Date());

const diffDays = (a, b) =>
  Math.max(
    1,
    Math.ceil(
      (new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)) /
        86400000
    ) + 1
  );

const getPrevRange = ({ startDate, endDate }) => {
  const days = diffDays(startDate, endDate);
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  return { startDate: toYMD(prevStart), endDate: toYMD(prevEnd) };
};

const buildOrderStatsUrl = (sellerId, { startDate, endDate }) =>
  apiUrl(
    API_CONFIG.endpoints.orderStatisticsBySeller(sellerId, {
      startDate,
      endDate,
    })
  );
const buildProductStatsUrl = (sellerId) =>
  apiUrl(API_CONFIG.endpoints.productStatisticsBySeller(sellerId));

/* ===== Counter animation nhẹ ===== */
const useAnimatedCounter = (end, duration = 700, start = 0) => {
  const [count, setCount] = useState(start);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const animate = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.floor(start + (end - start) * eased));
      if (p < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [end, duration, start]);
  return count;
};

export default function BusinessEfficiency() {
  const { authFetch, authReady, isAuthenticated } = useContext(AuthContext);

  /* ================== Hai kiểu lọc ================== */
  const [selectedPreset, setSelectedPreset] = useState("7days"); // mặc định 7 ngày qua
  const [draftRange, setDraftRange] = useState({ startDate: "", endDate: "" });

  const defaultApplied = useMemo(() => {
    const end = todayYmd();
    const startD = new Date();
    startD.setDate(startD.getDate() - (7 - 1));
    return { startDate: toYMD(startD), endDate: end };
  }, []);
  const [appliedRange, setAppliedRange] = useState(defaultApplied);

  const presetOptions = [
    { key: "7days", label: "7 ngày qua", days: 7 },
    { key: "30days", label: "30 ngày qua", days: 30 },
    { key: "3months", label: "3 tháng qua", days: 90 },
    { key: "year", label: "Năm nay" },
  ];

  /* ================== Seller & dữ liệu ================== */
  const [sellerId, setSellerId] = useState("");

  const [productStats, setProductStats] = useState(null); // không theo thời gian
  const [orderStatsNow, setOrderStatsNow] = useState(null); // theo appliedRange
  const [orderStatsPrev, setOrderStatsPrev] = useState(null); // kỳ trước appliedRange

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ===== Lấy sellerId ===== */
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;

    (async () => {
      try {
        setError("");
        if (!isAuthenticated) {
          setSellerId("");
          return;
        }
        const profRes = await authFetch(
          apiUrl(API_CONFIG.endpoints.getMyProfile),
          {
            headers: { Accept: "application/json" },
          }
        );
        const prof = await profRes.json().catch(() => ({}));
        if (!profRes.ok)
          throw new Error(prof?.message || `HTTP ${profRes.status}`);

        const userId = prof?.result?.id;
        if (!userId) throw new Error("Không lấy được userId.");

        const selRes = await authFetch(
          apiUrl(API_CONFIG.endpoints.searchSellerByUserId(userId)),
          { headers: { Accept: "application/json" } }
        );
        const sel = await selRes.json().catch(() => ({}));
        if (!selRes.ok)
          throw new Error(sel?.message || `HTTP ${selRes.status}`);

        const sid = sel?.result?.id;
        if (!sid) throw new Error("Tài khoản chưa có sellerId.");

        if (!cancelled) setSellerId(sid);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Không xác định được sellerId.");
          setSellerId("");
        }
      }
    })();

    return () => (cancelled = true);
  }, [authReady, isAuthenticated, authFetch]);

  /* ===== Bấm preset => áp dụng NGAY ===== */
  const onClickPreset = (key) => {
    setSelectedPreset(key);
    const end = todayYmd();
    let range;
    if (key === "year") {
      const start = toYMD(new Date(new Date().getFullYear(), 0, 1));
      range = { startDate: start, endDate: end };
    } else {
      const days = presetOptions.find((p) => p.key === key)?.days ?? 7;
      const startD = new Date();
      startD.setDate(startD.getDate() - (days - 1));
      range = { startDate: toYMD(startD), endDate: end };
    }
    setAppliedRange(range);
  };

  /* ===== Date inputs ===== */
  const onChangeStart = (v) => setDraftRange({ startDate: v, endDate: "" });
  const onChangeEnd = (v) => setDraftRange((r) => ({ ...r, endDate: v }));
  const canApplyCustom = Boolean(draftRange.startDate && draftRange.endDate);
  const applyCustom = () => {
    if (!canApplyCustom) return;
    setAppliedRange({ ...draftRange });
    setSelectedPreset(""); // custom
  };

  /* ===== Gọi API theo appliedRange ===== */
  useEffect(() => {
    if (!authReady || !sellerId) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");

        // 1) Product statistics (không theo thời gian)
        const psRes = await authFetch(buildProductStatsUrl(sellerId), {
          headers: { Accept: "application/json" },
        });
        const ps = await psRes.json().catch(() => ({}));
        if (!psRes.ok || ps?.code !== 200)
          throw new Error(ps?.message || `HTTP ${psRes.status}`);

        // 2) Order statistics hiện tại
        const nowRes = await authFetch(
          buildOrderStatsUrl(sellerId, appliedRange),
          { headers: { Accept: "application/json" } }
        );
        const nowJs = await nowRes.json().catch(() => ({}));
        if (!nowRes.ok || nowJs?.code !== 200)
          throw new Error(nowJs?.message || `HTTP ${nowRes.status}`);

        // 3) Order statistics kỳ trước
        const prevRes = await authFetch(
          buildOrderStatsUrl(sellerId, getPrevRange(appliedRange)),
          { headers: { Accept: "application/json" } }
        );
        const prevJs = await prevRes.json().catch(() => ({}));
        if (!prevRes.ok || prevJs?.code !== 200)
          throw new Error(prevJs?.message || `HTTP ${prevRes.status}`);

        if (cancelled) return;
        setProductStats(ps?.result || null);
        setOrderStatsNow(nowJs?.result || null);
        setOrderStatsPrev(prevJs?.result || null);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Không tải được thống kê.");
          setProductStats(null);
          setOrderStatsNow(null);
          setOrderStatsPrev(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => (cancelled = true);
  }, [authReady, sellerId, appliedRange, authFetch]);

  /* ===== Dữ liệu biểu đồ ngày ===== */
  const chartRaw = Array.isArray(orderStatsNow?.revenueChart)
    ? orderStatsNow.revenueChart
    : [];

  const allDays = useMemo(() => {
    const out = [];
    const cur = new Date(appliedRange.startDate + "T00:00:00");
    const end = new Date(appliedRange.endDate + "T00:00:00");
    while (cur.getTime() <= end.getTime()) {
      out.push(toYMD(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [appliedRange]);

  const chartData = useMemo(() => {
    const map = new Map(chartRaw.map((d) => [d.date, d]));
    const maxRev = Math.max(1, ...chartRaw.map((d) => Number(d.revenue || 0)));
    return allDays.map((d, i) => {
      const rec = map.get(d) || { revenue: 0, orderCount: 0 };
      return {
        date: d,
        label: ddMM(d),
        revenue: Number(rec.revenue || 0),
        orders: Number(rec.orderCount || 0),
        idx: i,
        maxRev,
      };
    });
  }, [chartRaw, allDays]);

  /* ===== Top 5 ngày có nhiều đơn nhất (theo thời gian) ===== */
  const top5OrderDays = useMemo(() => {
    const daysWithOrders = chartData.filter((d) => d.orders > 0);
    const sortedByOrdersDesc = [...daysWithOrders].sort((a, b) => {
      if (b.orders !== a.orders) return b.orders - a.orders;
      return new Date(b.date) - new Date(a.date);
    });
    const top = sortedByOrdersDesc.slice(0, 5);
    return top.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [chartData]);

  /* ===== Donut Top SP (không theo thời gian) ===== */
  const topProductList =
    productStats?.salesPerformance?.topSellingProducts || [];
  const topDonut = useMemo(() => {
    if (!Array.isArray(topProductList) || !topProductList.length) {
      return { total: 0, items: [] };
    }
    const sorted = topProductList
      .map((p) => ({
        name: p.productName || p.productId,
        value: Number(p.revenue || 0),
      }))
      .sort((a, b) => b.value - a.value);

    const top5 = sorted.slice(0, 5);
    const otherSum = sorted.slice(5).reduce((s, x) => s + x.value, 0);
    const items =
      otherSum > 0 ? [...top5, { name: "Khác", value: otherSum }] : top5;
    const total = items.reduce((s, x) => s + x.value, 0);
    return {
      total,
      items: items.map((x) => ({
        ...x,
        pct: total ? Math.round((x.value * 100) / total) : 0,
      })),
    };
  }, [topProductList]);

  /* ===== Donut: Tỷ lệ trạng thái đơn hàng (trong kỳ) ===== */
  const statusDonut = useMemo(() => {
    const completed = Number(
      orderStatsNow?.orderCountStats?.completedOrders ?? 0
    );
    const cancelled = Number(
      orderStatsNow?.orderCountStats?.cancelledOrders ?? 0
    );
    const items = [
      { name: "Hoàn tất", value: completed, color: "#22c55e" },
      { name: "Hủy", value: cancelled, color: "#ef4444" },
    ];
    const total = items.reduce((s, x) => s + x.value, 0);
    const safeItems =
      total === 0
        ? [{ name: "Chưa có dữ liệu", value: 1, color: "#e5e7eb", pct: 100 }]
        : items.map((it) => ({
            ...it,
            pct: Math.round((it.value * 100) / total),
          }));
    return { total, items: safeItems };
  }, [orderStatsNow]);

  /* ===== KPI theo KHOẢNG đã áp dụng ===== */
  const totalRevenueInRange = chartData.reduce(
    (s, x) => s + (x.revenue || 0),
    0
  );
  const totalOrdersInRange = chartData.reduce((s, x) => s + (x.orders || 0), 0);
  const avgRevenuePerOrder = totalOrdersInRange
    ? Math.round(totalRevenueInRange / totalOrdersInRange)
    : 0;
  const avgRevenuePerDay = chartData.length
    ? Math.round(totalRevenueInRange / chartData.length)
    : 0;

  /* ===== KPI sản phẩm (không theo thời gian) ===== */
  const prodCnt = productStats?.productCountByStatus || {};
  const salesPerf = productStats?.salesPerformance || {};
  const inv = productStats?.inventoryStatistics || {};

  const animTotalProd = useAnimatedCounter(Number(prodCnt.total || 0));
  const animSold = useAnimatedCounter(Number(salesPerf.totalSold || 0));
  const animStock = useAnimatedCounter(Number(inv.totalStockQuantity || 0));

  /* ===== Filter title ===== */
  const presetLabel = presetOptions.find(
    (p) => p.key === selectedPreset
  )?.label;
  const filterTitle = selectedPreset
    ? presetLabel
    : `Từ ngày ${appliedRange.startDate} đến ${appliedRange.endDate}`;

  /* ===== Render ===== */
  return (
    <div className="be-wrap be-light">
      <div className="be-head fade-in">
        <div className="be-efficiency-breadcrumb">
          <NavLink to="/seller/home" className="be-crumb-link">
            Trang chủ
          </NavLink>
        </div>
        <h1>Hiệu quả Kinh doanh</h1>

        {/* Bộ lọc */}
        <div className="be-filters">
          {presetOptions.map((p) => (
            <button
              key={p.key}
              className={`be-chip ${
                selectedPreset === p.key ? "is-active" : ""
              }`}
              onClick={() => onClickPreset(p.key)}
              title={p.label}
            >
              {p.label}
            </button>
          ))}

          <div className="be-datepick">
            <label>Từ ngày</label>
            <input
              type="date"
              value={draftRange.startDate}
              onChange={(e) =>
                setDraftRange({ startDate: e.target.value, endDate: "" })
              }
              max={draftRange.endDate || todayYmd()}
            />
          </div>
          <div className="be-datepick">
            <label>Đến ngày</label>
            <input
              type="date"
              value={draftRange.endDate}
              onChange={(e) =>
                setDraftRange((r) => ({ ...r, endDate: e.target.value }))
              }
              min={draftRange.startDate || ""}
              max={todayYmd()}
            />
          </div>

          <button
            className="be-icon-btn"
            onClick={applyCustom}
            disabled={!canApplyCustom || loading}
            title="Áp dụng bộ lọc"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {!sellerId && (
        <div className="be-alert be-alert--error">
          Không xác định được <b>sellerId</b>. Hãy đăng nhập và đảm bảo tài
          khoản là người bán.
        </div>
      )}
      {error && <div className="be-alert be-alert--error">{error}</div>}

      {/* ================== NHÓM 1: ÁP DỤNG BỘ LỌC THỜI GIAN ================== */}
      <div className="be-section-sep">
        <span className="sep-dot sep-blue" />
        <span>Áp dụng bộ lọc thời gian</span>
      </div>

      {/* Trạng thái lọc */}
      <div className="be-panel lift be-filter-status">
        <div className="be-panel__head">
          <h2>Trạng thái lọc: {filterTitle}</h2>
        </div>
      </div>

      {/* KPI theo kỳ */}
      <div className="be-grid">
        {/* Tổng doanh thu (trong kỳ) – SKY */}
        <div className={`be-card kpi kpi-sky lift ${loading ? "is-skeleton" : ""}`}>
          <div className="be-card__title">Tổng doanh thu (trong kỳ)</div>
          <div className="be-card__value">
            {vnCurrency(totalRevenueInRange)}
          </div>
          <div className="be-subline">
            TB/ngày: {vnCurrency(avgRevenuePerDay)} • TB/đơn:{" "}
            {vnCurrency(avgRevenuePerOrder)}
          </div>
        </div>

        {/* Tổng đơn (trong kỳ) – ROSE */}
        <div className={`be-card kpi kpi-rose lift ${loading ? "is-skeleton" : ""}`}>
          <div className="be-card__title">Tổng đơn (trong kỳ)</div>
          <div className="be-card__value">
            {totalOrdersInRange.toLocaleString("vi-VN")}
          </div>
          <div className="be-subline">
            Hoàn tất: {orderStatsNow?.orderCountStats?.completedOrders ?? 0} •
            Hủy: {orderStatsNow?.orderCountStats?.cancelledOrders ?? 0}
          </div>
        </div>

        {/* Doanh thu hôm nay – AMBER */}
        <div className={`be-card kpi kpi-amber lift ${loading ? "is-skeleton" : ""}`}>
          <div className="be-card__title">Doanh thu hôm nay</div>
          <div className="be-card__value">
            {vnCurrency(orderStatsNow?.revenueStats?.todayRevenue || 0)}
          </div>
          <div className="be-subline">
            Khoảng áp dụng: {appliedRange.startDate} → {appliedRange.endDate}
          </div>
        </div>

        {/* Doanh thu tháng (trong kỳ) – VIOLET */}
        <div className={`be-card kpi kpi-violet lift ${loading ? "is-skeleton" : ""}`}>
          <div className="be-card__title">Doanh thu tháng (trong kỳ)</div>
          <div className="be-card__value">
            {vnCurrency(orderStatsNow?.revenueStats?.monthRevenue || 0)}
          </div>
          <div className="be-subline">
            Tăng trưởng:{" "}
            {(orderStatsNow?.revenueStats?.revenueGrowthRate ?? 0).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Biểu đồ theo ngày */}
      <div className={`be-panel lift ${loading ? "is-skeleton" : ""}`}>
        <div className="be-panel__head">
          <h2>Biểu đồ theo ngày</h2>
          <div className="be-note">
            Khoảng áp dụng: {appliedRange.startDate} → {appliedRange.endDate}
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
                chartData.length > 1 ? w / (chartData.length - 1) : 0;
              const maxRev = Math.max(1, ...chartData.map((d) => d.revenue));

              const labelsX = chartData.map((d, i) => {
                const x = left + i * stepX;
                const show =
                  chartData.length <= 8 ||
                  i % Math.ceil(chartData.length / 8) === 0 ||
                  i === chartData.length - 1;
                return { x, show, text: d.label };
              });

              const points = chartData
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

                  {chartData.map((d, i) => {
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

      {/* Donut trạng thái đơn hàng (trong kỳ) */}
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
              const total = items.reduce((s, x) => s + x.value, 0) || 1;

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
                    Math.round((it.value * 100) / (statusDonut.total || 1))}
                  %
                </div>
                <div className="be-donut-val">
                  {it.value.toLocaleString("vi-VN")} đơn
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 5 ngày có số đơn nhiều nhất */}
      <div className={`be-panel lift ${loading ? "is-skeleton" : ""}`}>
        <div className="be-panel__head">
          <h2>Top 5 ngày có số đơn nhiều nhất</h2>
          <div className="be-note">Chỉ lấy ngày có đơn (tối đa 5)</div>
        </div>

        <div className="be-chart">
          <svg viewBox="0 0 820 360" className="be-chart-svg">
            {(() => {
              const left = 60,
                right = 30,
                top = 30,
                bottom = 310;
              const w = 820 - left - right;
              const h = bottom - top;
              const N = Math.max(1, top5OrderDays.length);
              const barW = 65; // theo yêu cầu
              const gap = 24;
              const totalBarsW = N * barW + (N - 1) * gap;
              const startX = left + Math.max(0, (w - totalBarsW) / 2);
              const maxV = Math.max(1, ...top5OrderDays.map((d) => d.orders));

              if (!top5OrderDays.length) {
                return (
                  <text x={left} y={top + 30} fontSize="14" fill="#6b7280">
                    Chưa có dữ liệu đơn hàng trong khoảng lọc.
                  </text>
                );
              }

              return (
                <>
                  {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
                    const y = bottom - t * h;
                    const val = Math.round(maxV * t);
                    return (
                      <g key={`y-${i}`}>
                        <line
                          x1={left}
                          y1={y}
                          x2={left + w}
                          y2={y}
                          stroke="#f5f7fb"
                        />
                        <text x={10} y={y - 4} fontSize="10" fill="#6b7280">
                          {val.toLocaleString("vi-VN")}
                        </text>
                      </g>
                    );
                  })}

                  {top5OrderDays.map((d, i) => {
                    const x = startX + i * (barW + gap);
                    const hVal = (d.orders / maxV) * h;
                    const y = bottom - hVal;
                    return (
                      <g key={`b-${i}`}>
                        <rect
                          x={x}
                          y={y}
                          width={barW}
                          height={hVal}
                          fill="#f472b6"
                          rx="8"
                        />
                        <title>{`${d.label}: ${d.orders} đơn`}</title>
                        <text
                          x={x + barW / 2}
                          y={y - 6}
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="800"
                          fill="#374151"
                        >
                          {d.orders}
                        </text>
                        <text
                          x={x + barW / 2}
                          y={340}
                          textAnchor="middle"
                          fontSize="11"
                          fill="#6b7280"
                        >
                          {d.label}
                        </text>
                      </g>
                    );
                  })}
                </>
              );
            })()}
          </svg>
        </div>
      </div>

      {/* ================== NHÓM 2: SỐ LIỆU HIỆN TRẠNG (KHÔNG THEO THỜI GIAN) ================== */}
      <div className="be-section-sep">
        <span className="sep-dot sep-gray" />
        <span>Số liệu hiện trạng (không theo thời gian)</span>
      </div>

      {/* Tổng sản phẩm + trạng thái đẹp */}
      <div className="be-grid">
        {/* Tổng sản phẩm – INDIGO */}
        <div className={`be-card kpi kpi-indigo lift ${loading ? "is-skeleton" : ""}`}>
          <div className="be-card__title">Tổng sản phẩm</div>
          <div className="be-card__value">
            {animTotalProd.toLocaleString("vi-VN")}
          </div>

          {/* Hàng trạng thái hiển thị ngang + số căn thẳng */}
          <div className="be-status-inline">
            <div className="be-status-chip">
              <span className="chip-label">
                <span className="badge ok">Đang bán</span>
              </span>
              <span className="chip-num">
                {(prodCnt.available || 0).toLocaleString("vi-VN")}
              </span>
            </div>

            <div className="be-status-chip">
              <span className="chip-label">
                <span className="badge warn">Chờ duyệt</span>
              </span>
              <span className="chip-num">
                {(prodCnt.pending || 0).toLocaleString("vi-VN")}
              </span>
            </div>

            <div className="be-status-chip">
              <span className="chip-label">
                <span className="badge danger">Tạm ngưng</span>
              </span>
              <span className="chip-num">
                {(prodCnt.suspended || 0).toLocaleString("vi-VN")}
              </span>
            </div>

            <div className="be-status-chip">
              <span className="chip-label">
                <span className="badge mute">Ngừng bán</span>
              </span>
              <span className="chip-num">
                {(prodCnt.discontinued || 0).toLocaleString("vi-VN")}
              </span>
            </div>
          </div>
        </div>

        {/* Tồn kho (hiện trạng) – CYAN */}
        <div className={`be-card kpi kpi-cyan lift ${loading ? "is-skeleton" : ""}`}>
          <div className="be-card__title">Tồn kho (hiện trạng)</div>
          <div className="be-card__value">
            {(inv.totalStockQuantity || 0).toLocaleString("vi-VN")}
          </div>

          {/* Hàng ngang: Tổng SL tồn • Sắp hết • Hết hàng */}
          <div className="be-status-inline be-status-inline--inv">
            <div className="be-status-chip inv-total">
              <span className="chip-label">
                <span className="dot8 inv-dot" />
                Tổng SL tồn
              </span>
              <span className="chip-num">
                {(inv.totalStockQuantity || 0).toLocaleString("vi-VN")}
              </span>
            </div>

            <div className="be-status-chip inv-low">
              <span className="chip-label">
                <span className="dot8 inv-dot" />
                Sắp hết
              </span>
              <span className="chip-num">
                {(inv.lowStockVariants || 0).toLocaleString("vi-VN")}
              </span>
            </div>

            <div className="be-status-chip inv-oos">
              <span className="chip-label">
                <span className="dot8 inv-dot" />
                Hết hàng
              </span>
              <span className="chip-num">
                {(inv.outOfStockVariants || 0).toLocaleString("vi-VN")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Donut Top SP (không theo thời gian) */}
      <div className={`be-panel lift ${loading ? "is-skeleton" : ""}`}>
        <div className="be-panel__head">
          <h2>Top sản phẩm bán chạy – Biểu đồ tròn</h2>
          <div className="be-note">Tỷ trọng doanh thu theo sản phẩm</div>
        </div>

        <div className="be-flex-row">
          <svg viewBox="0 0 360 360" className="be-donut-svg">
            {(() => {
              const cx = 180,
                cy = 180,
                r = 110,
                t = 28;
              const C = 2 * Math.PI * r;
              let acc = 0;
              const items = topDonut.items.length
                ? topDonut.items
                : [{ name: "Chưa có dữ liệu", value: 1, pct: 100 }];
              const palette = [
                "#2563eb",
                "#22c55e",
                "#f59e0b",
                "#ef4444",
                "#8b5cf6",
                "#14b8a6",
              ];

              return items.map((it, idx) => {
                const len = topDonut.total
                  ? (it.value / topDonut.total) * C
                  : C;
                const dash = `${len} ${C - len}`;
                const rot = (acc / C) * 360 - 90;
                acc += len;
                return (
                  <g
                    key={`s-${idx}`}
                    transform={`rotate(${rot}, ${cx}, ${cy})`}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill="none"
                      stroke={palette[idx % palette.length]}
                      strokeWidth={t}
                      strokeDasharray={dash}
                    />
                  </g>
                );
              });
            })()}
            <circle cx="180" cy="180" r="92" fill="#fff" />
            <text
              x="180"
              y="168"
              textAnchor="middle"
              fontSize="13"
              fill="#6b7280"
            >
              Tổng doanh thu
            </text>
            <text
              x="180"
              y="194"
              textAnchor="middle"
              fontSize="18"
              fontWeight="800"
              fill="#111827"
            >
              {vnCurrency(topDonut.total || 0)}
            </text>
          </svg>

          <div className="be-donut-legend">
            {(topDonut.items || []).map((it, idx) => {
              const palette = [
                "#2563eb",
                "#22c55e",
                "#f59e0b",
                "#ef4444",
                "#8b5cf6",
                "#14b8a6",
              ];
              return (
                <div className="be-donut-row" key={`lg-${idx}`}>
                  <span
                    className="be-donut-dot"
                    style={{ background: palette[idx % palette.length] }}
                  />
                  <div className="be-donut-name" title={it.name}>
                    {it.name}
                  </div>
                  <div className="be-donut-pct">{it.pct}%</div>
                  <div className="be-donut-val">{vnCurrency(it.value)}</div>
                </div>
              );
            })}
            {!topDonut.items?.length && (
              <div className="be-empty">Chưa có dữ liệu.</div>
            )}
          </div>
        </div>
      </div>

      {/* Bảng Top bán chạy (không theo thời gian) */}
      <div className={`be-panel lift ${loading ? "is-skeleton" : ""}`}>
        <div className="be-panel__head">
          <h2>Top sản phẩm bán chạy</h2>
          <div className="be-note">
            Nguồn: API sản phẩm (không theo thời gian)
          </div>
        </div>
        <div className="be-table">
          <div className="be-thead">
            <div>SP</div>
            <div>Tên</div>
            <div>Đã bán</div>
            <div>Doanh thu</div>
            <div>Tồn</div> 
          </div>
          <div className="be-tbody">
            {loading ? (
              <div className="be-empty">Đang tải...</div>
            ) : (topProductList || []).length ? (
              topProductList.map((p) => (
                <div className="be-row hover-row" key={p.productId}>
                  <div className="be-td">
                    <div className="be-img">
                      <img
                        src={p.imageUrl}
                        alt={p.productName}
                        loading="lazy"
                      />
                    </div>
                  </div>
                  <div className="be-td be-td--name" title={p.productName}>
                    {p.productName}
                  </div>
                  <div className="be-td">
                    {(p.soldCount || 0).toLocaleString("vi-VN")}
                  </div>
                  <div className="be-td">{vnCurrency(p.revenue || 0)}</div>
                  <div className="be-td">
                    {(p.stockQuantity || 0).toLocaleString("vi-VN")}
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
  );
}
