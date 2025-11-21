// src/pages/seller/Inventory.jsx
"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useContext,
  useRef,
  useCallback,
} from "react";
import "../../../styles/Inventory.css";
import { NavLink } from "react-router-dom";
import { AuthContext } from "../../../contexts/AuthContext";
import { apiUrl, API_CONFIG } from "../../../config/api";

/* ===== Utils ===== */
const vnCurrency = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    Number.isFinite(+n) ? +n : 0
  );

const buildSellerId = async (authFetch) => {
  // Lấy sellerId giống Dashboard
  const profRes = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile), {
    headers: { Accept: "application/json" },
  });
  const prof = await profRes.json().catch(() => ({}));
  if (!profRes.ok) throw new Error(prof?.message || `HTTP ${profRes.status}`);

  const userId = prof?.result?.id;
  if (!userId) throw new Error("Không lấy được userId.");

  const selRes = await authFetch(
    apiUrl(API_CONFIG.endpoints.searchSellerByUserId(userId)),
    { headers: { Accept: "application/json" } }
  );
  const sel = await selRes.json().catch(() => ({}));
  if (!selRes.ok) throw new Error(sel?.message || `HTTP ${selRes.status}`);

  const sid = sel?.result?.id;
  if (!sid) throw new Error("Tài khoản chưa có sellerId.");
  return sid;
};

/* ===== API: thống kê tồn kho theo seller (endpoint bạn đưa) ===== */
const buildInventoryStatsUrl = (sellerId) =>
  apiUrl(`/product/statistics/seller/${sellerId}`);

