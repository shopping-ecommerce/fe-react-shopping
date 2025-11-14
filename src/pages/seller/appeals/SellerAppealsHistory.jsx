import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../../contexts/AuthContext";
import { apiUrl } from "../../../config/api";
import { getCurrentSellerId } from "../../../services/violationService";
import Portal from "../product/Portal";
import "../../../styles/SellerViolationsPage.css";

/* ===== Helpers ===== */
const safeJson = async (res) => {
  const t = await res.text();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return { message: t };
  }
};

const fmtDateTime = (iso) => {
  if (!iso) return "—";
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

const statusTextVi = (s) => {
  const v = (s || "").toUpperCase();
  if (v === "PENDING") return "Đang chờ";
  if (v === "APPROVED") return "Đã chấp thuận";
  if (v === "REJECTED") return "Bị từ chối";
  return "Không xác định";
};
const statusClass = (s) => {
  const v = (s || "").toUpperCase();
  if (v === "PENDING") return "status-warning";
  if (v === "APPROVED") return "status-success";
  if (v === "REJECTED") return "status-danger";
  return "status-secondary";
};

const pickAllImageUrls = (images = []) =>
  (Array.isArray(images) ? images : [])
    .map((it) => (typeof it === "string" ? it : it?.url))
    .filter((u) => typeof u === "string" && u && !u.toLowerCase().endsWith(".mp4"));

export default function SellerAppealsHistory() {
  const { authFetch } = useContext(AuthContext) || {};

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");

  // View modal state
  const [viewOpen, setViewOpen] = useState(false);
  const [current, setCurrent] = useState(null);

  // Product detail cho modal
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [productDetail, setProductDetail] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  // fetch appeals
  const fetchData = async () => {
    setLoading(true);
    setErr("");
    try {
      const sellerId = await getCurrentSellerId();
      const url = apiUrl(`/info/appeals/seller/${encodeURIComponent(sellerId)}`);
      const res = await (authFetch
        ? authFetch(url)
        : fetch(url, { headers: { Accept: "application/json" } }));
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      const list = Array.isArray(data?.result) ? data.result : [];
      setRows(list);
    } catch (e) {
      setRows([]);
      setErr(e?.message || "Không tải được lịch sử khiếu nại");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // fetch product by id
  const fetchProductById = async (productId) => {
    if (!productId) return null;
    try {
      const url = apiUrl(`/product/searchByProduct/${encodeURIComponent(productId)}`);
      const res = await (authFetch
        ? authFetch(url, { headers: { Accept: "application/json" } })
        : fetch(url, { headers: { Accept: "application/json" } }));
      const json = await res.json().catch(() => ({}));
      if (!res.ok || (json?.code && json.code !== 200))
        throw new Error(json?.message || `HTTP ${res.status}`);
      const d = json?.result || {};
      const imgs = pickAllImageUrls(d?.images || []);
      return {
        id: d.id,
        sellerId: d.sellerId || d.seller_id || null,
        name: d.name || d.productName || "—",
        description: d.description || "",
        images: imgs.length ? imgs : ["/img/default.png"],
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        status: d.status,
        categoryId: d.categoryId,
      };
    } catch {
      return null;
    }
  };

  // open modal
  const openView = async (row) => {
    setCurrent(row);
    setActiveIdx(0);
    setProductDetail(null);
    setDetailError("");
    setViewOpen(true);

    setDetailLoading(true);
    try {
      const pid = row?.product_id || row?.productId;
      const detail = await fetchProductById(pid);
      setProductDetail(detail);
    } catch (e) {
      setDetailError(e?.message || "Không tải được thông tin sản phẩm");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeView = () => {
    setViewOpen(false);
    setCurrent(null);
    setProductDetail(null);
    setActiveIdx(0);
  };

  // keyboard support for modal & gallery
  useEffect(() => {
    if (!viewOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeView();
      if (!productDetail?.images?.length) return;
      if (e.key === "ArrowRight") setActiveIdx((i) => (i + 1) % productDetail.images.length);
      if (e.key === "ArrowLeft")
        setActiveIdx((i) => (i - 1 + productDetail.images.length) % productDetail.images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewOpen, productDetail?.images]);

  // filter search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.id, r.product_id, r.reason, r.status, r.seller_name, r.seller_email]
        .map((x) => (x || "").toString().toLowerCase())
        .some((s) => s.includes(q))
    );
  }, [rows, search]);

  // copy helper
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text || "");
    } catch {}
  };

  // derive color tone for admin response card by status
  const adminTone = (s) => {
    const v = (s || "").toUpperCase();
    if (v === "APPROVED") return "tone-approved";
    if (v === "REJECTED") return "tone-rejected";
    return "tone-pending";
  };

  return (
    <div className="sv-wrap">
      {/* Top */}
      <div className="sv-top">
        <div className="sv-top-left">
          <h2 className="sv-title">Lịch sử khiếu nại</h2>
          <div className="sa-sub-muted">Các khiếu nại bạn đã gửi tới hệ thống</div>
        </div>

        <div className="sv-toolbar">
          <div className="sv-field">
            <span>Tìm kiếm</span>
            <input
              className="sv-input"
              placeholder="Nhập mã, lý do, trạng thái…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="sv-count-chip" title="Tổng số bản ghi đang hiển thị">
            <span className="sv-count-dot" />
            Tổng: <b>{rows.length}</b>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="sv-loading">Đang tải…</div>
      ) : err ? (
        <div className="sv-error">{err}</div>
      ) : filtered.length === 0 ? (
        <div className="sv-empty">Chưa có khiếu nại nào.</div>
      ) : (
        <div className="sv-tiers">
          <section className="sv-tier-section">
            <div className="sv-tier-head">
              <div className="sv-tier-chip">
                <span className="sv-tier-dot" />
                Tất cả
              </div>
              <div className="sv-tier-meta">{filtered.length} mục</div>
            </div>

            <div className="sv-row">
              {filtered.map((it) => (
                <div key={it.id} className="sv-card">
                  <div className="sv-head">
                    <span className={`sv-badge ${statusClass(it.status)}`}>
                      {statusTextVi(it.status)}
                    </span>
                    <div className="sv-number" style={{ marginLeft: "auto" }}>
                      Mã: <b>{it.id}</b>
                    </div>
                  </div>

                  <div className="sv-reason" style={{ marginTop: 2 }}>
                    <span className="sv-reason-label">Lý do:</span>
                    <span className="sv-reason-text">{it.reason || "—"}</span>
                  </div>

                  <div className="sv-meta">
                    Gửi lúc: {fmtDateTime(it.submitted_at)}
                    <span className="muted">Sản phẩm: {it.product_id || "—"}</span>
                  </div>

                  {Array.isArray(it.evidence_urls) && it.evidence_urls.length > 0 && (
                    <>
                      <div className="sv-evid-title">Ảnh minh chứng</div>
                      <div className="sv-evid-grid">
                        {it.evidence_urls.map((u, i) => (
                          <button
                            key={i}
                            className="sv-evid-item"
                            title={`Minh chứng ${i + 1}`}
                            onClick={() => {
                              setLightboxIdx(i);
                              setLightboxOpen(true);
                              setCurrent(it);
                            }}
                          >
                            <img className="sv-evid-img" src={u} alt={`evi-${i}`} />
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="sv-card-actions">
                    <button
                      type="button"
                      className="sv-appeal-inline sa-view-btn"
                      onClick={() => openView(it)}
                      title="Xem chi tiết"
                    >
                      Xem chi tiết
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ===== Modal ===== */}
      {viewOpen && current && (
        <Portal>
          <div className="sv-modal-backdrop" onClick={closeView}>
            <div
              className="sv-modal sv-modal-center sa-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              {/* Sticky header */}
              <div className="sv-modal-header sa-modal-header">
                <div className="sa-hstack">
                  <div className="sa-title-wrap">
                    <div className="sa-title">
                      Chi tiết khiếu nại
                      <span className={`sv-badge sa-badge ${statusClass(current.status)}`}>
                        {statusTextVi(current.status)}
                      </span>
                    </div>
                    <div className="sa-subchips">
                      <span className="chip" title="Mã khiếu nại" onClick={() => copy(current.id)}>
                        <span className="dot" /> Mã: <b>{current.id}</b>
                      </span>
                      <span className="chip" title="Mã sản phẩm" onClick={() => copy(current.product_id)}>
                        <span className="dot" /> SP: <b>{current.product_id || "—"}</b>
                      </span>
                      <span className="chip">
                        <span className="dot" /> Gửi: <b>{fmtDateTime(current.submitted_at)}</b>
                      </span>
                    </div>
                  </div>
                </div>

                <button className="sv-modal-close" onClick={closeView} aria-label="Đóng">
                  ×
                </button>
              </div>

              <div className="sv-modal-body sa-modal-body">
                {/* Top 2 columns: left gallery, right info */}
                <div className="sa-grid">
                  {/* LEFT: Product Gallery */}
                  <div className="sa-panel">
                    <div className="panel-title">Sản phẩm</div>

                    {detailLoading ? (
                      <div className="skeleton skeleton-hero" />
                    ) : detailError ? (
                      <div className="sv-error">{detailError}</div>
                    ) : (
                      <>
                        <div className="gallery-hero" aria-live="polite">
                          <img
                            src={
                              productDetail?.images?.[activeIdx] ??
                              productDetail?.images?.[0] ??
                              "/img/default.png"
                            }
                            alt="Xem trước"
                          />
                          {productDetail?.images?.length > 1 && (
                            <>
                              <button
                                className="g-nav g-prev"
                                onClick={() =>
                                  setActiveIdx((i) =>
                                    (i - 1 + productDetail.images.length) %
                                    productDetail.images.length
                                  )
                                }
                                aria-label="Ảnh trước"
                              >
                                ‹
                              </button>
                              <button
                                className="g-nav g-next"
                                onClick={() =>
                                  setActiveIdx((i) => (i + 1) % productDetail.images.length)
                                }
                                aria-label="Ảnh sau"
                              >
                                ›
                              </button>
                            </>
                          )}
                        </div>

                        <div className="gallery-thumbs">
                          {(productDetail?.images || ["/img/default.png"]).map((u, i) => (
                            <button
                              key={i}
                              onClick={() => setActiveIdx(i)}
                              className={`thumb ${i === activeIdx ? "active" : ""}`}
                              title={`Ảnh ${i + 1}`}
                            >
                              <img src={u} alt={`thumb-${i}`} />
                            </button>
                          ))}
                        </div>

                        <div className="kv-grid">
                          <div className="kv">
                            <div className="kv-label">Tên sản phẩm</div>
                            <div className="kv-value">{productDetail?.name || "—"}</div>
                          </div>
                          <div className="kv">
                            <div className="kv-label">Trạng thái SP</div>
                            <div className="kv-value">
                              <span className="tag">{productDetail?.status || "—"}</span>
                            </div>
                          </div>
                          <div className="kv">
                            <div className="kv-label">Ngày tạo</div>
                            <div className="kv-value">{fmtDateTime(productDetail?.createdAt)}</div>
                          </div>
                          <div className="kv">
                            <div className="kv-label">Cập nhật</div>
                            <div className="kv-value">{fmtDateTime(productDetail?.updatedAt)}</div>
                          </div>
                        </div>

                        {productDetail?.description && (
                          <div className="sa-block">
                            <div className="panel-subtitle">Mô tả sản phẩm</div>
                            <div className="desc">{productDetail.description}</div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* RIGHT: Appeal Info */}
                  <div className="sa-panel">
                    <div className="panel-title">Thông tin khiếu nại</div>

                    <div className="kv-grid">
                      <div className="kv">
                        <div className="kv-label">Trạng thái</div>
                        <div className="kv-value">
                          <span className={`sv-badge ${statusClass(current.status)}`}>
                            {statusTextVi(current.status)}
                          </span>
                        </div>
                      </div>
                      <div className="kv">
                        <div className="kv-label">Gửi lúc</div>
                        <div className="kv-value">{fmtDateTime(current.submitted_at)}</div>
                      </div>
                      <div className="kv">
                        <div className="kv-label">Duyệt lúc</div>
                        <div className="kv-value">{fmtDateTime(current.reviewed_at)}</div>
                      </div>
                      <div className="kv kv-full">
                        <div className="kv-label">Lý do khiếu nại</div>
                        <div className="kv-value strong">{current.reason || "—"}</div>
                      </div>
                    </div>

                    <div className={`sa-admin ${adminTone(current.status)}`}>
                      <div className="sa-admin-title">Phản hồi của admin</div>
                      <div className="sa-admin-body">{current.admin_response || "—"}</div>
                    </div>

                    <div className="sa-block">
                      <div className="panel-subtitle">
                        Ảnh minh chứng {Array.isArray(current.evidence_urls) ? `(${current.evidence_urls.length})` : ""}
                      </div>
                      {Array.isArray(current.evidence_urls) && current.evidence_urls.length ? (
                        <div className="evi-grid">
                          {current.evidence_urls.map((u, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setLightboxIdx(i);
                                setLightboxOpen(true);
                              }}
                              className="evi"
                              title={`Minh chứng ${i + 1}`}
                            >
                              <img src={u} alt={`evi-${i}`} />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted">—</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky footer */}
              <div className="sv-modal-footer sa-modal-footer">
                <button className="btn btn-secondary" onClick={closeView}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Lightbox */}
      {lightboxOpen && current?.evidence_urls?.length ? (
        <Portal>
          <div className="sv-modal-backdrop" onClick={() => setLightboxOpen(false)}>
            <div
              className="sv-modal sv-modal-center sa-lightbox"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="sv-modal-header">
                <div className="sv-modal-title">Ảnh minh chứng</div>
                <button className="sv-modal-close" onClick={() => setLightboxOpen(false)} aria-label="Đóng">
                  ×
                </button>
              </div>
              <div className="sv-modal-body">
                <div className="sap-lightbox">
                  <div className="sap-lightbox-hero">
                    <img src={current.evidence_urls[lightboxIdx]} alt="evidence" />
                    {current.evidence_urls.length > 1 && (
                      <>
                        <button
                          className="g-nav g-prev"
                          onClick={() =>
                            setLightboxIdx((i) => (i - 1 + current.evidence_urls.length) % current.evidence_urls.length)
                          }
                          aria-label="Ảnh trước"
                        >
                          ‹
                        </button>
                        <button
                          className="g-nav g-next"
                          onClick={() => setLightboxIdx((i) => (i + 1) % current.evidence_urls.length)}
                          aria-label="Ảnh sau"
                        >
                          ›
                        </button>
                      </>
                    )}
                  </div>
                  <div className="sap-thumbs">
                    {current.evidence_urls.map((u, i) => (
                      <button
                        key={i}
                        onClick={() => setLightboxIdx(i)}
                        className={`sap-thumb ${i === lightboxIdx ? "active" : ""}`}
                        title={`Ảnh ${i + 1}`}
                      >
                        <img src={u} alt={`thumb-${i}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="sv-modal-footer">
                <button className="btn btn-secondary" onClick={() => setLightboxOpen(false)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </Portal>
      ) : null}
    </div>
  );
}
