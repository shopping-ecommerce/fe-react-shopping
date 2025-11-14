import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../../config/api";
import "../../../styles/home.css"; // tái dùng UI thẻ sản phẩm
import "../../../styles/AccountFavorites.css"; // override grid 3 cột
import ProductQuickView from "../home/ProductQuickView";
import {
  getMyProfile,
  getFavoriteProducts,
  removeFavorite,
  pickImageUrl,
} from "../../../services/favorites";
import { computePriceState, fmtPrice } from "../../../services/priceDisplay";

const AccountFavorites = () => {
  const navigate = useNavigate();
  const { authFetch } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [products, setProducts] = useState([]);
  const [userId, setUserId] = useState(null);
  const [inflight, setInflight] = useState(() => new Set());

  // 🔹 Quick View state
  const [openQuick, setOpenQuick] = useState(false);
  const [quickItem, setQuickItem] = useState(null);

  // 🔹 Cache sellerName theo sellerId
  const [sellerNameMap, setSellerNameMap] = useState({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const pf = await getMyProfile(authFetch);
        if (!pf?.id) throw new Error("No user");
        setUserId(pf.id);
        const favProducts = await getFavoriteProducts(authFetch);
        setProducts(favProducts);
      } catch (e) {
        if (e?.status === 401 || e?.status === 403) {
          navigate("/login");
          return;
        }
        console.error("❌ Lỗi load favorites:", e);
        setError(e?.message || "Đã xảy ra lỗi khi tải danh sách yêu thích.");
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetch, navigate]);

  const onClickUnfavorite = async (productId, ev) => {
    ev?.stopPropagation?.();
    if (!userId) {
      navigate("/login");
      return;
    }
    if (inflight.has(productId)) return;
    setInflight((s) => new Set(s).add(productId));

    // optimistic: ẩn ngay trên UI
    setProducts((prev) => prev.filter((p) => p.id !== productId));

    try {
      const favIds = await removeFavorite(authFetch, { userId, productId });
      const setIds = new Set(favIds);
      // đảm bảo đồng bộ chính xác với BE
      setProducts((prev) => prev.filter((p) => setIds.has(p.id)));
    } catch (e) {
      console.error("❌ Unfavorite failed:", e);
      setError(e?.message || "Không bỏ yêu thích được. Vui lòng thử lại.");
      try {
        const favProducts = await getFavoriteProducts(authFetch);
        setProducts(favProducts);
      } catch {}
    } finally {
      setInflight((s) => {
        const n = new Set(s);
        n.delete(productId);
        return n;
      });
    }
  };

  // ================== QUICK VIEW Helpers ==================

  const openQuickView = (p) => {
    setQuickItem(p);
    setOpenQuick(true);
  };
  const closeQuickView = () => setOpenQuick(false);

  // Lấy tên shop theo sellerId (ưu tiên từ product, rồi cache, rồi API)
  const ensureSellerName = async (product) => {
    const inline =
      product?.sellerName ||
      product?.seller?.shop_name ||
      product?.seller?.shopName ||
      product?.shopName;
    if (inline && String(inline).trim()) return String(inline).trim();

    const sid = String(product?.sellerId ?? product?.seller_id ?? "").trim();
    if (!sid) return "";

    if (sellerNameMap[sid]) return sellerNameMap[sid];

    try {
      const url = apiUrl(API_CONFIG.endpoints.searchSellerBySellerId(sid));
      const res = await authFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      const name =
        data?.result?.shop_name ||
        data?.result?.shopName ||
        data?.result?.name ||
        "";
      setSellerNameMap((m) => ({ ...m, [sid]: name || "" }));
      return name || "";
    } catch (e) {
      console.warn("ensureSellerName failed:", e);
      setSellerNameMap((m) => ({ ...m, [sid]: "" }));
      return "";
    }
  };

  // Dựng payload chuẩn như Home/Chi tiết (async vì cần ensureSellerName)
  const buildCartPayloadFromQuick = async ({ product, size, qty }) => {
    if (!product) throw new Error("Không có thông tin sản phẩm.");

    const sellerId = String(product.sellerId ?? product.seller_id ?? "").trim();
    if (!sellerId) throw new Error("Không xác định được người bán (sellerId).");

    const hasSizes = Array.isArray(product?.sizes) && product.sizes.length > 0;
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
    const sellerName = await ensureSellerName(product);

    const payload = {
      userId, // từ getMyProfile
      productId: String(product.id),
      sellerId,
      sellerName,
      productName: product?.name || "",
      productImage: pickImageUrl(product?.images),
      size: String(chosenSize).toUpperCase(),
      unitPrice,
      quantity,
    };

    console.log("[Favorites QV] cartAdd payload:", payload);
    return payload;
  };

  // ================== RENDER ==================

  const renderContent = () => {
    if (loading)
      return <div style={{ padding: 16 }}>Đang tải danh sách yêu thích…</div>;
    if (error) return <div style={{ padding: 16, color: "#c00" }}>{error}</div>;
    if (!products.length) {
      return (
        <div className="favorites-empty-state">
          <div className="favorites-illustration">
            {/* ... (SVG giữ nguyên) ... */}
          </div>

          <div className="favorites-message">
            <p className="favorites-text">
              Hãy <span className="favorites-heart">❤️</span> sản phẩm bạn yêu
              thích khi mua sắm để xem lại thuận tiện nhất
            </p>
          </div>

          <button
            className="favorites-continue-btn"
            onClick={() => navigate("/")}
          >
            Tiếp tục mua sắm
          </button>
        </div>
      );
    }

    // Có sản phẩm yêu thích → dùng grid/thẻ giống Home, nhưng 2 nút mở QuickView
    return (
      <div className="product-list favorites-grid">
        {products.map((p) => {
          // ✅ TÍNH GIÁ GIỐNG HỆT QUICK VIEW (Favorites chưa chọn biến thể → dùng toàn bộ để tính range/single)
          const ps = computePriceState(p, {}, null);
          const busy = inflight.has(p.id);

          return (
            <div
              key={p.id}
              className="product-card"
              onClick={() => navigate(`/products/${p.id}`)}
              title={p.name}
            >
              {/* tim hiển thị active & cho phép bỏ yêu thích */}
              <button
                className={`fv-btn is-active ${busy ? "opacity-60" : ""}`}
                title="Bỏ yêu thích"
                aria-label="Bỏ yêu thích"
                disabled={busy}
                onClick={(e) => onClickUnfavorite(p.id, e)}
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

              <img src={pickImageUrl(p.images)} alt={p.name} />
              <h3 title={p.name}>{p.name}</h3>

              {/* ✅ HIỂN THỊ GIÁ Y HỆT QUICK VIEW */}
              <div className="price-line">
                {ps.mode === "exact" || ps.mode === "single" ? (
                  <>
                    <span className="price">{fmtPrice(ps.price)}</span>
                    {Number.isFinite(ps.compare) && ps.compare > ps.price && (
                      <span className="compare">{fmtPrice(ps.compare)}</span>
                    )}
                  </>
                ) : ps.mode === "range" ? (
                  <span className="price">
                    {fmtPrice(ps.priceMin)} – {fmtPrice(ps.priceMax)}
                  </span>
                ) : (
                  <span className="price">-đ</span>
                )}
              </div>

              <div className="card-actions">
                <button
                  className="pbtn primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    openQuickView(p);
                  }}
                >
                  Mua ngay
                </button>
                <button
                  className="pbtn outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    openQuickView(p);
                  }}
                >
                  Thêm vào giỏ
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="favorites-container">
      <div className="favorites-header">
        <h1 className="favorites-title">Danh sách yêu thích</h1>
      </div>
      <div className="favorites-content">{renderContent()}</div>

      {/* 🔻 Quick View modal (giống Home) */}
      <ProductQuickView
        product={quickItem}
        isOpen={openQuick}
        onClose={closeQuickView}
        onAddToCart={async ({ product, size, qty }) => {
          try {
            if (!userId) {
              alert("Vui lòng đăng nhập để thêm vào giỏ.");
              navigate("/login");
              return;
            }
            const payload = await buildCartPayloadFromQuick({
              product,
              size,
              qty,
            });

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
              console.error("[Favorites QV] cartAdd failed:", {
                status: res.status,
                data,
              });
              throw new Error(data?.message || `HTTP ${res.status}`);
            }
            alert(data?.message || "Đã thêm vào giỏ hàng!");
            closeQuickView();
          } catch (err) {
            console.error("Favorites quick add-to-cart error:", err);
            alert(err.message || "Thêm vào giỏ thất bại.");
          }
        }}
        onBuyNow={async ({ product, size, qty }) => {
          try {
            if (!userId) {
              alert("Vui lòng đăng nhập để mua ngay.");
              navigate("/login");
              return;
            }
            const payload = await buildCartPayloadFromQuick({
              product,
              size,
              qty,
            });

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
              console.error("[Favorites QV] buy-now failed:", {
                status: res.status,
                data,
              });
              throw new Error(data?.message || `HTTP ${res.status}`);
            }

            const uniqueKey = `${payload.sellerId}-${payload.productId}-${
              payload.size || "FREE"
            }`;
            sessionStorage.setItem("cart_preselect", uniqueKey);

            closeQuickView();
            navigate("/cart", { state: { from: "buy_now" } });
          } catch (err) {
            console.error("Favorites quick buy-now error:", err);
            alert(err.message || "Không thể mua ngay.");
          }
        }}
      />
    </div>
  );
};

export default AccountFavorites;