export default function Inventory() {
  const { authFetch, authReady, isAuthenticated } = useContext(AuthContext);

  const [sellerId, setSellerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);

  // Tabs lọc loại cảnh báo
  const [viewTab, setViewTab] = useState("all"); // all | low | oos | slow

  // ======= Pagination states (giống trang sản phẩm) =======
  const cardRef = useRef(null);
  const scrollToTop = useCallback(() => {
    const el = cardRef.current;
    if (!el) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const HEADER_OFFSET = 0;
    const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, []);

  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  /* ===== Lấy sellerId ===== */
  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    let cancelled = false;

    (async () => {
      try {
        setError("");
        const sid = await buildSellerId(authFetch);
        if (!cancelled) setSellerId(sid);
      } catch (e) {
        if (!cancelled) {
          setSellerId("");
          setError(e.message || "Không xác định được sellerId.");
        }
      }
    })();

    return () => (cancelled = true);
  }, [authReady, isAuthenticated, authFetch]);

  /* ===== Gọi API thống kê tồn kho ===== */
  useEffect(() => {
    if (!authReady || !sellerId) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const res = await authFetch(buildInventoryStatsUrl(sellerId), {
          headers: { Accept: "application/json" },
        });
        const js = await res.json().catch(() => ({}));
        if (!res.ok || js?.code !== 200)
          throw new Error(js?.message || `HTTP ${res.status}`);

        if (cancelled) return;
        setStats(js?.result || null);
      } catch (e) {
        if (!cancelled) {
          setStats(null);
          setError(e.message || "Không tải được thống kê tồn kho.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => (cancelled = true);
  }, [authReady, sellerId, authFetch]);

  /* ===== Data helpers ===== */
  const inv = stats?.inventoryStatistics || {};
  const lowList = Array.isArray(inv?.lowStockAlerts) ? inv.lowStockAlerts : [];
  const oosList = Array.isArray(inv?.outOfStockAlerts)
    ? inv.outOfStockAlerts
    : [];
  const slowList = Array.isArray(inv?.slowMovingProducts)
    ? inv.slowMovingProducts
    : [];

  const filterTitle = useMemo(() => {
    switch (viewTab) {
      case "low":
        return "Biến thể sắp hết";
      case "oos":
        return "Biến thể hết hàng";
      case "slow":
        return "Sản phẩm bán chậm";
      default:
        return "Tất cả cảnh báo";
    }
  }, [viewTab]);

  const combined = useMemo(() => {
    if (viewTab === "low") return lowList.map((x) => ({ ...x, _type: "LOW" }));
    if (viewTab === "oos") return oosList.map((x) => ({ ...x, _type: "OOS" }));
    if (viewTab === "slow")
      return slowList.map((x) => ({ ...x, _type: "SLOW" }));
    // all
    return [
      ...lowList.map((x) => ({ ...x, _type: "LOW" })),
      ...oosList.map((x) => ({ ...x, _type: "OOS" })),
      ...slowList.map((x) => ({ ...x, _type: "SLOW" })),
    ];
  }, [viewTab, lowList, oosList, slowList]);

  // ===== Reset/derive phân trang mỗi khi dữ liệu hoặc tab đổi =====
  useEffect(() => {
    setPage(1);
  }, [viewTab, pageSize, sellerId]);

  const total = combined.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pageRows = combined.slice(startIdx, startIdx + pageSize);

  const goPage = (p) => {
    const np = Math.min(totalPages, Math.max(1, p));
    if (np !== page) {
      setPage(np);
      scrollToTop();
    }
  };

  const renderPageButtons = () => {
    if (totalPages <= 1) return null;
    const btns = [];
    const windowSize = 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);

    if (start > 1) {
      btns.push(
        <button key="p1" className="inv-pg-btn" onClick={() => goPage(1)}>
          1
        </button>
      );
      if (start > 2)
        btns.push(
          <span key="dotsl" className="inv-pg-dots">
            …
          </span>
        );
    }
    for (let i = start; i <= end; i++) {
      btns.push(
        <button
          key={i}
          className={`inv-pg-btn ${i === page ? "active" : ""}`}
          onClick={() => goPage(i)}
        >
          {i}
        </button>
      );
    }
    if (end < totalPages) {
      if (end < totalPages - 1)
        btns.push(
          <span key="dotsr" className="inv-pg-dots">
            …
          </span>
        );
      btns.push(
        <button
          key="plast"
          className="inv-pg-btn"
          onClick={() => goPage(totalPages)}
        >
          {totalPages}
        </button>
      );
    }
    return btns;
  };

  return (
    <div className="be-wrap be-light">
      <div className="be-head">
        <div className="be-efficiency-breadcrumb">
          <NavLink to="/seller/home" className="be-crumb-link">
            Trang chủ
          </NavLink>
        </div>
        <h1>Quản lý Tồn kho</h1>
      </div>

      {!sellerId && (
        <div className="be-alert be-alert--error">
          Không xác định được <b>sellerId</b>. Hãy đăng nhập và đảm bảo tài
          khoản là người bán.
        </div>
      )}
      {error && <div className="be-alert be-alert--error">{error}</div>}

      {/* KPI nhanh */}
      <div className="be-grid">
        <div className={`be-card kpi-1 lift ${loading ? "is-skeleton" : ""}`}>
          <div className="be-card__title">Tổng số lượng tồn</div>
          <div className="be-card__value">
            {(inv.totalStockQuantity || 0).toLocaleString("vi-VN")}
          </div>
          <div className="be-subline">Tổng tồn kho hiện tại</div>
        </div>

        <div className={`be-card kpi-2 lift ${loading ? "is-skeleton" : ""}`}>
          <div className="be-card__title">Biến thể sắp hết</div>
          <div className="be-card__value">
            {(inv.lowStockVariants || 0).toLocaleString("vi-VN")}
          </div>
          <div className="be-subline">Cảnh báo sắp hết hàng</div>
        </div>

        <div className={`be-card kpi-3 lift ${loading ? "is-skeleton" : ""}`}>
          <div className="be-card__title">Biến thể hết hàng</div>
          <div className="be-card__value">
            {(inv.outOfStockVariants || 0).toLocaleString("vi-VN")}
          </div>
          <div className="be-subline">Cảnh báo hết hàng</div>
        </div>

        <div className={`be-card kpi-4 lift ${loading ? "is-skeleton" : ""}`}>
          <div className="be-card__title">Sản phẩm bán chậm</div>
          <div className="be-card__value">
            {(slowList?.length || 0).toLocaleString("vi-VN")}
          </div>
          <div className="be-subline">&gt;= 30 ngày chưa bán</div>
        </div>
      </div>

      {/* Tabs lọc loại cảnh báo */}
      <div className="be-panel lift" ref={cardRef}>
        <div className="be-panel__head">
          <h2>{filterTitle}</h2>
          <div className="inv-tabs">
            <button
              className={`inv-tab ${viewTab === "all" ? "is-active" : ""}`}
              onClick={() => setViewTab("all")}
            >
              Tất cả
            </button>
            <button
              className={`inv-tab ${viewTab === "low" ? "is-active" : ""}`}
              onClick={() => setViewTab("low")}
            >
              Sắp hết
            </button>
            <button
              className={`inv-tab ${viewTab === "oos" ? "is-active" : ""}`}
              onClick={() => setViewTab("oos")}
            >
              Hết hàng
            </button>
            <button
              className={`inv-tab ${viewTab === "slow" ? "is-active" : ""}`}
              onClick={() => setViewTab("slow")}
            >
              Bán chậm
            </button>
          </div>
        </div>

        <div className="be-table">
          <div className="be-thead inv-thead">
            <div>SP</div>
            <div>Sản phẩm / Biến thể</div>
            <div>Tồn</div>
            <div>Loại cảnh báo</div>
            <div>Ghi chú</div>
          </div>
          <div className="be-tbody">
            {loading ? (
              <div className="be-empty">Đang tải...</div>
            ) : pageRows.length ? (
              pageRows.map((row, idx) => (
                <div
                  className="be-row hover-row inv-row" // <- thêm inv-row để đồng bộ grid
                  key={`${row.productId}-${startIdx + idx}`}
                >
                  <div className="be-td">
                    <div className="be-img">
                      <img
                        src={row.imageUrl}
                        alt={row.productName}
                        loading="lazy"
                      />
                    </div>
                  </div>
                  <div className="be-td be-td--name">
                    <div className="inv-name">{row.productName}</div>
                    {row.variantLabel && (
                      <div className="inv-variant">{row.variantLabel}</div>
                    )}
                  </div>
                  <div className="be-td inv-stock">
                    {typeof row.currentStock === "number"
                      ? row.currentStock.toLocaleString("vi-VN")
                      : row.currentStock || 0}
                  </div>
                  <div className="be-td">
                    {row._type === "LOW" && (
                      <span className="chip chip-low">Sắp hết</span>
                    )}
                    {row._type === "OOS" && (
                      <span className="chip chip-oos">Hết hàng</span>
                    )}
                    {row._type === "SLOW" && (
                      <span className="chip chip-slow">Bán chậm</span>
                    )}
                  </div>
                  <div className="be-td inv-note">
                    {row.message ||
                      (row.daysSinceLastSold != null
                        ? `Tồn kho ${row.daysSinceLastSold} ngày chưa bán được`
                        : "")}
                  </div>
                </div>
              ))
            ) : (
              <div className="be-empty">Không có cảnh báo phù hợp.</div>
            )}
          </div>
        </div>

        {/* ===== Pagination (giống trang sản phẩm) ===== */}
        <div className="inv-pagination full-bleed">
          {/* Trái: Tổng */}
          <div className="inv-pg-left">
            Tổng: <b>{total}</b> mục
          </div>

          {/* Giữa: Prev | [1 … 5] | Next */}
          <div className="inv-pg-middle">
            <button
              className="inv-pg-btn"
              onClick={() => goPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              aria-label="Trang trước"
              title="Trang trước"
            >
              ‹
            </button>

            {renderPageButtons()}

            <button
              className="inv-pg-btn"
              onClick={() => goPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              aria-label="Trang sau"
              title="Trang sau"
            >
              ›
            </button>
          </div>

          {/* Phải: Mỗi trang */}
          <div className="inv-pg-right">
            <span className="pg-label">Mỗi trang:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                scrollToTop();
              }}
              aria-label="Số mục mỗi trang"
            >
              {[5, 10, 15, 20, 30, 50].map((n) => (
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
