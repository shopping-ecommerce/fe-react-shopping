import React, {
  useEffect,
  useMemo,
  useState,
  useContext,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../../../contexts/AuthContext";
import { deleteProductBySeller } from "../../../services/products";
import { API_CONFIG, apiUrl } from "../../../config/api";
import "../../../styles/SellerProductsTable.css";

/** ===== Toast helpers (dùng toast bus bạn đã cài) ===== */
const getToastAPI = () => {
  const W = typeof window !== "undefined" ? window : globalThis;
  const bus = W.__appToastBus;
  return {
    show: (opts) => (bus?.show ? bus.show(opts) : null),
    confirm: (opts) =>
      bus?.confirm ? bus.confirm(opts) : Promise.resolve(true),
  };
};
const { show: showToast, confirm: confirmToast } = getToastAPI();

/** ===== Icon components ===== */
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

const IconTrash = () => (
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
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

/** ===== Bản dịch danh mục (fallback) ===== */
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

// Ảnh đầu tiên không phải video
const pickImageUrl = (images = []) =>
  (images || [])
    .map((it) => (typeof it === "string" ? it : it?.url))
    .find((u) => typeof u === "string" && !u.toLowerCase().endsWith(".mp4")) ||
  "/img/default.png";

/** ======= Helpers cho variants (API mới) ======= */
const getVariantRows = (p) => (Array.isArray(p?.variants) ? p.variants : []);
// "Kích thước: 33CM / Màu sắc: Đen"
const variantLabel = (v) => {
  const opts = v?.options || {};
  const pairs = Object.entries(opts);
  if (!pairs.length) return "—";
  return pairs.map(([k, val]) => `${k}: ${val}`).join(" / ");
};
const fmtVnd = (n) => Number(n ?? 0).toLocaleString("vi-VN");

export default function SellerProductsTable() {
  const cardRef = useRef(null);

  const scrollToTop = useCallback(() => {
    const el = cardRef.current;
    if (!el) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Nếu có header cố định, chỉnh offset ở đây
    const HEADER_OFFSET = 0; // ví dụ 64 nếu có topbar cao 64px
    const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, []);
  const params = useParams();
  const navigate = useNavigate();
  const { authFetch } = useContext(AuthContext);

  const sellerIdFromUrl = params?.sellerId || "";
  const [sellerId, setSellerId] = useState(sellerIdFromUrl);

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

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteReason, setDeleteReason] = useState("Không còn sản xuất nữa");
  const [deleting, setDeleting] = useState(false);

  // Fan overlay state
  const [fanOpen, setFanOpen] = useState(false);
  const [fanImages, setFanImages] = useState([]);
  const [fanActive, setFanActive] = useState(0);

  // ===== Modal biến thể =====
  const [varModalOpen, setVarModalOpen] = useState(false);
  const [varModalData, setVarModalData] = useState({
    productName: "",
    variants: [],
  });

  // Khóa scroll body khi mở modal xoá / overlay ảnh / modal biến thể
  useEffect(() => {
    if (showDeleteModal || fanOpen || varModalOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [showDeleteModal, fanOpen, varModalOpen]);

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

  // load products (API mới: /product/searchBySeller/{sellerId})
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
        const list = Array.isArray(data?.result) ? data.result : [];
        if (!cancelled) setRows(list);
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

  // helpers
  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleString("vi-VN", { hour12: false });
    } catch {
      return iso || "";
    }
  };

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

  // filters: CHỈ hiện sản phẩm AVAILABLE + khớp search/category
  const filteredRows = useMemo(() => {
    const t = query.trim().toLowerCase();
    return rows.filter((p) => {
      const isAvailable = String(p?.status || "").toUpperCase() === "AVAILABLE";
      if (!isAvailable) return false;

      const nameMatch =
        !t ||
        String(p?.name || "")
          .toLowerCase()
          .includes(t);

      const pid =
        p?.categoryId || p?.category_id || (p?.category && p.category.id) || "";
      const catMatch = !selectedCatId || pid === selectedCatId;

      return nameMatch && catMatch;
    });
  }, [rows, query, selectedCatId]);

  // pagination
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [pageSize, sellerId, query, selectedCatId]);

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pageRows = filteredRows.slice(startIdx, startIdx + pageSize);
  const goPage = (p) => {
    const np = Math.min(totalPages, Math.max(1, p));
    if (np !== page) {
      setPage(np);
      // cuộn lên đầu khi đổi trang
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

  /** ===== Edit/Delete handlers ===== */
  const handleEdit = (id) => navigate(`/seller/products/edit/${id}`);

  const openDeleteModal = useCallback(
    async (id) => {
      const ok = await confirmToast?.({
        title: "Xoá sản phẩm?",
        text: "Hành động này sẽ thu hồi sản phẩm khỏi gian hàng.",
        confirmText: "Tiếp tục",
        cancelText: "Huỷ",
        type: "warning",
      });
      if (!ok) return;

      setDeleteTargetId(id);
      setDeleteReason("Không còn sản xuất nữa");
      setShowDeleteModal(true);
    },
    [confirmToast]
  );

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    const prev = rows;
    const next = prev.filter((p) => p.id !== deleteTargetId);
    setRows(next); // optimistic

    try {
      await deleteProductBySeller(
        authFetch,
        deleteTargetId,
        deleteReason?.trim()
      );
      showToast?.({
        title: "Đã xoá sản phẩm",
        type: "success",
        duration: 2500,
      });
      setShowDeleteModal(false);
      setDeleteTargetId(null);
      setDeleteReason("");
    } catch (e) {
      console.error("Delete failed:", e);
      setRows(prev); // rollback
      showToast?.({
        title: "Xoá sản phẩm thất bại",
        text: e?.message || "Vui lòng thử lại sau.",
        type: "error",
        duration: 3500,
      });
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    if (deleting) return;
    setShowDeleteModal(false);
    setDeleteTargetId(null);
  };

  // ESC/Ctrl+Enter trong modal xoá
  useEffect(() => {
    if (!showDeleteModal) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelDelete();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") {
        e.preventDefault();
        if (!deleting) confirmDelete();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDeleteModal, deleting]);

  // ====== Fan overlay handlers ======
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

  // ====== Modal biến thể handlers ======
  const openVariantsModal = (product) => {
    const variants = getVariantRows(product);
    if (!variants.length) return;
    setVarModalData({ productName: product?.name || "Biến thể", variants });
    setVarModalOpen(true);
  };
  const closeVariantsModal = () => {
    setVarModalOpen(false);
  };

  /** ===== Render ===== */
  return (
    <div className="sp-wrap">
      <div className="sp-head">
        <h1>Danh sách sản phẩm của shop</h1>
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
                <th style={{ width: 100 }}>Tên sản phẩm</th>
                <th style={{ width: 50 }}>Ảnh</th>
                <th style={{ width: 200 }}>Biến thể</th>
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
                    {loadingCats ? "Đang tải…" : "Không có sản phẩm phù hợp"}
                  </td>
                </tr>
              ) : (
                pageRows.map((p, idx) => {
                  const img = pickImageUrl(p.images);
                  const catName = resolveCatName(p);

                  // === API mới ===
                  const variants = getVariantRows(p);
                  const totalQty = variants.reduce(
                    (sum, v) => sum + (Number(v?.quantity) || 0),
                    0
                  );

                  return (
                    <tr key={p.id}>
                      <td className="tc">{startIdx + idx + 1}</td>

                      <td className="sp-name">
                        <div className="sp-name-main" title={p.name}>
                          {p.name}
                        </div>
                        <div
                          className={`sp-status ${
                            p.status?.toLowerCase() || ""
                          }`}
                        >
                          {p.status || "—"}
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

                      {/* Biến thể: chỉ hiện 1 biến thể đầu + nút xem thêm (modal) */}
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
                      <td>
                        <div className="sp-actions">
                          <button
                            className="sp-btn ghost icon"
                            onClick={() => handleEdit(p.id)}
                            aria-label="Cập nhật"
                            title="Cập nhật"
                          >
                            <IconEdit />
                          </button>
                          <button
                            className="sp-btn danger icon"
                            onClick={() => openDeleteModal(p.id)}
                            aria-label="Xóa"
                            title="Xóa"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="sp-pagination full-bleed">
          {/* Trái: Tổng */}
          <div className="sp-pg-left">
            Tổng: <b>{total}</b> sản phẩm
          </div>

          {/* Giữa: Prev | [1 … 5] | Next */}
          <div className="sp-pg-middle">
            <button
              className="sp-pg-btn"
              onClick={() => goPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              aria-label="Trang trước"
              title="Trang trước"
            >
              ‹
            </button>

            {renderPageButtons()}

            <button
              className="sp-pg-btn"
              onClick={() => goPage(Math.min(totalPages, page + 1))}
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

      {/* ===== Delete Modal ===== */}
      {showDeleteModal &&
        createPortal(
          <div
            className="sp-modal-backdrop"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !deleting) cancelDelete();
            }}
          >
            <div className="sp-modal" onMouseDown={(e) => e.stopPropagation()}>
              <h3 className="sp-modal-title">Xác nhận xoá sản phẩm</h3>
              <p className="sp-modal-text">
                Vui lòng nhập lý do xoá (không bắt buộc):
              </p>
              <textarea
                className="sp-input sp-textarea"
                rows={3}
                placeholder="Ví dụ: Không còn sản xuất nữa…"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                disabled={deleting}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                data-gramm="false"
                data-gramm_editor="false"
                data-grammarly="false"
              />
              <div className="sp-modal-actions">
                <button
                  className="sp-btn ghost"
                  onClick={cancelDelete}
                  disabled={deleting}
                >
                  Huỷ
                </button>
                <button
                  className="sp-btn danger"
                  onClick={confirmDelete}
                  disabled={deleting}
                >
                  {deleting ? "Đang xoá…" : "Xoá"}
                </button>
              </div>
              <div className="sp-modal-hint">
                <small>
                  Gợi ý: Nhấn <b>Ctrl/⌘ + Enter</b> để xác nhận nhanh
                </small>
              </div>
            </div>
          </div>,
          document.body
        )}

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

  // Ẩn UI scrollbar ngoài cùng cho riêng trang này (vẫn cuộn bình thường)
useEffect(() => {
  const html = document.documentElement;
  html.classList.add("tk-page-hide-scrollbar");
  return () => html.classList.remove("tk-page-hide-scrollbar");
}, []);


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
