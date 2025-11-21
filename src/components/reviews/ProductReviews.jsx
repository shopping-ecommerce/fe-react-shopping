import React, { useEffect, useMemo, useState, useContext } from "react";
import { AuthContext } from "../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../config/api";
import "../../styles/product-reviews.css";

const Star = ({ filled }) => (
  <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
    <path
      d="M10 1.5l2.9 5.88 6.5.94-4.7 4.58 1.1 6.43L10 16.5 4.2 19.3l1.1-6.43L.6 8.32l6.5-.94L10 1.5z"
      fill={filled ? "#ffb400" : "none"}
      stroke="#ffb400"
    />
  </svg>
);

function Stars({ value = 0 }) {
  return (
    <div className="rv-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} filled={i <= Math.round(value)} />
      ))}
    </div>
  );
}

export default function ProductReviews({ productId }) {
  const { authFetch, isAuthenticated, authReady } = useContext(AuthContext);

  // Profile hiện tại (để gán tên + avatar khi chính mình review)
  const [me, setMe] = useState(null); // { id, name, avatar }

  // Danh sách review
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // Bộ lọc
  const [starFilter, setStarFilter] = useState(0);
  const [onlyWithText, setOnlyWithText] = useState(false);
  const [onlyWithMedia, setOnlyWithMedia] = useState(false);

  // Phân trang
  const [page, setPage] = useState(1);
  const pageSize = 5;

  // Form tạo review
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState([]);

  // Lightbox ảnh phóng to: { reviewKey, index, images: string[] } | null
  const [expanded, setExpanded] = useState(null);

  // Cache thông tin hồ sơ theo userId
  const [profileMap, setProfileMap] = useState({}); // userId -> { name, avatar }

  // ---- Helpers bóc tên + avatar từ nhiều dạng payload khác nhau
  const pickName = (obj = {}) => {
    const a = obj.first_name || obj.firstName;
    const b = obj.last_name || obj.lastName;
    const full = [a, b].filter(Boolean).join(" ").trim();
    return (
      obj.name ||
      obj.username ||
      obj.userName ||
      full ||
      (typeof obj.fullName === "string" ? obj.fullName : "") ||
      "Người dùng"
    );
  };
  const pickAvatar = (obj = {}) =>
    obj.public_id ||
    obj.avatar ||
    obj.avatarUrl ||
    obj.avatar_url ||
    "/img/default-avatar.png";

  const isVideoUrl = (u) =>
    typeof u === "string" && u.toLowerCase().endsWith(".mp4");

  const openExpanded = (reviewKey, index, images) => {
    const idx = Math.max(0, Math.min(index ?? 0, (images?.length || 1) - 1));
    setExpanded({ reviewKey, index: idx, images: images || [] });
  };
  const closeExpanded = () => setExpanded(null);
  const goPrev = () =>
    setExpanded((p) => (!p ? p : { ...p, index: Math.max(0, p.index - 1) }));
  const goNext = () =>
    setExpanded((p) =>
      !p ? p : { ...p, index: Math.min(p.images.length - 1, p.index + 1) }
    );

  // ✅ DÙNG API PUBLIC: GET /shopping/api/info/profiles/{userId}
  const fetchProfileByUserId = async (uid) => {
    try {
      const res = await fetch(
        apiUrl(`/info/profiles/${encodeURIComponent(uid)}`),
        { headers: { Accept: "application/json" } }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data?.code !== 0 && data?.code !== 200)) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      const result = data?.result || {};
      return {
        name: pickName(result),
        avatar: pickAvatar(result),
      };
    } catch {
      return null;
    }
  };

  // Lấy profile hiện tại
  useEffect(() => {
    if (!authReady || !isAuthenticated) {
      setMe(null);
      return;
    }
    const ac = new AbortController();
    const { signal } = ac;

    (async () => {
      try {
        const res = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile), {
          headers: { Accept: "application/json" },
          signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || (data?.code !== 0 && data?.code !== 200)) {
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
        const prof = data?.result || {};
        const nameFromProf =
          pickName(prof) === "Người dùng"
            ? [prof?.first_name, prof?.last_name]
                .filter(Boolean)
                .join(" ")
                .trim() || "Bạn"
            : pickName(prof);
        const meObj = {
          id: prof?.id,
          name: nameFromProf,
          avatar: pickAvatar(prof),
        };
        setMe(meObj);

        // cache luôn chính mình
        if (prof?.id) {
          setProfileMap((prev) => ({
            ...prev,
            [prof.id]: { name: meObj.name, avatar: meObj.avatar },
          }));
        }
      } catch (e) {
        if (!signal.aborted) {
          console.warn("Không lấy được profile:", e.message || e);
          setMe(null);
        }
      }
    })();

    return () => ac.abort();
  }, [authReady, isAuthenticated, authFetch]);

  // GET list reviews
  useEffect(() => {
    if (!productId || !authReady) return;
    const ac = new AbortController();
    const { signal } = ac;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // (Giữ authFetch vì /feedback/review yêu cầu token qua gateway)
        const res = await authFetch(
          apiUrl(`/feedback/review/${encodeURIComponent(productId)}`),
          { headers: { Accept: "application/json" }, signal }
        );
        const data = await res.json().catch(() => ({}));

        if (!res.ok || data?.code !== 200) {
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
        setItems(Array.isArray(data?.result) ? data.result : []);
      } catch (e) {
        if (!signal.aborted) {
          setErr(e.message || "Không tải được đánh giá");
          setItems([]);
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [productId, authReady, authFetch]);

  // Sau khi có reviews, fetch thông tin profile cho các userId còn thiếu (PUBLIC API)
  useEffect(() => {
    const unknownUserIds = Array.from(
      new Set(items.map((r) => r?.userId).filter(Boolean))
    ).filter((uid) => !profileMap[uid]);

    if (unknownUserIds.length === 0) return;

    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(
        unknownUserIds.map((uid) => fetchProfileByUserId(uid))
      );
      if (cancelled) return;

      const obj = {};
      results.forEach((r, idx) => {
        const uid = unknownUserIds[idx];
        if (r.status === "fulfilled" && r.value) {
          obj[uid] = r.value;
        } else {
          obj[uid] = { name: "Người dùng", avatar: "/img/default-avatar.png" };
        }
      });
      if (Object.keys(obj).length) {
        setProfileMap((prev) => ({ ...prev, ...obj }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [items, profileMap]);

  // Reset lightbox khi đổi filter/trang
  useEffect(() => {
    setExpanded(null);
  }, [productId, page, starFilter, onlyWithText, onlyWithMedia]);

  // Điều khiển lightbox bằng phím
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeExpanded();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  // Summary
  const summary = useMemo(() => {
    if (!items.length) return { avg: 0, counts: [0, 0, 0, 0, 0], total: 0 };
    const counts = [0, 0, 0, 0, 0];
    let sum = 0;
    for (const r of items) {
      const s = Math.max(1, Math.min(5, Number(r?.rating) || 0));
      counts[s - 1] += 1;
      sum += s;
    }
    return { avg: sum / items.length, counts, total: items.length };
  }, [items]);

  // Filter + pagination
  const filtered = useMemo(() => {
    return items.filter((r) => {
      if (starFilter && Number(r?.rating) !== starFilter) return false;
      if (onlyWithText && !r?.comment) return false;
      const medias = Array.isArray(r?.imageUrls)
        ? r.imageUrls
        : Array.isArray(r?.images)
        ? r.images
        : [];
      if (onlyWithMedia && medias.length === 0) return false;
      return true;
    });
  }, [items, starFilter, onlyWithText, onlyWithMedia]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [starFilter, onlyWithText, onlyWithMedia]);

  const resetForm = () => {
    setRating(5);
    setComment("");
    setFiles([]);
  };

  const onSubmitReview = async () => {
    try {
      if (!authReady || !isAuthenticated) {
        alert("Vui lòng đăng nhập để viết đánh giá.");
        return;
      }
      if (!me?.id) {
        alert("Không lấy được userId. Vui lòng thử lại.");
        return;
      }

      const req = {
        productId,
        userId: me.id,
        rating: Number(rating),
        comment: comment?.trim() || "",
      };

      const form = new FormData();
      form.append(
        "request",
        new Blob([JSON.stringify(req)], { type: "application/json" })
      );
      for (const f of files) form.append("files", f);

      const url = apiUrl(`/feedback/review/create`);
      const res = await authFetch(url, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.code !== 200) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      // Chèn vào đầu list, và cập nhật profileMap cho chính mình để hiển thị ngay
      const created = {
        ...(data?.result || {}),
        userId: data?.result?.userId || me.id,
      };
      setItems((prev) => [created, ...prev]);
      setProfileMap((prev) => ({
        ...prev,
        [me.id]: { name: me.name, avatar: me.avatar },
      }));

      alert("Đã gửi đánh giá, cảm ơn bạn!");
      resetForm();
      setShowForm(false);
    } catch (e) {
      alert(e.message || "Gửi đánh giá thất bại");
    }
  };

  return (
    <section className="rv-wrap" id="reviews">
      <h3 className="rv-heading">ĐÁNH GIÁ SẢN PHẨM</h3>

      <div className="rv-summary">
        <div className="rv-score">
          <div className="rv-score-num">{summary.avg.toFixed(1)}</div>
          <div className="rv-score-sub">trên 5</div>
          <div className="rv-score-stars">
            <Stars value={summary.avg} />
          </div>
        </div>

        <div className="rv-filters">
          <button
            className={`rv-chip ${
              starFilter === 0 && !onlyWithText && !onlyWithMedia
                ? "active"
                : ""
            }`}
            onClick={() => {
              setStarFilter(0);
              setOnlyWithText(false);
              setOnlyWithMedia(false);
            }}
          >
            Tất Cả
          </button>

          {[5, 4, 3, 2, 1].map((s) => (
            <button
              key={s}
              className={`rv-chip ${starFilter === s ? "active" : ""}`}
              onClick={() => setStarFilter(s)}
            >
              {s} Sao ({summary.counts[s - 1]})
            </button>
          ))}

          <button
            className={`rv-chip ${onlyWithText ? "active" : ""}`}
            onClick={() => setOnlyWithText((v) => !v)}
          >
            Có Bình Luận (
            {items.filter((i) => i?.comment && String(i.comment).trim()).length}
            )
          </button>
          <button
            className={`rv-chip ${onlyWithMedia ? "active" : ""}`}
            onClick={() => setOnlyWithMedia((v) => !v)}
          >
            Có Hình Ảnh / Video (
            {
              items.filter((i) => {
                const m = Array.isArray(i?.imageUrls)
                  ? i.imageUrls
                  : Array.isArray(i?.images)
                  ? i.images
                  : [];
                return m.length > 0;
              }).length
            }
            )
          </button>
        </div>
      </div>

      <hr className="rv-sep" />

      {loading ? (
        <div className="rv-loading">Đang tải đánh giá…</div>
      ) : err ? (
        <div className="rv-error">{err}</div>
      ) : filtered.length === 0 ? (
        <div className="rv-empty">Chưa có đánh giá nào.</div>
      ) : (
        <div className="rv-list">
          {pageItems.map((r, idx) => {
            const media = Array.isArray(r?.imageUrls)
              ? r.imageUrls
              : Array.isArray(r?.images)
              ? r.images
              : [];
            const reviewKey = String(r?.id || `idx-${idx}`);

            // Ưu tiên: profileMap -> trường trong review -> chính mình -> fallback
            let displayName =
              profileMap[r?.userId]?.name ||
              r?.username ||
              r?.userName ||
              (me && r?.userId === me.id ? me.name : "Người dùng");
            let displayAvatar =
              profileMap[r?.userId]?.avatar ||
              r?.avatar ||
              (me && r?.userId === me.id
                ? me.avatar
                : "/img/default-avatar.png");

            return (
              <article key={reviewKey} className="rv-item">
                <div className="rv-avatar">
                  <img src={displayAvatar} alt="avatar" />
                </div>
                <div className="rv-body">
                  <div className="rv-header">
                    <div className="rv-author">
                      <strong>{displayName}</strong>
                      <span className="rv-time">
                        {new Date(
                          r?.createdAt || r?.createdTime || Date.now()
                        ).toLocaleString()}
                      </span>
                    </div>
                    <Stars value={r?.rating || 0} />
                  </div>

                  {r?.comment && <p className="rv-text">{r.comment}</p>}

                  {/* Thumbnails + kính lúp */}
                  {media.length > 0 &&
                    (() => {
                      const allMedia = media; // ảnh + video
                      const imagesOnly = allMedia.filter((u) => !isVideoUrl(u)); // chỉ ảnh cho lightbox

                      return (
                        <>
                          <div className="rv-media">
                            {allMedia.map((u, i) => {
                              const isVideo = isVideoUrl(u);
                              if (isVideo) {
                                return (
                                  <video
                                    key={i}
                                    src={u}
                                    className="rv-thumb"
                                    controls
                                  />
                                );
                              }
                              const imgIndex = imagesOnly.indexOf(u);
                              return (
                                <div key={i} className="rv-thumb-wrap">
                                  <img
                                    src={u}
                                    alt={`media-${i}`}
                                    className="rv-thumb"
                                  />
                                  <button
                                    type="button"
                                    className="rv-zoom"
                                    title="Xem lớn"
                                    onClick={() =>
                                      openExpanded(
                                        reviewKey,
                                        imgIndex,
                                        imagesOnly
                                      )
                                    }
                                  >
                                    <svg
                                      viewBox="0 0 24 24"
                                      width="22"
                                      height="22"
                                      aria-hidden="true"
                                    >
                                      <circle
                                        cx="10"
                                        cy="10"
                                        r="6.5"
                                        stroke="currentColor"
                                        fill="none"
                                      />
                                      <path
                                        d="M14.5 14.5 L20 20"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      />
                                      <path
                                        d="M7 10 H13"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      />
                                      <path
                                        d="M10 7 V13"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {filtered.length > pageSize && (
        <div className="rv-pagination">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            ›
          </button>
        </div>
      )}

      {/* Lightbox phóng to + trượt */}
      {expanded && expanded.images?.length > 0 && (
        <div
          className="rv-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={closeExpanded}
        >
          <div className="rv-lb-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="rv-lb-close"
              onClick={closeExpanded}
              aria-label="Đóng"
            >
              ×
            </button>

            <div className="rv-lb-viewport">
              <div
                className="rv-lb-track"
                style={{ transform: `translateX(-${expanded.index * 100}%)` }}
              >
                {expanded.images.map((src, i) => (
                  <div className="rv-lb-item" key={i}>
                    <img src={src} alt={`slide-${i}`} />
                  </div>
                ))}
              </div>
            </div>

            <button
              className="rv-lb-prev"
              onClick={goPrev}
              disabled={expanded.index <= 0}
              aria-label="Ảnh trước"
            >
              ‹
            </button>
            <button
              className="rv-lb-next"
              onClick={goNext}
              disabled={expanded.index >= expanded.images.length - 1}
              aria-label="Ảnh sau"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
