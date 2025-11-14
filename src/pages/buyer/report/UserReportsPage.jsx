"use client";

import React, { useEffect, useMemo, useRef, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../../config/api";
import { fetchUserReports } from "../../../services/reportService";
import { fetchProductDetail } from "../../../services/products";
import "../../../styles/UserReportsPage.css";

const fmtDateTime = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const statusClass = (s) => {
  const k = (s || "").toUpperCase();
  if (k === "RESOLVED") return "st-ok";
  if (k === "REJECTED") return "st-no";
  if (k === "PENDING") return "st-pending";
  return "st-unknown";
};

const statusLabel = (s) => {
  switch ((s || "").toUpperCase()) {
    case "PENDING":
      return "Đang xử lý";
    case "RESOLVED":
      return "Đã xử lý";
    case "REJECTED":
      return "Từ chối";
    default:
      return "Không rõ";
  }
};

export default function UserReportsPage() {
  const { authFetch } = useContext(AuthContext) || {};
  const navigate = useNavigate();

  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  // Lọc/sắp xếp
  const [qStatus, setQStatus] = useState("ALL");
  const [qText, setQText] = useState("");
  const [sortBy, setSortBy] = useState("created_desc"); // created_desc | created_asc

  // Phân trang
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(7); // 3 | 7 | 10 | 20 | 30

  // Cache tên sản phẩm
  const productNameCacheRef = useRef(new Map());

  // Lấy userId
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authFetch) return;
      try {
        const rp = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile), {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const dp = await rp.json().catch(() => ({}));
        if (!rp.ok) throw new Error(dp?.message || `HTTP ${rp.status}`);
        const uid = dp?.result?.id || dp?.id;
        if (!uid) throw new Error("Không lấy được mã người dùng");
        if (cancelled) return;
        setUserId(uid);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Không lấy được hồ sơ người dùng");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // Load danh sách báo cáo
  useEffect(() => {
    if (!userId || !authFetch) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const items = await fetchUserReports(authFetch, userId);
        if (cancelled) return;
        setRows(items || []);
        setPage(1);

        // Preload tên sản phẩm
        const ids = Array.from(
          new Set((items || []).map((r) => r.productId).filter(Boolean))
        );
        ids.forEach(async (pid) => {
          if (productNameCacheRef.current.has(pid)) return;
          try {
            const p = await fetchProductDetail(authFetch, pid);
            productNameCacheRef.current.set(pid, p?.name || "");
            setRows((prev) => [...prev]); // refresh nhẹ
          } catch {
            productNameCacheRef.current.set(pid, "");
          }
        });
      } catch (e) {
        if (!cancelled)
          setErr(e?.message || "Không tải được danh sách báo cáo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, authFetch]);

  const statuses = useMemo(
    () => ["ALL", "PENDING", "RESOLVED", "REJECTED"],
    []
  );

  const filtered = useMemo(() => {
    let x = [...rows];
    if (qStatus !== "ALL") {
      x = x.filter(
        (r) => (r.status || "").toUpperCase() === qStatus.toUpperCase()
      );
    }
    if (qText.trim()) {
      const k = qText.trim().toLowerCase();
      x = x.filter(
        (r) =>
          (r.reason || "").toLowerCase().includes(k) ||
          (r.productId || "").toLowerCase().includes(k) ||
          (r.id || "").toLowerCase().includes(k)
      );
    }
    switch (sortBy) {
      case "created_desc":
        x.sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        break;
      case "created_asc":
        x.sort(
          (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        );
        break;
      default:
        break;
    }
    return x;
  }, [rows, qStatus, qText, sortBy]);

  // Tính trang
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(startIdx, startIdx + pageSize);

  // Reset về trang 1 khi đổi filter/sort/pageSize
  useEffect(() => {
    setPage(1);
  }, [qStatus, qText, sortBy, pageSize]);

  const gotoPage = (p) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  const pageNumbers = useMemo(() => {
    const nums = [];
    const maxButtons = 7;
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) nums.push(i);
      return nums;
    }
    const left = Math.max(1, currentPage - 2);
    const right = Math.min(totalPages, currentPage + 2);
    if (left > 1) nums.push(1, "…");
    for (let i = left; i <= right; i++) nums.push(i);
    if (right < totalPages) nums.push("…", totalPages);
    return nums;
  }, [currentPage, totalPages]);

  const productNameOf = (pid) => {
    if (!pid) return "";
    return productNameCacheRef.current.get(pid) || "";
  };

  return (
    <div className="ur-wrap">
      {/* Header */}
      <div className="ur-top">
        <h2 className="ur-title">Báo cáo bạn đã gửi</h2>
        <div className="ur-toolbar">
          <label className="ur-field">
            <span>Trạng thái</span>
            <select
              value={qStatus}
              onChange={(e) => setQStatus(e.target.value)}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL"
                    ? "Tất cả"
                    : s === "PENDING"
                    ? "Đang xử lý"
                    : s === "RESOLVED"
                    ? "Đã xử lý"
                    : s === "REJECTED"
                    ? "Từ chối"
                    : s}
                </option>
              ))}
            </select>
          </label>

          <label className="ur-field">
            <span>Sắp xếp</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="created_desc">Mới nhất</option>
              <option value="created_asc">Cũ nhất</option>
            </select>
          </label>

          <label className="ur-field grow">
            <span>Tìm kiếm</span>
            <input
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Lý do / Mã sản phẩm / Mã báo cáo…"
            />
          </label>

          {/* Tổng – nền đen, chữ trắng */}
          <div className="ur-total-chip" title="Tổng số báo cáo đang hiển thị">
            Tổng: <b>{total}</b>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="ur-loading">Đang tải…</div>
      ) : err ? (
        <div className="ur-error">{err}</div>
      ) : total === 0 ? (
        <div className="ur-empty">Bạn chưa có báo cáo nào phù hợp bộ lọc.</div>
      ) : (
        <>
          <div className="ur-grid">
            {pageRows.map((r) => {
              const name = productNameOf(r.productId);
              const quoted = name
                ? `“${name}”`
                : r.productId
                ? `(${r.productId})`
                : "—";
              const k = String(r.status || "").toUpperCase();

              let decisionText = "";
              if (k === "RESOLVED") {
                decisionText = `Sản phẩm: ${quoted} đã bị tạm ngưng.`;
              } else if (k === "REJECTED") {
                decisionText = `Sản phẩm: ${quoted} không có dấu hiệu vi phạm.`;
              } else if (k === "PENDING") {
                decisionText = `Đang chờ xử lý đối với sản phẩm: ${quoted}.`;
              }

              return (
                <div key={r.id} className="ur-card">
                  <div className="ur-card-head">
                    <div className={`ur-status ${statusClass(r.status)}`}>
                      {statusLabel(r.status)}
                    </div>
                    <div className="ur-time">{fmtDateTime(r.createdAt)}</div>
                  </div>

                  {/* Lý do – CÙNG HÀNG */}
                  <div className="ur-line">
                    <span className="ur-label">Lý do bạn báo cáo</span>
                    <div className="ur-value">
                      {r.reason || "(Không có lý do)"}
                    </div>
                  </div>

                  {/* Mã báo cáo – CÙNG HÀNG */}
                  <div className="ur-line">
                    <span className="ur-label">Mã báo cáo</span>
                    <div className="ur-value">
                      <code className="mono">{r.id}</code>
                    </div>
                  </div>

                  {/* Sản phẩm – CÙNG HÀNG */}
                  <div className="ur-line">
                    <span className="ur-label">Sản phẩm</span>
                    <div className="ur-value">
                      <button
                        className="ur-link"
                        onClick={() =>
                          r.productId && navigate(`/products/${r.productId}`)
                        }
                        disabled={!r.productId}
                        title="Xem sản phẩm"
                      >
                        {name || r.productId || "—"}
                      </button>
                    </div>
                  </div>

                  {/* Kết quả – CÙNG HÀNG */}
                  {decisionText && (
                    <div className="ur-line ur-result">
                      <span className="ur-label">Kết quả</span>
                      <div className="ur-value">{decisionText}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="ur-paging">
            <div className="pg-center">
              <button
                className="pg-btn"
                disabled={currentPage <= 1}
                onClick={() => gotoPage(currentPage - 1)}
                title="Trang trước"
              >
                ← Trước
              </button>

              <div className="pg-pages">
                {pageNumbers.map((n, i) =>
                  n === "…" ? (
                    <span key={`ellipsis-${i}`} className="pg-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      className={`pg-num ${n === currentPage ? "active" : ""}`}
                      onClick={() => gotoPage(n)}
                      aria-current={n === currentPage ? "page" : undefined}
                    >
                      {n}
                    </button>
                  )
                )}
              </div>

              <button
                className="pg-btn"
                disabled={currentPage >= totalPages}
                onClick={() => gotoPage(currentPage + 1)}
                title="Trang sau"
              >
                Sau →
              </button>
            </div>

            <div className="pg-right">
              <label className="ur-field compact">
                <span>Số vi phạm/trang</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  <option value={3}>3</option>
                  <option value={7}>7</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                </select>
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
