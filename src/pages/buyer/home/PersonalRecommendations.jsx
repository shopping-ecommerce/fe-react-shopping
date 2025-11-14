// src/pages/buyer/home/PersonalRecommendations.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_CONFIG, apiUrl } from "../../../config/api";
import "../../../styles/home.css";

/* =========================
   Helpers ảnh & giá (API mới)
   ========================= */
// Ưu tiên URL trong mediaByOption.image; fallback images[].url có position nhỏ nhất
const pickCover = (p) => {
  const m = Array.isArray(p?.mediaByOption)
    ? p.mediaByOption.find(
        (x) => typeof x?.image === "string" && /^https?:\/\//i.test(x.image)
      )
    : null;
  if (m?.image) return m.image;

  const first =
    Array.isArray(p?.images) && p.images.length > 0
      ? [...p.images]
          .sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))[0]?.url
      : null;

  return first || "/img/default.png";
};

// Lấy min price/compareAtPrice từ variants; chỉ hiển thị compare nếu > price
const priceFromVariants = (variants = []) => {
  if (!Array.isArray(variants) || variants.length === 0)
    return { price: null, compare: null };

  const prices = variants
    .map((v) => Number(v?.price))
    .filter((n) => Number.isFinite(n));
  const compares = variants
    .map((v) => Number(v?.compareAtPrice))
    .filter((n) => Number.isFinite(n));

  if (!prices.length) return { price: null, compare: null };

  const price = Math.min(...prices);
  const cmp = compares.length ? Math.min(...compares) : null;

  return {
    price,
    compare: Number.isFinite(cmp) && cmp > price ? cmp : null,
  };
};

// Fallback từ sizes (giữ tương thích cũ)
const priceFromSizes = (sizes = []) => {
  if (!Array.isArray(sizes) || sizes.length === 0)
    return { price: null, compare: null };

  const price = Number(sizes?.[0]?.price);
  const compare = Number(sizes?.[0]?.compareAtPrice);
  return {
    price: Number.isFinite(price) ? price : null,
    compare:
      Number.isFinite(compare) && Number.isFinite(price) && compare > price
        ? compare
        : null,
  };
};

function PriceLine({ product }) {
  const { price, compare } = useMemo(() => {
    const v = priceFromVariants(product?.variants);
    if (Number.isFinite(v.price)) return v;
    return priceFromSizes(product?.sizes);
  }, [product]);

  if (!Number.isFinite(price)) return null;

  return (
    <div className="price-line">
      <span className="price">{Number(price).toLocaleString()}₫</span>
      {Number.isFinite(compare) && (
        <span className="compare">{Number(compare).toLocaleString()}₫</span>
      )}
    </div>
  );
}

export default function PersonalRecommendations({
  userId,
  onOpenQuick, // optional: (product) => void
  onOpenDetail, // optional: (product) => void
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [recs, setRecs] = useState([]);
  const [meta, setMeta] = useState({ total_interactions: 0 });
  const [showAll, setShowAll] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let abort = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const url = apiUrl(API_CONFIG.endpoints.recommendByUser(userId));
        const res = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const text = await res.text();
        let json = {};
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          json = { message: text };
        }

        if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);

        const list = Array.isArray(json?.recommendations)
          ? json.recommendations
          : [];
        if (!abort) {
          setRecs(list);
          setMeta({
            total_interactions: Number(json?.total_interactions || 0),
            total_recommendations: Number(
              json?.total_recommendations || list.length
            ),
          });
        }
      } catch (e) {
        if (!abort) {
          setErr(e?.message || "Không lấy được gợi ý.");
          setRecs([]);
          setMeta({ total_interactions: 0 });
        }
      } finally {
        if (!abort) setLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, [userId]);

  // chỉ hiển thị khi có tương tác & có kết quả
  const shouldShow = userId && meta.total_interactions > 0 && recs.length > 0;
  if (!shouldShow) return null;

  // fallback hành vi khi không truyền callback từ Home
  const openDetailFallback = (p) => {
    if (onOpenDetail) return onOpenDetail(p);
    navigate(`/products/${p.id}`);
  };
  const openQuickFallback = (p) => {
    if (onOpenQuick) return onOpenQuick(p);
    // nếu không có quickview, điều hướng sang chi tiết
    navigate(`/products/${p.id}`);
  };

  const listToRender = showAll ? recs : recs.slice(0, 10);

  return (
    <div className="section-card product-grid" style={{ marginTop: 16 }}>
      <h2 className="product-title">Gợi ý cho bạn</h2>

      {loading ? (
        <div style={{ padding: 16, textAlign: "center" }}>
          🔄 Đang tải gợi ý…
        </div>
      ) : err ? (
        <div style={{ padding: 16, textAlign: "center", color: "#666" }}>
          Không lấy được gợi ý: {err}
        </div>
      ) : (
        <div className="product-list">
          {listToRender.map((r, idx) => {
            const p = r?.product || {};
            const pid = p._id || p.id;
            const id = String(pid); // chuẩn hoá id
            const name = p.name || "Sản phẩm";
            const img = pickCover(p);

            const goDetail = () => openDetailFallback({ ...p, id });
            const onPrimaryClick = (e) => {
              e.stopPropagation();
              openQuickFallback({ ...p, id });
            };

            return (
              <div
                key={`${id}-${idx}`}
                className="product-card"
                onClick={goDetail}
                title={name}
                data-pid={id}
              >
                <img src={img} alt={name} />
                <h3 title={name}>{name}</h3>

                <PriceLine product={p} />

                {/* Cụm nút giống grid chính */}
                <div className="card-actions">
                  <button className="pbtn primary" onClick={onPrimaryClick}>
                    Mua ngay
                  </button>
                  <button className="pbtn outline" onClick={onPrimaryClick}>
                    Thêm vào giỏ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {recs.length > 10 && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button
            className="pbtn outline"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Ẩn bớt" : "Xem thêm"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 8, color: "#6b7280", fontSize: 12 }}>
        Dựa trên {meta.total_interactions} hoạt động gần đây của bạn.
      </div>
    </div>
  );
}
