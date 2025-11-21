import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../contexts/AuthContext";
import { apiUrl } from "../../config/api";

function Star({ filled }) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M10 1.5l2.9 5.88 6.5.94-4.7 4.58 1.1 6.43L10 16.5 4.2 19.3l1.1-6.43L.6 8.32l6.5-.94L10 1.5z"
        fill={filled ? "#ffb400" : "none"}
        stroke="#ffb400"
      />
    </svg>
  );
}

function Stars({ value = 0 }) {
  const roundedHalf = Math.round(value * 2) / 2; // nếu về sau muốn nửa sao
  const full = Math.floor(roundedHalf);
  return (
    <span style={{ display: "inline-flex", gap: 2, verticalAlign: "middle" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} filled={i <= full} />
      ))}
    </span>
  );
}

/**
 * Tính & hiển thị sao trung bình dựa trên toàn bộ reviews của productId.
 * - GET /feedback/review/{productId}
 * - avg = sum(rating)/count
 * - Hiển thị sao + số điểm + tổng lượt đánh giá
 */
export default function ProductRatingSummary({
  productId,
  showCount = true,
  className = "",
  numberFormat = (n) => n.toFixed(1), // đổi thành (n)=>String(Math.round(n)) nếu muốn số nguyên
}) {
  const { authFetch, authReady } = useContext(AuthContext);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [reload, setReload] = useState(0); // để refetch khi ProductReviews post mới

  // Lắng nghe event từ ProductReviews (sau khi tạo review thành công)
  useEffect(() => {
    const onUpdated = (e) => {
      if (!e?.detail?.productId) return;
      if (String(e.detail.productId) === String(productId)) {
        setReload((x) => x + 1);
      }
    };
    window.addEventListener("product:reviewsUpdated", onUpdated);
    return () => window.removeEventListener("product:reviewsUpdated", onUpdated);
  }, [productId]);

  useEffect(() => {
    if (!productId || !authReady) return;
    let gone = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await authFetch(apiUrl(`/feedback/review/${encodeURIComponent(productId)}`), {
          headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.code !== 200) {
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
        const list = Array.isArray(data?.result) ? data.result : [];
        const rs = list
          .map((r) => Number(r?.rating))
          .filter((n) => Number.isFinite(n) && n > 0);
        if (!gone) setRatings(rs);
      } catch (e) {
        if (!gone) {
          setErr(e?.message || "Không tải được điểm đánh giá");
          setRatings([]);
        }
      } finally {
        if (!gone) setLoading(false);
      }
    })();

    return () => {
      gone = true;
    };
  }, [productId, authFetch, authReady, reload]);

  const summary = useMemo(() => {
    const total = ratings.length;
    if (!total) return { avg: 0, total: 0, counts: [0, 0, 0, 0, 0] };
    const counts = [0, 0, 0, 0, 0];
    let sum = 0;
    for (const r of ratings) {
      const s = Math.max(1, Math.min(5, Math.round(r)));
      counts[s - 1] += 1;
      sum += Number(r);
    }
    return { avg: sum / total, total, counts };
  }, [ratings]);

  if (loading) {
    return (
      <span className={className} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <Stars value={0} />
        <span style={{ fontSize: 14, color: "#666" }}>Đang tính…</span>
      </span>
    );
  }
  if (err) {
    return <span className={className} style={{ fontSize: 13, color: "#e02424" }}>{err}</span>;
  }

  const displayScore = summary.total ? summary.avg : 0;

  return (
    <span className={className} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <Stars value={displayScore} />
      <strong style={{ fontSize: 14 }}>{numberFormat(displayScore)}</strong>
      {showCount && (
        <span style={{ fontSize: 13, color: "#666" }}>· {summary.total} đánh giá</span>
      )}
    </span>
  );
}
