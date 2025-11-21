// src/pages/buyer/search/SearchResults.jsx
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../../config/api";
import "../../../styles/home.css";
import ProductQuickView from "../home/ProductQuickView";
import {
  getMyProfile,
  addFavorite,
  removeFavorite,
  pickImageUrl,
} from "../../../services/favorites";

const useQueryParams = () => new URLSearchParams(useLocation().search);

// Cache key cho semantic
const SEM_K = (q) => `semantic_results_v1_${(q || "").toLowerCase()}`;
const SEMANTIC_TOP_K = 10;

// ====================== IMAGE SEARCH SUPPORT ======================
const IMG_STORE_KEY = "image_search_payload_v1";

function dataURLtoBlob(dataUrl) {
  const arr = (dataUrl || "").split(",");
  const mime = (arr[0].match(/:(.*?);/) || [])[1] || "image/png";
  const bstr = atob(arr[1] || "");
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

/* ===== Helpers định dạng giá giống Home ===== */
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Lấy giá hiển thị cho card: ưu tiên variants (min price), fallback sizes[0] */
function getCardPrice(p) {
  // A) variants: lấy giá thấp nhất + compare nhỏ nhất nhưng vẫn > price
  if (Array.isArray(p?.variants) && p.variants.length > 0) {
    let minPrice = null;
    let bestCompare = null;

    for (const v of p.variants) {
      const price = num(v?.price);
      const cmp = num(v?.compareAtPrice);

      if (price == null) continue;

      if (minPrice == null || price < minPrice) {
        minPrice = price;
        bestCompare = cmp && cmp > price ? cmp : null;
      } else if (price === minPrice) {
        if (cmp && cmp > price) {
          if (bestCompare == null || cmp < bestCompare) {
            bestCompare = cmp;
          }
        }
      }
    }
    return { price: minPrice, compare: bestCompare };
  }

  // B) sizes[0]
  if (Array.isArray(p?.sizes) && p.sizes.length > 0) {
    const s0 = p.sizes[0];
    const price = num(s0?.price);
    const cmp = num(s0?.compareAtPrice);
    return {
      price,
      compare: cmp && price != null && cmp > price ? cmp : null,
    };
  }

  // C) không có dữ liệu giá
  return { price: null, compare: null };
}

function SearchResults() {
  const { authFetch } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const params = useQueryParams();
  const q = (params.get("query") || params.get("q") || "").trim();
  const imgVer = params.get("v") || ""; // phiên ảnh

  // Image Search mode?
  const isImageMode = params.get("image") === "1";
  const [imgPreview, setImgPreview] = useState("");
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState("");
  const lastImgFetchKeyRef = useRef(null);

  // Chỉ dùng SEMANTIC / hoặc image
  const [similar, setSimilar] = useState([]);
  const [simLoading, setSimLoading] = useState(false);

  // User + Favorites (nếu cần cho QuickView sau này)
  const [userId, setUserId] = useState(null);
  const [userReady, setUserReady] = useState(false);
  const [favorites, setFavorites] = useState(() => new Set());
  const [favInflight, setFavInflight] = useState(() => new Set());

  // Quick View
  const [openQuick, setOpenQuick] = useState(false);
  const [quickItem, setQuickItem] = useState(null);
  const openQuickView = (p) => {
    setQuickItem(p);
    setOpenQuick(true);
  };
  const closeQuickView = () => setOpenQuick(false);

  // Neo để cuộn lên đầu khi đổi query
  const topRef = useRef(null);
  useEffect(() => {
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => {
        if (!topRef.current) window.scrollTo({ top: 0, behavior: "smooth" });
      }, 120);
    });
  }, [q, isImageMode, imgVer]);

  // Lấy profile nhẹ (tuỳ chọn, nếu cần favorite/quickview)
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const prof = await getMyProfile(authFetch).catch(() => null);
        if (cancel) return;
        const uid = prof?.result?.id ?? prof?.id ?? null;
        setUserId(uid || null);

        const favIds =
          prof?.result?.favoriteProductIds ?? prof?.favoriteProductIds ?? [];
        if (Array.isArray(favIds) && favIds.length) {
          setFavorites(new Set(favIds.map((x) => String(x))));
        }
      } catch {
        setUserId(null);
        setFavorites(new Set());
      } finally {
        if (!cancel) setUserReady(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [authFetch]);

  // ---- IMAGE SEARCH: đọc từ sessionStorage và gọi API (multipart) ----
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!isImageMode) return;
      let currentKey = imgVer || "";
      if (!currentKey) {
        try {
          const raw = sessionStorage.getItem(IMG_STORE_KEY);
          const p = raw ? JSON.parse(raw) : null;
          currentKey = String(p?.ts || "");
        } catch {}
      }
      if (lastImgFetchKeyRef.current === currentKey && currentKey) return;
      lastImgFetchKeyRef.current = currentKey || "__nover__";
      setSimilar([]);
      setImgError("");
      setImgLoading(true);

      try {
        const raw = sessionStorage.getItem(IMG_STORE_KEY);
        if (!raw)
          throw new Error("Không tìm thấy ảnh đã chọn. Vui lòng chọn lại.");
        const payload = JSON.parse(raw);
        if (!payload?.dataUrl) throw new Error("Ảnh không hợp lệ.");

        setImgPreview(payload.dataUrl);

        const blob = dataURLtoBlob(payload.dataUrl);
        const file = new File([blob], payload.name || "upload.png", {
          type: blob.type || "image/png",
        });

        const form = new FormData();
        form.append("image", file);
        form.append("top_k", String(SEMANTIC_TOP_K));

        const res = await fetch(
          apiUrl(API_CONFIG.endpoints.searchByImageMulti),
          {
            method: "POST",
            body: form,
          }
        );

        const text = await res.text();
        let json;
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          json = { message: text };
        }

        if (!res.ok) {
          throw new Error(json?.message || `HTTP ${res.status}`);
        }

        const arr = Array.isArray(json?.results) ? json.results : [];
        if (!cancelled) setSimilar(arr);
      } catch (err) {
        if (!cancelled) {
          setSimilar([]);
          setImgError(err?.message || "Tìm bằng hình ảnh thất bại.");
        }
      } finally {
        if (!cancelled) setImgLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isImageMode, imgVer]);

  // ---- SEMANTIC text ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isImageMode) {
        return;
      }

      if (!q) {
        setSimilar([]);
        return;
      }

      const fromState = location.state?.semantic;
      if (fromState?.query && Array.isArray(fromState?.results)) {
        if (!cancelled) setSimilar(fromState.results);
        try {
          sessionStorage.setItem(SEM_K(q), JSON.stringify(fromState));
        } catch {}
        return;
      }

      try {
        const cached = sessionStorage.getItem(SEM_K(q));
        if (cached) {
          const obj = JSON.parse(cached);
          if (
            obj?.query?.toLowerCase?.() === q.toLowerCase() &&
            Array.isArray(obj?.results)
          ) {
            if (!cancelled) setSimilar(obj.results);
            return;
          }
        }
      } catch {}

      setSimLoading(true);
      try {
        const url = apiUrl(API_CONFIG.endpoints.semanticSearchGemini);
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: q, top_k: SEMANTIC_TOP_K }),
          signal: controller.signal,
        });
        clearTimeout(t);

        const text = await res.text();
        let json;
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          json = { message: text };
        }

        if (res.ok && Array.isArray(json?.results)) {
          if (!cancelled) setSimilar(json.results);
          try {
            sessionStorage.setItem(
              SEM_K(q),
              JSON.stringify({
                query: q,
                results: json.results,
                total_results: json.total_results ?? json.results?.length ?? 0,
                success: json.success ?? true,
              })
            );
          } catch {}
        } else {
          if (!cancelled) setSimilar([]);
        }
      } catch {
        if (!cancelled) setSimilar([]);
      } finally {
        if (!cancelled) setSimLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, location.state, isImageMode]);

  // Handlers
  const onClickFavorite = async (productId, ev) => {
    if (!userReady || !userId) {
      navigate("/login");
      return;
    }
    const currentlyFav = favorites.has(productId);

    setFavorites((prev) => {
      const next = new Set(prev);
      if (currentlyFav) next.delete(productId);
      else next.add(productId);
      return next;
    });

    if (favInflight.has(productId)) return;
    setFavInflight((s) => new Set(s).add(productId));

    try {
      const favs = currentlyFav
        ? await removeFavorite(authFetch, { userId, productId })
        : await addFavorite(authFetch, { userId, productId });
      setFavorites(new Set(favs));

      if (!currentlyFav && ev && ev.currentTarget) {
        const card = ev.currentTarget.closest(".product-card");
        if (card) {
          const fly = document.createElement("div");
          fly.className = "fv-fly";
          fly.textContent = "❤";
          card.appendChild(fly);
          setTimeout(() => fly.remove(), 800);
        }
      }
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        setUserId(null);
        setFavorites(new Set());
        setUserReady(false);
        navigate("/login");
        return;
      }
      // rollback
      setFavorites((prev) => {
        const next = new Set(prev);
        if (currentlyFav) next.add(productId);
        else next.delete(productId);
        return next;
      });
    } finally {
      setFavInflight((s) => {
        const n = new Set(s);
        n.delete(productId);
        return n;
      });
    }
  };

  const headline = useMemo(() => {
    if (isImageMode) return "Kết quả cho hình ảnh đã chọn";
    if (!q) return "Kết quả tìm kiếm";
    return `Kết quả cho "${q}"`;
  }, [q, isImageMode]);

  return (
    <div className="home-wrapper">
      <div className="home-container">
        <div ref={topRef} />

        {/* ======= PHẦN TIÊU ĐỀ + ĐẾM SẢN PHẨM ======= */}
        <div className="section-card" style={{ marginTop: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 className="product-title" style={{ margin: 0 }}>
                {headline}
              </h2>
              {isImageMode && imgPreview && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <img
                    src={imgPreview}
                    alt="Ảnh đã chọn"
                    style={{
                      width: 36,
                      height: 36,
                      objectFit: "cover",
                      borderRadius: 6,
                      border: "1px solid #eee",
                    }}
                  />
                  <span style={{ color: "#888", fontSize: 20 }}></span>
                </div>
              )}
            </div>
            <div style={{ color: "#666" }}>
              {(isImageMode ? imgLoading : simLoading)
                ? "Đang tải…"
                : `${similar.length} sản phẩm`}
            </div>
          </div>
        </div>

        {/* ======= DANH SÁCH SẢN PHẨM ======= */}
        <div className="section-card product-grid">
          <div className="product-list">
            {(isImageMode ? imgLoading : simLoading) ? (
              <div style={{ padding: 16, textAlign: "center" }}>
                🔄 Đang tải gợi ý…
              </div>
            ) : !isImageMode && !q ? (
              <div style={{ padding: 16, textAlign: "center", color: "#666" }}>
                Nhập từ khoá để tìm sản phẩm.
              </div>
            ) : isImageMode && imgError ? (
              <div
                style={{ padding: 16, textAlign: "center", color: "#b91c1c" }}
              >
                ⚠ {imgError}
              </div>
            ) : similar.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: "#666" }}>
                <div style={{ fontSize: 18, marginBottom: 8 }}>
                  📭 Không có sản phẩm nào
                </div>
                <div style={{ marginBottom: 16 }}>
                  {isImageMode ? (
                    "Không tìm thấy kết quả cho hình ảnh đã chọn."
                  ) : (
                    <>
                      Không tìm thấy gợi ý cho "<strong>{q}</strong>"
                    </>
                  )}
                </div>
                <button className="pbtn primary" onClick={() => navigate("/")}>
                  🏠 Về trang chủ
                </button>
              </div>
            ) : (
              similar.map((it, idx) => {
                const p = it?.product || {};
                const pid = p._id || p.id;
                const name = p.name || "Sản phẩm";
                const imgs = Array.isArray(p.images) ? p.images : [];
                const { price, compare } = getCardPrice(p);
                const imgUrl = pickImageUrl(imgs);

                return (
                  <div
                    key={`${pid || ""}-${idx}`}
                    className={`product-card ${
                      !(userReady && userId) ? "hide-fav" : ""
                    }`}
                    data-pid={pid}
                    onClick={() => navigate(`/products/${pid}`)}
                    title={it?.matched_text ? `Matched: ${it.matched_text}` : name}
                  >
                    {userReady && userId && (
                      <button
                        className={`fv-btn ${
                          favorites.has(String(pid)) ? "is-active" : ""
                        }`}
                        disabled={favInflight.has(String(pid))}
                        onClick={(e) => {
                          e.stopPropagation();
                          onClickFavorite(String(pid), e);
                        }}
                        aria-label="Yêu thích"
                        title={
                          favorites.has(String(pid))
                            ? "Bỏ yêu thích"
                            : "Thêm vào yêu thích"
                        }
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          className="fv-icon"
                          aria-hidden="true"
                        >
                          <path
                            d="M12.1 8.64l-.1.1-.11-.11C9.14 6.02 5.6 6.28 3.53 8.36a4.99 4.99 0 000 7.07L12 23l8.47-7.57a4.99 4.99 0 000-7.07c-2.07-2.08-5.61-2.34-8.37.28z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    )}

                    <img src={imgUrl} alt={name} />
                    <h3 title={name}>{name}</h3>

                    <div className="price-line">
                      <span className="price">
                        {price != null ? Number(price).toLocaleString() : "-"}₫
                      </span>
                      {compare != null && (
                        <span className="compare">
                          {Number(compare).toLocaleString()}₫
                        </span>
                      )}
                    </div>

                    <div className="card-actions">
                      <button
                        className="pbtn primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          openQuickView({
                            ...p,
                            id: pid,
                          });
                        }}
                      >
                        Mua ngay
                      </button>
                      <button
                        className="pbtn outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openQuickView({
                            ...p,
                            id: pid,
                          });
                        }}
                      >
                        Thêm vào giỏ
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Quick View Modal */}
      <ProductQuickView
        product={quickItem}
        isOpen={openQuick}
        onClose={closeQuickView}
        onAddToCart={async ({ product, size, qty }) => {
          try {
            if (!userReady || !userId) {
              alert("Vui lòng đăng nhập để thêm vào giỏ.");
              navigate("/login", {
                state: {
                  from: `/search?${
                    isImageMode ? "image=1" : `query=${encodeURIComponent(q)}`
                  }`,
                },
              });
              return;
            }
            const sellerId = String(
              product?.sellerId ?? product?.seller_id ?? ""
            ).trim();
            if (!sellerId)
              throw new Error("Không xác định được người bán (sellerId).");

            const hasSizes =
              Array.isArray(product?.sizes) && product.sizes.length > 0;
            const chosenSize = hasSizes
              ? size ?? product.sizes?.[0]?.size ?? "FREE"
              : "FREE";
            const sizeObj =
              (product?.sizes || []).find(
                (s) => String(s.size) === String(chosenSize)
              ) ||
              product?.sizes?.[0] ||
              {};
            const unitPriceRaw = sizeObj?.price ?? product?.price ?? 0;
            const unitPrice = Number(unitPriceRaw);
            if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
              throw new Error("Giá sản phẩm không hợp lệ (unitPrice <= 0).");
            }
            const quantity = Math.max(1, parseInt(qty, 10) || 1);

            const payload = {
              userId,
              productId: String(product.id),
              sellerId,
              sellerName: "",
              productName: product?.name || "",
              productImage: pickImageUrl(product?.images),
              size: String(chosenSize).toUpperCase(),
              unitPrice,
              quantity,
            };

            const res = await authFetch(apiUrl(API_CONFIG.endpoints.cartAdd), {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.code !== 200) {
              throw new Error(data?.message || `HTTP ${res.status}`);
            }
            alert(data?.message || "Đã thêm vào giỏ hàng!");
            closeQuickView();
          } catch (err) {
            console.error("Quick add-to-cart error:", err);
            alert(err.message || "Thêm vào giỏ thất bại.");
          }
        }}
        onBuyNow={async ({ product, size, qty }) => {
          try {
            if (!userReady || !userId) {
              alert("Vui lòng đăng nhập để mua ngay.");
              navigate("/login", {
                state: {
                  from: `/search?${
                    isImageMode ? "image=1" : `query=${encodeURIComponent(q)}`
                  }`,
                },
              });
              return;
            }
            const sellerId = String(
              product?.sellerId ?? product?.seller_id ?? ""
            ).trim();
            if (!sellerId)
              throw new Error("Không xác định được người bán (sellerId).");

            const hasSizes =
              Array.isArray(product?.sizes) && product.sizes.length > 0;
            const chosenSize = hasSizes
              ? size ?? product.sizes?.[0]?.size ?? "FREE"
              : "FREE";
            const sizeObj =
              (product?.sizes || []).find(
                (s) => String(s.size) === String(chosenSize)
              ) ||
              product?.sizes?.[0] ||
              {};
            const unitPriceRaw = sizeObj?.price ?? product?.price ?? 0;
            const unitPrice = Number(unitPriceRaw);
            if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
              throw new Error("Giá sản phẩm không hợp lệ (unitPrice <= 0).");
            }
            const quantity = Math.max(1, parseInt(qty, 10) || 1);

            const payload = {
              userId,
              productId: String(product.id),
              sellerId,
              sellerName: "",
              productName: product?.name || "",
              productImage: pickImageUrl(product?.images),
              size: String(chosenSize).toUpperCase(),
              unitPrice,
              quantity,
            };

            const res = await authFetch(apiUrl(API_CONFIG.endpoints.cartAdd), {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.code !== 200) {
              throw new Error(data?.message || `HTTP ${res.status}`);
            }
            const uniqueKey = `${payload.sellerId}-${payload.productId}-${payload.size || "FREE"}`;
            sessionStorage.setItem("cart_preselect", uniqueKey);
            closeQuickView();
            navigate("/cart", { state: { from: "buy_now" } });
          } catch (err) {
            console.error("Quick buy-now error:", err);
            alert(err.message || "Không thể mua ngay.");
          }
        }}
      />
    </div>
  );
}

export default SearchResults;
