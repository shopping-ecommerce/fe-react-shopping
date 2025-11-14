import React, { useEffect, useMemo, useState, useContext, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import {
  fetchSellerViolations,
  submitAppeal,
  fetchAppealsBySeller,
} from "../../../services/violationService";
import { fetchProductDetail } from "../../../services/products";
import "../../../styles/SellerViolationsPage.css";
import { AuthContext } from "../../../contexts/AuthContext";
import Portal from "../product/Portal";
import { showToast } from "../../../utils/toast";

/* ===== Helpers ===== */
const useQuery = () => new URLSearchParams(useLocation().search);

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

const badgeColorByType = (t) => {
  switch ((t || "").toUpperCase()) {
    case "FAKE_PRODUCT":
      return "#ef4444";
    case "ILLEGAL_PRODUCT":
      return "#a855f7";
    case "POLICY_VIOLATION":
      return "#3b82f6";
    case "SPAM":
      return "#f59e0b";
    case "OTHER":
      return "#10b981";
    default:
      return "#6b7280";
  }
};

const normalizeImages = (p) =>
  Array.isArray(p?.images)
    ? p.images
        .map((it) => (typeof it === "string" ? it : it?.url || it?.link || ""))
        .filter(Boolean)
    : [];

const getPrice = (p) => {
  const c = [
    p?.price,
    p?.salePrice,
    p?.basePrice,
    p?.prices?.current,
    p?.variants?.[0]?.price,
    p?.sizes?.[0]?.price,
  ].filter((x) => x !== undefined && x !== null);
  const v = c.length ? Number(c[0]) : null;
  return v == null || Number.isNaN(v) ? null : v;
};
const fmtPrice = (v) => (v == null ? "—" : Number(v).toLocaleString("vi-VN"));

const getTotalStock = (p) => {
  if (p?.stock != null) return Number(p.stock);
  if (p?.quantity != null) return Number(p.quantity);
  if (Array.isArray(p?.variants))
    return p.variants.reduce((s, v) => s + Number(v?.quantity ?? 0), 0);
  if (Array.isArray(p?.sizes))
    return p.sizes.reduce((s, v) => s + Number(v?.quantity ?? 0), 0);
  return null;
};

const renderStatus = (s) => {
  const v = (s || "").toLowerCase();
  const map = {
    active: "success",
    available: "success",
    suspended: "danger",
    inactive: "secondary",
    draft: "secondary",
    pending: "warning",
    banned: "danger",
    hidden: "dark",
    soldout: "info",
    outofstock: "info",
  };
  const color = map[v] || "primary";
  return <span className={`sv-badge status-${color}`}>{s || "N/A"}</span>;
};

const EyeIcon = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ===== Page ===== */
export default function SellerViolationsPage() {
  const params = useParams();
  const query = useQuery();
  const { authFetch } = useContext(AuthContext) || {};

  const sellerIdFromRoute = params?.sellerId || query.get("sellerId") || null;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  // UI state
  const [qType, setQType] = useState("ALL");
  const [sortBy, setSortBy] = useState("reported_at_desc");

  // product name cache
  const [prodNameMap, setProdNameMap] = useState({});

  // product modal state
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodError, setProdError] = useState("");
  const [prodData, setProdData] = useState(null);
  const [prodMainImg, setProdMainImg] = useState(null);

  // Đánh dấu report đã gửi khiếu nại (id -> 'pending')
  const [appealedMap, setAppealedMap] = useState({});

  // Map trạng thái khiếu nại theo violation_record_id
  const [appealStatusMap, setAppealStatusMap] = useState({}); // { [violation_record_id]: "PENDING"|"APPROVED"|"REJECTED" }

  /* ===== Load violations ===== */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const { items } = await fetchSellerViolations(
          sellerIdFromRoute || undefined
        );
        if (cancelled) return;
        setRows(items || []);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Không tải được báo cáo vi phạm");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sellerIdFromRoute]);

  /* ===== Load trạng thái khiếu nại cho các violation sau khi rows có ===== */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!rows?.length) {
          setAppealStatusMap({});
          return;
        }
        const appeals = await fetchAppealsBySeller(authFetch);
        if (cancelled) return;
        const map = {};
        for (const a of appeals) {
          const vrid = a?.violation_record_id || a?.violationRecordId;
          const st = (a?.status || "").toUpperCase();
          if (vrid) map[vrid] = st;
        }
        setAppealStatusMap(map);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rows, authFetch]);

  /* ===== Prefetch product names ===== */
  useEffect(() => {
    const ids = Array.from(
      new Set(
        rows
          .map((r) => r.product_id)
          .filter((x) => typeof x === "string" && x.trim())
      )
    );
    const missing = ids.filter((id) => !prodNameMap[id]);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const updates = {};
      for (const id of missing) {
        try {
          const d = await fetchProductDetail(authFetch, id);
          updates[id] = d?.name || d?.productName || `(Sản phẩm ${id})`;
        } catch {
          updates[id] = `(Sản phẩm ${id})`;
        }
      }
      if (!cancelled && Object.keys(updates).length) {
        setProdNameMap((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  /* ===== Body scroll lock khi mở modals ===== */
  const [appealOpen, setAppealOpen] = useState(false); // declare here so effect sees it
  useEffect(() => {
    const anyOpen = prodModalOpen || appealOpen;
    if (!anyOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [prodModalOpen, appealOpen]);

  /* ===== Filtering/Grouping ===== */
  const types = useMemo(() => {
    const s = new Set(rows.map((r) => r.violation_type).filter(Boolean));
    return ["ALL", ...Array.from(s)];
  }, [rows]);

  const filtered = useMemo(() => {
    let x = [...rows];
    if (qType !== "ALL") {
      x = x.filter(
        (r) => (r.violation_type || "").toUpperCase() === qType.toUpperCase()
      );
    }
    switch (sortBy) {
      case "reported_at_desc":
        x.sort(
          (a, b) => new Date(b.reported_at || 0) - new Date(a.reported_at || 0)
        );
        break;
      case "number_desc":
        x.sort((a, b) => (b.violation_number || 0) - (a.violation_number || 0));
        break;
      case "number_asc":
        x.sort((a, b) => (a.violation_number || 0) - (b.violation_number || 0));
        break;
      default:
        break;
    }
    return x;
  }, [rows, qType, sortBy]);

  const groupedByNumber = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const n = Number(r.violation_number ?? 0);
      const key = Number.isFinite(n) ? n : 0;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  const hueByTier = (n) => (n * 53) % 360;

  /* ===== Product modal ===== */
  const openProductModal = async (productId) => {
    if (!productId) return;
    setProdError("");
    setProdLoading(true);
    setProdData(null);
    setProdMainImg(null);
    setProdModalOpen(true);
    try {
      const d = await fetchProductDetail(authFetch, productId);
      setProdData(d || null);
      const imgs = normalizeImages(d);
      setProdMainImg(imgs[0] || null);
    } catch (e) {
      setProdError(e?.message || "Không tải được chi tiết sản phẩm");
    } finally {
      setProdLoading(false);
    }
  };
  const closeProductModal = () => setProdModalOpen(false);

  // tổng tồn kho từ variants
  const totalVariantQty = (prodData?.variants || []).reduce(
    (s, v) => s + Number(v?.quantity ?? 0),
    0
  );
  const totalStock = getTotalStock(prodData) ?? totalVariantQty ?? null;

  /* ===== Appeal (khiếu nại) modal state & handlers ===== */
  const [appealFor, setAppealFor] = useState(null); // record vi phạm đang khiếu nại
  const [appealReason, setAppealReason] = useState("");
  const [appealFiles, setAppealFiles] = useState([]); // File[]
  const [appealPreviews, setAppealPreviews] = useState([]); // object URLs
  const [appealError, setAppealError] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const appealFileRef = useRef(null);

  // cleanup previews
  useEffect(() => {
    return () => {
      appealPreviews.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [appealPreviews]);

  const openAppealModal = (violation) => {
    setAppealFor(violation);
    setAppealReason("");
    setAppealFiles([]);
    setAppealPreviews([]);
    setAppealError("");
    setAppealOpen(true);
  };
  const closeAppealModal = () => {
    setAppealOpen(false);
    setAppealFor(null);
    setAppealReason("");
    // revoke object urls
    appealPreviews.forEach((u) => u && URL.revokeObjectURL(u));
    setAppealPreviews([]);
    setAppealFiles([]);
    setAppealError("");
  };

  const onPickAppealFiles = (e) => {
    const list = Array.from(e.target.files || []).filter((f) =>
      f.type?.startsWith("image/")
    );
    if (!list.length) return;
    setAppealFiles((prev) => [...prev, ...list]);
    const urls = list.map((f) => URL.createObjectURL(f));
    setAppealPreviews((prev) => [...prev, ...urls]);
  };
  const removeAppealFileAt = (idx) => {
    setAppealFiles((prev) => prev.filter((_, i) => i !== idx));
    setAppealPreviews((prev) => {
      const cp = [...prev];
      const [u] = cp.splice(idx, 1);
      if (u) URL.revokeObjectURL(u);
      return cp;
    });
  };

  const handleAppealSubmit = async () => {
    if (!appealFor) return;
    if (!appealReason.trim()) {
      setAppealError("Vui lòng nhập lý do khiếu nại.");
      return;
    }
    setAppealError("");
    try {
      setAppealSubmitting(true);
      await submitAppeal({
        sellerId: sellerIdFromRoute || undefined, // nếu có thì kèm theo
        violationRecordId: appealFor.id,
        productId: appealFor.product_id,
        reason: appealReason.trim(),
        evidences: appealFiles,
        authFetch, // ưu tiên dùng authFetch context
      });

      // toast thành công
      showToast?.({
        title: "Khiếu nại đã gửi",
        text: "Chúng tôi sẽ xem xét và phản hồi sớm.",
        type: "success",
        duration: 2600,
      });

      // đánh dấu nút của báo cáo này -> Đợi giải quyết + disabled (local)
      setAppealedMap((prev) => ({ ...prev, [appealFor.id]: "pending" }));

      // đồng thời update map trạng thái khiếu nại
      setAppealStatusMap((prev) => ({ ...prev, [appealFor.id]: "PENDING" }));

      // đóng & reset
      closeAppealModal();
    } catch (e) {
      setAppealError(e?.message || "Gửi khiếu nại thất bại.");
      showToast?.({
        title: "Gửi khiếu nại thất bại",
        text: e?.message || "Vui lòng thử lại.",
        type: "error",
      });
    } finally {
      setAppealSubmitting(false);
    }
  };

  return (
    <div className="sv-wrap">
      {/* Top header */}
      <div className="sv-top">
        <div className="sv-top-left">
          <h2 className="sv-title">
            Lịch sử báo cáo vi phạm{" "}
            {sellerIdFromRoute ? (
              <small className="muted">• Seller: {sellerIdFromRoute}</small>
            ) : null}
          </h2>
        </div>

        <div className="sv-toolbar">
          <label className="sv-field">
            <span>Loại vi phạm</span>
            <select value={qType} onChange={(e) => setQType(e.target.value)}>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="sv-field">
            <span>Sắp xếp</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="reported_at_desc">Mới nhất</option>
              <option value="number_desc">Số vi phạm ↓</option>
              <option value="number_asc">Số vi phạm ↑</option>
            </select>
          </label>

          <div className="sv-count-chip" title="Tổng số báo cáo đang hiển thị">
            <span className="sv-count-dot" />
            Tổng: <b>{filtered.length}</b>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="sv-loading">Đang tải…</div>
      ) : err ? (
        <div className="sv-error">{err}</div>
      ) : groupedByNumber.length === 0 ? (
        <div className="sv-empty">Không có báo cáo vi phạm.</div>
      ) : (
        <div className="sv-tiers">
          {groupedByNumber.map(([num, items]) => (
            <section
              key={num}
              className="sv-tier-section"
              style={{ ["--tier-hue"]: hueByTier(num) }}
            >
              <div className="sv-tier-head">
                <div className="sv-tier-chip">
                  <span className="sv-tier-dot" />
                  Lần {num}
                </div>
                <div className="sv-tier-meta">{items.length} báo cáo</div>
              </div>

              <div className="sv-row">
                {items.map((r) => {
                  const pid = r.product_id;
                  const prodName = pid ? prodNameMap[pid] : null;
                  const appealed = !!appealedMap[r.id];
                  const st = (appealStatusMap[r.id] || "").toUpperCase();

                  return (
                    <div key={r.id} className="sv-card sv-card-tier">
                      <div className="sv-head">
                        <span
                          className="sv-badge-dot"
                          style={{
                            background: badgeColorByType(r.violation_type),
                          }}
                          title={r.violation_type}
                        />
                        <div className="sv-title-type">
                          {r.violation_type || "VIOLATION"}
                        </div>
                        <div className="sv-number">
                          Lần vi phạm: <b>{r.violation_number ?? "—"}</b>
                        </div>
                      </div>

                      {/* Sản phẩm (tên + eye icon) */}
                      <div className="sv-prodline">
                        <span className="sv-prodlabel">Sản phẩm:</span>{" "}
                        {pid ? (
                          <>
                            <span className="sv-prodname">
                              {prodName || pid}
                            </span>
                            <button
                              type="button"
                              className="sv-eye-btn"
                              title="Xem chi tiết sản phẩm"
                              onClick={() => openProductModal(pid)}
                              aria-label="Xem chi tiết sản phẩm"
                            >
                              <EyeIcon />
                            </button>
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </div>

                      {/* Lý do cùng một hàng */}
                      <div className="sv-reason">
                        <span className="sv-reason-label">
                          Lý do bị báo cáo:
                        </span>
                        <span className="sv-reason-text">
                          {r.description || "(Không có mô tả)"}
                        </span>
                      </div>

                      <div className="sv-meta">
                        Thời gian: {fmtDateTime(r.reported_at)}
                        <span className="muted">ID: {r.id}</span>
                      </div>

                      {Array.isArray(r.evidence_urls) &&
                        r.evidence_urls.length > 0 && (
                          <>
                            <div className="sv-evid-title">
                              Bằng chứng vi phạm
                            </div>
                            <div className="sv-evid-grid">
                              {r.evidence_urls.map((url, idx) => (
                                <a
                                  key={idx}
                                  className="sv-evid-item"
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Xem minh chứng"
                                >
                                  <img
                                    className="sv-evid-img"
                                    src={url}
                                    alt={`evidence-${idx + 1}`}
                                    onError={(e) => {
                                      e.currentTarget.style.objectFit =
                                        "contain";
                                      e.currentTarget.src =
                                        "data:image/svg+xml;charset=utf-8," +
                                        encodeURIComponent(
                                          `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='100%' height='100%' fill='#f3f4f6'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='14' fill='#9ca3af'>Không hiển thị được ảnh</text></svg>`
                                        );
                                    }}
                                  />
                                </a>
                              ))}
                            </div>
                          </>
                        )}

                      {/* Nút khiếu nại cho đúng lần vi phạm này */}
                      <div className="sv-card-actions">
                        {st === "REJECTED" ? (
                          <button
                            type="button"
                            className="sv-appeal-inline sv-appeal-rejected"
                            disabled
                          >
                            Bị từ chối
                          </button>
                        ) : st === "PENDING" || appealed ? (
                          <button
                            type="button"
                            className="sv-appeal-inline sv-appeal-wait"
                            title="Đã gửi khiếu nại – chờ xử lý"
                            aria-label="Đã gửi khiếu nại – chờ xử lý"
                            disabled
                          >
                            Đợi giải quyết
                          </button>
                        ) : st === "APPROVED" ? null : (
                          <button
                            type="button"
                            className="sv-appeal-inline"
                            onClick={() => openAppealModal(r)}
                            title="Khiếu nại báo cáo này"
                            aria-label="Khiếu nại báo cáo này"
                          >
                            Khiếu nại
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ===== Modal chi tiết sản phẩm ===== */}
      {prodModalOpen && (
        <Portal>
          <div className="sv-modal-backdrop" onClick={closeProductModal}>
            <div
              className="sv-modal sv-modal-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sv-modal-header">
                <div className="sv-modal-title">
                  {prodData?.name ||
                    prodData?.productName ||
                    "Chi tiết sản phẩm"}
                </div>
                <button
                  className="sv-modal-close"
                  onClick={closeProductModal}
                  aria-label="Đóng"
                >
                  ×
                </button>
              </div>

              <div className="sv-modal-body">
                {prodLoading ? (
                  <div className="sv-loading">Đang tải chi tiết…</div>
                ) : prodError ? (
                  <div className="sv-error">{prodError}</div>
                ) : !prodData ? (
                  <div className="sv-empty">Không có dữ liệu sản phẩm.</div>
                ) : (
                  <div className="pm-wrap">
                    <div className="pm-left">
                      <div className="pm-mainimg">
                        {prodMainImg ? (
                          <img src={prodMainImg} alt="main" />
                        ) : (
                          <div className="pm-mainimg placeholder">No image</div>
                        )}
                      </div>
                      <div className="pm-thumbs">
                        {normalizeImages(prodData).map((url, i) => (
                          <button
                            className="pm-thumb"
                            key={i}
                            type="button"
                            onClick={() => setProdMainImg(url)}
                            title="Xem ảnh"
                          >
                            <img src={url} alt={`thumb-${i}`} />
                          </button>
                        ))}
                        {normalizeImages(prodData).length === 0 && (
                          <div className="pm-thumb placeholder">No image</div>
                        )}
                      </div>
                    </div>

                    <div className="pm-right">
                      <div className="pm-row">
                        <div className="pm-label">Giá</div>
                        <div className="pm-value">
                          {fmtPrice(getPrice(prodData))} đ
                        </div>
                      </div>
                      <div className="pm-row">
                        <div className="pm-label">Giá niêm yết</div>
                        <div className="pm-value">
                          {fmtPrice(prodData?.variants?.[0]?.compareAtPrice)}
                        </div>
                      </div>
                      <div className="pm-row">
                        <div className="pm-label">Trạng thái</div>
                        <div className="pm-value">
                          {renderStatus(prodData?.status)}
                        </div>
                      </div>
                      <div className="pm-row">
                        <div className="pm-label">Seller</div>
                        <div className="pm-value">
                          {prodData?.sellerId || "—"}
                        </div>
                      </div>
                      <div className="pm-row">
                        <div className="pm-label">Category</div>
                        <div className="pm-value">
                          {prodData?.categoryId || "—"}
                        </div>
                      </div>
                      <div className="pm-row">
                        <div className="pm-label">Tồn kho</div>
                        <div className="pm-value">
                          {totalStock == null ? "—" : totalStock}
                        </div>
                      </div>
                      <div className="pm-row">
                        <div className="pm-label">Mã sản phẩm</div>
                        <div className="pm-value">
                          {prodData?.id || prodData?._id}
                        </div>
                      </div>
                      <div className="pm-row">
                        <div className="pm-label">Tạo lúc</div>
                        <div className="pm-value">
                          {fmtDateTime(prodData?.createdAt)}
                        </div>
                      </div>
                      <div className="pm-row">
                        <div className="pm-label">Cập nhật</div>
                        <div className="pm-value">
                          {fmtDateTime(prodData?.updatedAt)}
                        </div>
                      </div>
                      <div className="pm-row pm-row-full">
                        <div className="pm-label">Mô tả</div>
                        <div className="pm-value prod-desc">
                          {prodData?.description || "—"}
                        </div>
                      </div>

                      {Array.isArray(prodData?.optionDefs) &&
                        prodData.optionDefs.length > 0 && (
                          <div className="pm-block">
                            <div className="pm-block-title">Thuộc tính</div>
                            <ul className="pm-list">
                              {prodData.optionDefs.map((op, idx) => (
                                <li key={idx}>
                                  <b>{op?.name}:</b>{" "}
                                  {(op?.values || []).join(", ")}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                      {Array.isArray(prodData?.variants) &&
                        prodData.variants.length > 0 && (
                          <div className="pm-block">
                            <div className="pm-block-title">Biến thể</div>
                            <div className="pm-table-wrap">
                              <table className="pm-table">
                                <thead>
                                  <tr>
                                    <th>Tùy chọn</th>
                                    <th>Giá</th>
                                    <th>Giá niêm yết</th>
                                    <th>Số lượng</th>
                                    <th>Khả dụng</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {prodData.variants.map((v, i) => (
                                    <tr key={i}>
                                      <td className="pm-opts">
                                        {Object.entries(v?.options || {}).map(
                                          ([k, val]) => (
                                            <span key={k} className="pm-opt">
                                              {k}: {val}
                                            </span>
                                          )
                                        )}
                                      </td>
                                      <td>{fmtPrice(v?.price)}</td>
                                      <td>{fmtPrice(v?.compareAtPrice)}</td>
                                      <td>{v?.quantity ?? 0}</td>
                                      <td>{v?.available ? "Có" : "Không"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>

              <div className="sv-modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={closeProductModal}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ===== Modal Khiếu nại (center) ===== */}
      {appealOpen && (
        <Portal>
          <div className="sv-modal-backdrop" onClick={closeAppealModal}>
            {/* thêm class sv-modal-appeal để set size 840x465 */}
            <div
              className="sv-modal sv-modal-center sv-modal-appeal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sv-modal-header">
                <div className="sv-modal-title">Khiếu nại báo cáo</div>
                <button
                  className="sv-modal-close"
                  onClick={closeAppealModal}
                  aria-label="Đóng"
                >
                  ×
                </button>
              </div>

              <div className="sv-modal-body">
                {/* Info nhanh về record */}
                <div className="ap-info">
                  <div>
                    <b>Mã báo cáo:</b> {appealFor?.id || "—"}
                  </div>
                  <div>
                    <b>Mã sản phẩm:</b> {appealFor?.product_id || "—"}
                  </div>
                  <div>
                    <b>Loại vi phạm:</b> {appealFor?.violation_type || "—"}
                  </div>
                </div>

                {/* Lý do */}
                <label className="ap-label">Lý do khiếu nại *</label>
                <textarea
                  className="ap-textarea"
                  rows={4}
                  placeholder="Nhập lý do (ví dụ: Tôi có bằng chứng bản quyền, sản phẩm chính hãng...)"
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                />

                {/* Nút chọn ảnh đẹp */}
                <label className="ap-label" style={{ marginTop: 10 }}>
                  Ảnh minh chứng (tuỳ chọn)
                </label>
                <div className="ap-upload">
                  <button
                    type="button"
                    className="ap-upload-btn"
                    onClick={() => appealFileRef.current?.click()}
                    title="Chọn ảnh"
                  >
                    <span className="ap-upload-icon" aria-hidden>
                      📎
                    </span>
                    <span>Chọn ảnh</span>
                  </button>
                  <span className="ap-upload-note">
                    Hỗ trợ JPG/PNG, có thể chọn nhiều ảnh
                  </span>
                  <input
                    ref={appealFileRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={onPickAppealFiles}
                    className="ap-file-hidden"
                  />
                </div>

                {/* Preview ảnh bên dưới, có nút x để xoá */}
                {appealPreviews.length > 0 && (
                  <div className="ap-grid">
                    {appealPreviews.map((u, i) => (
                      <div key={i} className="ap-item">
                        <img src={u} alt={`ev-${i}`} />
                        <button
                          type="button"
                          className="ap-remove"
                          onClick={() => removeAppealFileAt(i)}
                          aria-label="Xoá"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {appealError && (
                  <div className="sv-error" style={{ marginTop: 10 }}>
                    {appealError}
                  </div>
                )}
              </div>

              <div className="sv-modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={closeAppealModal}
                  disabled={appealSubmitting}
                >
                  Hủy
                </button>
                <button
                  className="btn btn-primary ap-submit"
                  onClick={handleAppealSubmit}
                  disabled={appealSubmitting}
                  title="Gửi khiếu nại"
                >
                  {appealSubmitting ? "Đang gửi..." : "Gửi khiếu nại"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
