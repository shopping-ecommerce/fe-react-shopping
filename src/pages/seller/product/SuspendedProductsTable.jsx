// src/pages/seller/products/SuspendedProductsTable.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useContext,
  useRef,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../../config/api";
import "../../../styles/SellerProductsTable.css";

/** ===== Toast helpers ===== */
const getToastAPI = () => {
  const W = typeof window !== "undefined" ? window : globalThis;
  const bus = W.__appToastBus;
  return {
    show: (opts) => (bus?.show ? bus.show(opts) : null),
  };
};
const { show: showToast } = getToastAPI();

/** ===== Icons ===== */
const IconEdit = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
  </svg>
);

/** ===== Danh mục (fallback) ===== */
const CATEGORY_TRANSLATIONS = {
  Electronics: "Điện tử",
  Fashion: "Thời trang",
  Books: "Sách",
  Home: "Nhà cửa",
  Sports: "Thể thao",
  Beauty: "Làm đẹp",
  Toys: "Đồ chơi",
  Automotive: "Ô tô - Xe máy",
  Health: "Sức khỏe",
  Grocery: "Tạp hóa",
  SecondHand: "Đồ cũ",
  All: "Tất cả",
};

/** ===== Helpers ===== */
const pickImageUrl = (images = []) =>
  (images || [])
    .map((it) => (typeof it === "string" ? it : it?.url))
    .find((u) => typeof u === "string" && !u.toLowerCase().endsWith(".mp4")) ||
  "/img/default.png";

const getVariantRows = (p) => (Array.isArray(p?.variants) ? p.variants : []);
const variantLabel = (v) => {
  const opts = v?.options || {};
  const pairs = Object.entries(opts);
  if (!pairs.length) return "—";
  return pairs.map(([k, val]) => `${k}: ${val}`).join(" / ");
};
const fmtVnd = (n) => Number(n ?? 0).toLocaleString("vi-VN");
const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString("vi-VN", { hour12: false });
  } catch {
    return iso || "";
  }
};

/** ===== Tabs (3 tab) ===== */
const TABS = {
  DISCONTINUED: "DISCONTINUED",
  ADMIN_HOLD: "ADMIN_HOLD", // reUpdate === true
  PENDING: "PENDING", // status === 'PENDING'
};
// cover thêm nhánh 'DELETED' nếu BE từng dùng
const DISCONTINUED_STATES = ["DISCONTINUED", "DELETED"];

export default function SuspendedProductsTable() {
  const params = useParams();
  const navigate = useNavigate();
  const { authFetch } = useContext(AuthContext);

  const sellerIdFromUrl = params?.sellerId || "";
  const [sellerId, setSellerId] = useState(sellerIdFromUrl);

  // Bạn có thể đổi mặc định sang DISCONTINUED nếu muốn
  const [active, setActive] = useState(TABS.ADMIN_HOLD);

  const [loading, setLoading] = useState(true);
  const [loadingCats, setLoadingCats] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  // categories
  const [catIdToName, setCatIdToName] = useState({});
  const [categories, setCategories] = useState([]);

  // filters
  const [query, setQuery] = useState("");
  const [selectedCatId, setSelectedCatId] = useState("");

  // Fan overlay state
  const [fanOpen, setFanOpen] = useState(false);
  const [fanImages, setFanImages] = useState([]);
  const [fanActive, setFanActive] = useState(0);

  // Modal biến thể
  const [varModalOpen, setVarModalOpen] = useState(false);
  const [varModalData, setVarModalData] = useState({
    productName: "",
    variants: [],
  });

  // ===== Scroll to top when paging =====
  const cardRef = useRef(null);
  const scrollToTop = useCallback(() => {
    const el = cardRef.current;
    if (!el) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const HEADER_OFFSET = 0; // chỉnh nếu có header cố định
    const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, []);

  // body scroll lock (chỉ theo 2 modal còn dùng)
  useEffect(() => {
    if (fanOpen || varModalOpen) {
      document.body.classList.add("modal-open");
    } else document.body.classList.remove("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [fanOpen, varModalOpen]);

  // resolve seller id if not in URL
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (sellerIdFromUrl) {
        setSellerId(sellerIdFromUrl);
        return;
      }
      try {
        const resProf = await authFetch(
          apiUrl(API_CONFIG.endpoints.getMyProfile),
          {
            method: "GET",
            headers: { Accept: "application/json" },
          }
        );
        if (resProf.status === 401) return navigate("/login");
        const dataProf = await resProf.json().catch(() => ({}));
        if (!resProf.ok)
          throw new Error(dataProf?.message || `HTTP ${resProf.status}`);

        const userId = dataProf?.result?.id;
        if (!userId) throw new Error("Không lấy được userId từ profile.");

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
        if (!seller?.id) throw new Error("Tài khoản chưa có sellerId.");
        if (!cancelled) setSellerId(seller.id);
      } catch (e) {
        if (!cancelled) {
          console.error("Resolve sellerId failed:", e);
          setError(e?.message || "Không xác định được sellerId.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sellerIdFromUrl, authFetch, navigate]);

  // load categories
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingCats(true);
        const res = await authFetch(apiUrl(API_CONFIG.endpoints.categories), {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
        const list = Array.isArray(data?.result) ? data.result : [];
        const idToName = {};
        list.forEach((c) => {
          if (c?.id) idToName[c.id] = c?.name || c?.id;
        });

        if (!cancelled) {
          setCatIdToName(idToName);
          setCategories(list);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Load categories failed:", e);
          setError((prev) => prev || `Không tải được danh mục: ${e.message}`);
        }
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // load products rồi GIỮ lại: (1) đã xoá, (2) reUpdate = true, (3) PENDING
  useEffect(() => {
    if (!sellerId || loadingCats) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");

        const url = `${
          API_CONFIG.baseUrl
        }/product/searchBySeller/${encodeURIComponent(sellerId)}`;
        const res = await authFetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (res.status === 401) return navigate("/login");

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
        const all = Array.isArray(data?.result) ? data.result : [];

        const filtered = all.filter((p) => {
          const st = String(p?.status || "").toUpperCase();
          const isDiscontinued = DISCONTINUED_STATES.includes(st);
          const isAdminHold = !!p?.reUpdate;
          const isPending = st === "PENDING";
          return isDiscontinued || isAdminHold || isPending;
        });

        if (!cancelled) setRows(filtered);
      } catch (e) {
        if (!cancelled) {
          console.error("Load products failed:", e);
          setError(e?.message || "Không tải được danh sách sản phẩm.");
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sellerId, loadingCats, authFetch, navigate]);

  // ==== Chia theo TAB (3 nhóm) — ưu tiên: PENDING > DISCONTINUED > ADMIN_HOLD ====
  const byTab = useMemo(() => {
    const discontinued = [];
    const adminHold = [];
    const pending = [];

    for (const p of rows) {
      const st = String(p?.status || "").toUpperCase();
      if (st === "PENDING") {
        pending.push(p);
        continue;
      }
      if (DISCONTINUED_STATES.includes(st)) {
        discontinued.push(p);
        continue;
      }
      if (p?.reUpdate === true) {
        adminHold.push(p);
        continue;
      }
    }

    return { discontinued, adminHold, pending };
  }, [rows]);

  // ==== Lấy list theo tab đang chọn ====
  const activeList = useMemo(() => {
    if (active === TABS.DISCONTINUED) return byTab.discontinued;
    if (active === TABS.ADMIN_HOLD) return byTab.adminHold;
    return byTab.pending; // TABS.PENDING
  }, [active, byTab]);

  // ==== Search + Category filter ====
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeList.filter((p) => {
      const nameMatch =
        !q ||
        String(p.name || "")
          .toLowerCase()
          .includes(q);
      const pid =
        p.categoryId ||
        p.category_id ||
        (p.category && typeof p.category === "object" ? p.category.id : "") ||
        "";
      const catMatch = !selectedCatId || pid === selectedCatId;
      return nameMatch && catMatch;
    });
  }, [activeList, query, selectedCatId]);

  // ==== Pagination ====
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [active, pageSize, sellerId, query, selectedCatId]);

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pageRows = filteredRows.slice(startIdx, startIdx + pageSize);

  const goPage = (p) =>
    setPage((prev) => {
      const np = Math.min(totalPages, Math.max(1, p));
      if (np !== prev) requestAnimationFrame(scrollToTop);
      return np;
    });

  useEffect(() => {
    // đảm bảo cuộn khi page/pageSize thay đổi do filter/tab
    scrollToTop();
  }, [page, pageSize, active, selectedCatId, query, scrollToTop]);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("tk-page-hide-scrollbar"); // ẩn UI scrollbar ở <html>
    return () => html.classList.remove("tk-page-hide-scrollbar");
  }, []);

  const renderPageButtons = () => {
    if (totalPages <= 1) return null;
    const btns = [];
    const windowSize = 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);

    if (start > 1) {
      btns.push(
        <button key="p1" className="sp-pg-btn" onClick={() => goPage(1)}>
          1
        </button>
      );
      if (start > 2)
        btns.push(
          <span key="dotsl" className="sp-pg-dots">
            …
          </span>
        );
    }
    for (let i = start; i <= end; i++) {
      btns.push(
        <button
          key={i}
          className={`sp-pg-btn ${i === page ? "active" : ""}`}
          onClick={() => goPage(i)}
        >
          {i}
        </button>
      );
    }
    if (end < totalPages) {
      if (end < totalPages - 1)
        btns.push(
          <span key="dotsr" className="sp-pg-dots">
            …
          </span>
        );
      btns.push(
        <button
          key="plast"
          className="sp-pg-btn"
          onClick={() => goPage(totalPages)}
        >
          {totalPages}
        </button>
      );
    }
    return btns;
  };

  // ==== Resolve category name ====
  const resolveCatName = (p) => {
    const id =
      p.categoryId ||
      p.category_id ||
      (p.category && typeof p.category === "object" ? p.category.id : "") ||
      "";
    const en =
      id && catIdToName[id]
        ? catIdToName[id]
        : p.category?.name || p.category || "";
    const vi = CATEGORY_TRANSLATIONS[en] || en || "—";
    return vi;
  };

  /** ===== Actions ===== */
  const handleEdit = (id) => navigate(`/seller/products/edit/${id}`);

  // Fan overlay
  const openFan = (product) => {
    const urls = (product?.images || [])
      .map((x) => (typeof x === "string" ? x : x?.url))
      .filter(Boolean);
    if (!urls.length) return;
    const mid = Math.floor((urls.length - 1) / 2);
    setFanImages(urls);
    setFanActive(mid);
    setFanOpen(true);
  };
  const closeFan = () => {
    setFanOpen(false);
    setTimeout(() => {
      setFanImages([]);
      setFanActive(0);
    }, 200);
  };

  // Modal biến thể
  const openVariantsModal = (product) => {
    const variants = getVariantRows(product);
    if (!variants.length) return;
    setVarModalData({ productName: product?.name || "Biến thể", variants });
    setVarModalOpen(true);
  };
  const closeVariantsModal = () => setVarModalOpen(false);

  return (
    <div className="sp-wrap sp-page--suspended">
      <div className="sp-head">
        <h1>Sản phẩm có vấn đề</h1>

        {/* Tabs (3 tab) */}
        <div
          className="ls-tabs"
          role="tablist"
          aria-label="Trạng thái sản phẩm"
        >
          <button
            className={`ls-tab ${active === TABS.DISCONTINUED ? "active" : ""}`}
            role="tab"
            aria-selected={active === TABS.DISCONTINUED}
            onClick={() => setActive(TABS.DISCONTINUED)}
          >
            ĐÃ XOÁ
          </button>

          <button
            className={`ls-tab ${active === TABS.ADMIN_HOLD ? "active" : ""}`}
            role="tab"
            aria-selected={active === TABS.ADMIN_HOLD}
            onClick={() => setActive(TABS.ADMIN_HOLD)}
            title="Sản phẩm bị admin tạm ngưng (reUpdate = true)"
          >
            TẠM NGƯNG
          </button>

          <button
            className={`ls-tab ${active === TABS.PENDING ? "active" : ""}`}
            role="tab"
            aria-selected={active === TABS.PENDING}
            onClick={() => setActive(TABS.PENDING)}
            title="Sản phẩm đang chờ duyệt"
          >
            CHỜ DUYỆT
          </button>
        </div>
      </div>

      {/* Toolbar: Search + Category Filter */}
      <div className="sp-searchbar">
        <div className="sp-field">
          <button className="sp-icon-btn" aria-label="Tìm kiếm" type="button">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7"></circle>
              <path d="M21 21l-4.3-4.3"></path>
            </svg>
          </button>
          <input
            className="sp-search-input"
            placeholder="Tìm theo tên sản phẩm…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Ô tìm kiếm sản phẩm"
          />
          {query && (
            <button
              className="sp-clear-btn"
              aria-label="Xoá từ khoá"
              onClick={() => setQuery("")}
              type="button"
            >
              ×
            </button>
          )}
        </div>

        <select
          className="sp-select sp-select-compact"
          value={selectedCatId}
          onChange={(e) => setSelectedCatId(e.target.value)}
          title="Lọc theo danh mục"
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {CATEGORY_TRANSLATIONS[c.name] || c.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="sp-error">{error}</div>}

      <div className="sp-card" ref={cardRef}>
        <div className="sp-table-scroll">
          <table className="sp-table">
            <thead>
              <tr>
                <th style={{ width: 68 }}>STT</th>
                <th>Tên sản phẩm</th>
                <th style={{ width: 50 }}>Ảnh</th>
                <th style={{ width: 220 }}>Biến thể</th>
                <th style={{ width: 90 }}>Số lượng</th>
                <th style={{ width: 120 }}>Danh mục</th>
                <th style={{ width: 120 }}>Ngày tạo</th>
                <th style={{ width: 120 }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={`sk-${i}`} className="is-skeleton">
                    <td>
                      <div className="shimmer h14" />
                    </td>
                    <td>
                      <div className="shimmer h14" />
                    </td>
                    <td>
                      <div className="shimmer h60" />
                    </td>
                    <td>
                      <div className="shimmer h14" />
                    </td>
                    <td>
                      <div className="shimmer h14" />
                    </td>
                    <td>
                      <div className="shimmer h14" />
                    </td>
                    <td>
                      <div className="shimmer h14" />
                    </td>
                    <td>
                      <div className="shimmer h28" />
                    </td>
                  </tr>
                ))
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="sp-empty">
                    {active === TABS.DISCONTINUED
                      ? "Không có sản phẩm đã xoá."
                      : active === TABS.ADMIN_HOLD
                      ? "Không có sản phẩm bị admin tạm ngưng."
                      : "Không có sản phẩm đang chờ duyệt."}
                  </td>
                </tr>
              ) : (
                pageRows.map((p, idx) => {
                  const img = pickImageUrl(p.images);
                  const catName = resolveCatName(p);
                  const variants = getVariantRows(p);
                  const totalQty = variants.reduce(
                    (sum, v) => sum + (Number(v?.quantity) || 0),
                    0
                  );

                  // nhãn trạng thái hiển thị theo tab
                  const statusLabel =
                    active === TABS.DISCONTINUED
                      ? "DISCONTINUED"
                      : active === TABS.PENDING
                      ? "PENDING"
                      : "";
                  const statusClass =
                    active === TABS.DISCONTINUED
                      ? "unavailable"
                      : active === TABS.PENDING
                      ? "warning"
                      : "neutral";

                  return (
                    <tr key={p.id}>
                      <td className="tc">{startIdx + idx + 1}</td>

                      <td className="sp-name">
                        <div className="sp-name-main" title={p.name}>
                          {p.name}
                        </div>
                        <div className={`sp-status ${statusClass}`}>
                          {statusLabel}
                          {active === TABS.ADMIN_HOLD && p?.reUpdate
                            ? " (reUpdate)"
                            : ""}
                        </div>
                      </td>

                      <td className="tc">
                        <button
                          className="sp-thumb sm"
                          onClick={() => openFan(p)}
                          title="Xem ảnh"
                          aria-label="Xem ảnh sản phẩm"
                          style={{ cursor: "zoom-in" }}
                        >
                          <img src={img} alt={p.name} />
                        </button>
                      </td>

                      {/* Biến thể: hiện 1 dòng + xem thêm */}
                      <td className="sp-size">
                        {variants.length === 0 ? (
                          <div className="sp-size-row v">—</div>
                        ) : (
                          <>
                            <div className="sp-size-list no-scroll">
                              <div className="sp-size-row v">
                                <div className="sp-size-line">
                                  <span className="sp-size-badge">
                                    {variantLabel(variants[0])}
                                  </span>
                                </div>
                                <div className="sp-qty-line">
                                  <span className="sp-size-qty">
                                    SL:{" "}
                                    {Number.isFinite(
                                      Number(variants[0]?.quantity)
                                    )
                                      ? Number(variants[0].quantity)
                                      : 0}
                                  </span>
                                </div>
                                <div className="sp-price-line">
                                  {Number.isFinite(
                                    Number(variants[0]?.price)
                                  ) && (
                                    <span className="sp-price">
                                      ₫{fmtVnd(variants[0].price)}
                                    </span>
                                  )}
                                  {Number.isFinite(
                                    Number(variants[0]?.compareAtPrice)
                                  ) && (
                                    <span className="sp-compare">
                                      ₫{fmtVnd(variants[0].compareAtPrice)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {variants.length > 1 && (
                              <button
                                type="button"
                                className="sp-var-more-btn"
                                onClick={() => openVariantsModal(p)}
                                aria-label="Xem tất cả biến thể"
                                title="Xem tất cả biến thể"
                              >
                                Xem thêm {variants.length - 1} biến thể
                              </button>
                            )}
                          </>
                        )}
                      </td>

                      <td className="tr">
                        <span className="qty-badge">{totalQty}</span>
                      </td>

                      <td title={p.categoryId || p.category_id || ""}>
                        {catName}
                      </td>
                      <td>{fmtDate(p.createdAt)}</td>

                      {/* Actions: ẩn cập nhật ở tab PENDING, thay bằng "Đợi duyệt" */}
                      <td>
                        <div className="sp-actions">
                          {active === TABS.PENDING ? (
                            <span
                              className="sp-badge waiting"
                              aria-label="Đợi duyệt"
                              title="Đợi admin duyệt"
                            >
                              Đợi duyệt
                            </span>
                          ) : (
                            <button
                              className="sp-btn ghost icon"
                              onClick={() => handleEdit(p.id)}
                              aria-label="Cập nhật"
                              title="Cập nhật"
                            >
                              <IconEdit />
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

        {/* Pagination (định dạng giống trang trước) */}
        <div className="sp-pagination full-bleed">
          {/* Trái: Tổng */}
          <div className="sp-pg-left">
            Tổng: <b>{total}</b> sản phẩm
          </div>

          {/* Giữa: Prev | [nút số trang] | Next */}
          <div className="sp-pg-middle">
            <button
              className="sp-pg-btn"
              onClick={() => goPage(page - 1)}
              disabled={page <= 1}
              aria-label="Trang trước"
              title="Trang trước"
            >
              ‹
            </button>

            {renderPageButtons()}

            <button
              className="sp-pg-btn"
              onClick={() => goPage(page + 1)}
              disabled={page >= totalPages}
              aria-label="Trang sau"
              title="Trang sau"
            >
              ›
            </button>
          </div>

          {/* Phải: Mỗi trang + combobox */}
          <div className="sp-pg-right">
            <span className="pg-label">Mỗi trang:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) || 10)}
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

      {/* ===== Modal Biến thể ===== */}
      {varModalOpen &&
        createPortal(
          <div
            className="sp-modal-backdrop"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeVariantsModal();
            }}
          >
            <div
              className="sp-modal sp-variant-modal"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h3 className="sp-modal-title">
                Biến thể — {varModalData.productName}
              </h3>

              <div className="sp-variant-list">
                {varModalData.variants.map((v, i) => (
                  <div key={i} className="sp-variant-item">
                    <div className="sp-variant-head">
                      <span className="sp-size-badge">{variantLabel(v)}</span>
                      <span
                        className={`sp-availability ${
                          v?.available ? "ok" : "no"
                        }`}
                      >
                        {v?.available ? "Còn bán" : "Tạm dừng"}
                      </span>
                    </div>
                    <div className="sp-variant-meta">
                      <div>
                        Giá: <b>₫{fmtVnd(v?.price)}</b>{" "}
                        {Number.isFinite(Number(v?.compareAtPrice)) && (
                          <span className="sp-compare-inline">
                            ₫{fmtVnd(v?.compareAtPrice)}
                          </span>
                        )}
                      </div>
                      <div>
                        SL: <b>{Number(v?.quantity ?? 0)}</b>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="sp-modal-actions">
                <button className="sp-btn" onClick={closeVariantsModal}>
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ===== Fan Overlay ===== */}
      {fanOpen && (
        <FanGalleryOverlay
          images={fanImages}
          activeIndex={fanActive}
          onChangeIndex={setFanActive}
          onClose={closeFan}
        />
      )}
    </div>
  );
}

/* =========================
   Fan Gallery (Overlay)
   ========================= */
function FanGalleryOverlay({
  images = [],
  activeIndex = 0,
  onClose,
  onChangeIndex,
}) {
  const stageRef = useRef(null);
  const stepAngle = 12;
  const gapX = 56;
  const baseScale = 0.9;
  const activeScale = 1.0;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowRight")
        onChangeIndex?.(Math.min(images.length - 1, activeIndex + 1));
      else if (e.key === "ArrowLeft")
        onChangeIndex?.(Math.max(0, activeIndex - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, images.length, onClose, onChangeIndex]);

  const onBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  const renderCard = (src, i) => {
    const delta = i - activeIndex;
    const rotate = delta * stepAngle;
    const translateX = delta * gapX;
    const translateY = Math.abs(delta) * 8;
    const scale = i === activeIndex ? activeScale : baseScale;

    return (
      <button
        key={i}
        className={`fan-card ${i === activeIndex ? "active" : ""}`}
        style={{
          transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(${rotate}deg) scale(${scale})`,
          zIndex:
            100 + (i === activeIndex ? 999 : images.length - Math.abs(delta)),
        }}
        onClick={(e) => {
          e.stopPropagation();
          onChangeIndex?.(i);
        }}
        aria-label={`Ảnh ${i + 1}/${images.length}`}
      >
        <img src={src} alt={`img-${i}`} draggable="false" />
      </button>
    );
  };

  return createPortal(
    <div className="fan-backdrop" onMouseDown={onBackdropClick}>
      <div
        className="fan-stage"
        ref={stageRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="fan-close"
          onClick={onClose}
          aria-label="Đóng xem ảnh"
        >
          ✕
        </button>

        <div className="fan-cards">
          {images.map((src, i) => renderCard(src, i))}
        </div>

        <div className="fan-nav">
          <button
            className="fan-nav-btn"
            disabled={activeIndex <= 0}
            onClick={() => onChangeIndex?.(Math.max(0, activeIndex - 1))}
            aria-label="Ảnh trước"
          >
            ‹
          </button>
          <button
            className="fan-nav-btn"
            disabled={activeIndex >= images.length - 1}
            onClick={() =>
              onChangeIndex?.(Math.min(images.length - 1, activeIndex + 1))
            }
            aria-label="Ảnh sau"
          >
            ›
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
