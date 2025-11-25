// src/pages/products/ProductDetail.jsx
import React, { useEffect, useMemo, useState, useContext, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../../../contexts/AuthContext";
import {
  API_CONFIG,
  apiUrl,
  trackAddToCart,
  trackProductView,
} from "../../../config/api";
import "../../../styles/ProductDetail.css";
/* dùng lại card & grid của Home */
import "../../../styles/home.css";
/* QuickView */
import ProductQuickView from "../home/ProductQuickView";
import ProductReviews from "../../../components/reviews/ProductReviews";
import ProductRatingSummary from "../../../components/reviews/ProductRatingSummary";

import { showToast } from "../../../utils/toast";
import ReportProductModal from "../../../components/report/ReportProductModal";
import ProductDescription from "../../../components/tiptap/ProductDescription";
import {
  getMyProfile,
  addFavorite,
  removeFavorite,
} from "../../../services/favorites";

/* ========================= Helpers ========================= */
const pickImageUrl = (images = []) =>
  images.find(
    (it) =>
      typeof it?.url === "string" &&
      !String(it.url).toLowerCase().endsWith(".mp4")
  )?.url || "/img/default.png";

const normalize = (v) => (v == null ? "" : String(v)).trim();
const shallowEqual = (a = {}, b = {}) => {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (normalize(a[k]) !== normalize(b[k])) return false;
  return true;
};

/** Map mediaByOption => "Name::Value" -> imageURL */
const buildMediaMap = (mediaByOption = []) => {
  const map = {};
  (Array.isArray(mediaByOption) ? mediaByOption : []).forEach((m) => {
    const name = normalize(m?.optionName);
    const val = normalize(m?.optionValue);
    const img = typeof m?.image === "string" ? m.image.trim() : "";
    if (!name || !val || !img) return;
    if (!/^https?:\/\//.test(img)) return; // chỉ nhận URL http(s)
    map[`${name}::${val}`] = img;
  });
  return map;
};

/** Ảnh ưu tiên theo lựa chọn (ưu tiên Color/Màu/Màu sắc) */
const getActiveImageFromSelection = (selectedOptions, mediaMap) => {
  const preferOrder = ["color", "màu", "màu sắc"];
  const entries = Object.entries(selectedOptions || {}).sort((a, b) => {
    const ai = preferOrder.indexOf(normalize(a[0]).toLowerCase());
    const bi = preferOrder.indexOf(normalize(b[0]).toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  for (const [k, v] of entries) {
    const key = `${normalize(k)}::${normalize(v)}`;
    if (mediaMap[key]) return mediaMap[key];
  }
  return null;
};

/** Gom gallery từ mediaByOption + images[], loại mp4 & trùng */
const collectGallery = (p) => {
  const out = [];
  const seen = new Set();

  if (Array.isArray(p?.mediaByOption)) {
    p.mediaByOption.forEach((m) => {
      const u = typeof m?.image === "string" ? m.image.trim() : "";
      if (!u) return;
      const low = u.toLowerCase();
      if (!/^https?:\/\//.test(u)) return;
      if (low.endsWith(".mp4")) return;
      if (seen.has(u)) return;
      seen.add(u);
      out.push({
        url: u,
        _from: "mbo",
        optionName: m?.optionName,
        optionValue: m?.optionValue,
      });
    });
  }

  if (Array.isArray(p?.images) && p.images.length) {
    [...p.images]
      .filter((it) => {
        const u = typeof it?.url === "string" ? it.url.trim() : "";
        if (!u) return false;
        const low = u.toLowerCase();
        if (low.endsWith(".mp4")) return false;
        return true;
      })
      .sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))
      .forEach((it) => {
        const u = it.url.trim();
        if (seen.has(u)) return;
        seen.add(u);
        out.push({ url: u, _from: "images" });
      });
  }

  if (!out.length) return [{ url: "/img/default.png" }];
  return out;
};

/** Gộp optionDefs trùng tên + lấy values từ cả optionDefs và variants (giống QuickView) */
const buildOptionGroups = (variants = [], optionDefs = []) => {
  const nameKey = (s) => normalize(s).toLowerCase();
  const byName = new Map(); // key -> { name, values:Set }
  const order = [];

  if (Array.isArray(optionDefs) && optionDefs.length) {
    for (const d of optionDefs) {
      const rawName = typeof d === "string" ? d : d?.name ? String(d.name) : "";
      if (!rawName) continue;
      const key = nameKey(rawName);
      if (!byName.has(key)) {
        byName.set(key, { name: rawName, values: new Set() });
        order.push(key);
      }
      const vals = Array.isArray(d?.values)
        ? d.values.map((x) => String(x))
        : [];
      vals.forEach((v) => byName.get(key).values.add(v));
    }
  }

  for (const v of Array.isArray(variants) ? variants : []) {
    const ops = v?.options || {};
    for (const [k, val] of Object.entries(ops)) {
      const n = String(k);
      const key = nameKey(n);
      if (!byName.has(key)) {
        byName.set(key, { name: n, values: new Set() });
        order.push(key);
      }
      if (val != null && val !== "") byName.get(key).values.add(String(val));
    }
  }

  const groups = order.map((key) => {
    const g = byName.get(key);
    return {
      name: g.name,
      values: Array.from(g.values).sort((a, b) =>
        String(a).localeCompare(String(b), "vi", {
          sensitivity: "base",
          numeric: true,
        })
      ),
    };
  });

  return groups;
};

/** Chuẩn hoá keys option để gửi BE như QuickView */
const normalizeOptionKeysForBE = (opts) => {
  if (!opts) return null;
  const out = {};
  for (const [kRaw, v] of Object.entries(opts)) {
    const k = normalize(kRaw).toLowerCase();
    if (k === "size" || k === "kích cỡ" || k === "kích thước") {
      out["Kích cỡ"] = v;
    } else if (k === "color" || k === "màu" || k === "màu sắc") {
      out["Màu sắc"] = v;
    } else {
      out[kRaw] = v;
    }
  }
  return Object.keys(out).length ? out : null;
};

/** Giá min từ variants (giữ để dùng nơi cần) */
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

/* ========= ADDED: color helpers ========= */
const nkey = (s) => normalize(s).toLowerCase();
const isColorGroupName = (name) => {
  const k = nkey(name);
  return k === "color" || k === "màu" || k === "màu sắc";
};

// Map tên màu tiếng Việt phổ biến -> CSS
const VN_COLOR_MAP = new Map(
  Object.entries({
    đen: "#000000",
    trắng: "#ffffff",
    đỏ: "#ff0000",
    "xanh dương": "#1e90ff",
    "xanh biển": "#1e90ff",
    "xanh nước biển": "#1e90ff",
    "xanh lá": "#28a745",
    lục: "#28a745",
    vàng: "#ffd700",
    xám: "#808080",
    ghi: "#808080",
    nâu: "#8b4513",
    hồng: "#ff69b4",
    tím: "#800080",
    be: "#F5F5DC",
    kem: "#fffdd0",
    bạc: "silver",
    "vàng đồng": "#b8860b",
    đồng: "#b87333",
    "xanh đen": "#001a2b",
    "xanh navy": "#001f3f",
    "xanh ngọc": "#40e0d0",
    "xanh pastel": "#a7c7e7",
    "kem sữa": "#fff8e1",
    rêu: "#556b2f",
    than: "#36454f",
    xanh: "#2cc9d4ff",
  })
);

// Regex nhận diện mã màu
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_RE =
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i;
const HSL_RE =
  /^hsla?\(\s*\d{1,3}\s*,\s*(\d{1,3}%){1}\s*,\s*(\d{1,3}%){1}(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i;

const resolveCssColor = (raw) => {
  const v = nkey(raw);
  if (!v) return null;
  if (VN_COLOR_MAP.has(v)) return VN_COLOR_MAP.get(v);
  if (HEX_RE.test(v) || RGB_RE.test(v) || HSL_RE.test(v)) return raw; // giữ nguyên form người dùng
  // Một số tên tiếng Anh thông dụng
  const COMMON_EN = new Set([
    "black",
    "white",
    "red",
    "blue",
    "green",
    "yellow",
    "gray",
    "grey",
    "brown",
    "pink",
    "purple",
    "beige",
    "silver",
    "gold",
    "navy",
    "teal",
    "olive",
    "maroon",
    "orange",
    "cyan",
    "magenta",
    "indigo",
    "violet",
    "turquoise",
    "salmon",
    "khaki",
  ]);
  if (COMMON_EN.has(v)) return v;
  return null;
};

const filterVariantsBySelection = (variants = [], selection = {}) => {
  if (!Array.isArray(variants)) return [];
  const keys = Object.keys(selection || {}).filter(
    (k) =>
      selection[k] !== undefined && selection[k] !== null && selection[k] !== ""
  );
  if (!keys.length) return variants.slice();
  return variants.filter((v) => {
    const ops = v?.options || {};
    return keys.every((k) => nkey(ops[k]) === nkey(selection[k]));
  });
};

/* ========= ADDED: computePriceState (đồng bộ QuickView) ========= */
const computePriceState = (product, selectedOptions, selectedSizeLegacy) => {
  const hasVariants =
    Array.isArray(product?.variants) && product.variants.length > 0;
  const sizeListLegacy = Array.isArray(product?.sizes) ? product.sizes : [];

  if (hasVariants) {
    const selKeys = Object.keys(selectedOptions || {});
    if (selKeys.length) {
      const exact = product.variants.find((v) => {
        const ops = v?.options || {};
        return (
          selKeys.length === Object.keys(ops).length &&
          selKeys.every((k) => nkey(ops[k]) === nkey(selectedOptions[k]))
        );
      });
      if (exact && Number.isFinite(Number(exact.price))) {
        const price = Number(exact.price);
        const cmp = Number(exact.compareAtPrice);
        return {
          mode: "exact",
          price,
          compare: Number.isFinite(cmp) && cmp > price ? cmp : null,
        };
      }
    }
    const pool = filterVariantsBySelection(product.variants, selectedOptions);
    const prices = pool
      .map((v) => Number(v?.price))
      .filter((n) => Number.isFinite(n));
    if (prices.length) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (min === max) {
        const compares = pool
          .map((v) => Number(v?.compareAtPrice))
          .filter((n) => Number.isFinite(n) && n > min);
        let compare = null;
        if (compares.length) {
          const unique = Array.from(new Set(compares));
          if (unique.length === 1 && unique[0] > min) compare = unique[0];
        }
        return { mode: "single", price: min, compare };
      }
      return { mode: "range", priceMin: min, priceMax: max };
    }
  }

  if (!hasVariants && sizeListLegacy.length) {
    if (selectedSizeLegacy) {
      const s = sizeListLegacy.find(
        (it) => nkey(it?.size) === nkey(selectedSizeLegacy)
      );
      const p = Number(s?.price);
      const c = Number(s?.compareAtPrice);
      if (Number.isFinite(p)) {
        return {
          mode: "exact",
          price: p,
          compare: Number.isFinite(c) && c > p ? c : null,
        };
      }
    }
    const prices = sizeListLegacy
      .map((s) => Number(s?.price))
      .filter((n) => Number.isFinite(n));
    if (prices.length) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (min === max) {
        const compares = sizeListLegacy
          .map((s) => Number(s?.compareAtPrice))
          .filter((n) => Number.isFinite(n) && n > min);
        let compare = null;
        if (compares.length) {
          const unique = Array.from(new Set(compares));
          if (unique.length === 1 && unique[0] > min) compare = unique[0];
        }
        return { mode: "single", price: min, compare };
      }
      return { mode: "range", priceMin: min, priceMax: max };
    }
  }
  return { mode: "none" };
};

/* ========================= Component ========================= */
export default function ProductDetail() {
  // GỢI Ý
  const [recs, setRecs] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [showAllRecs, setShowAllRecs] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const topAnchorRef = useRef(null);
  const { id } = useParams();
  const { authFetch, isAuthenticated, authReady } = useContext(AuthContext);
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [seller, setSeller] = useState(null);
  const [sellerError, setSellerError] = useState(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [thumbStart, setThumbStart] = useState(0);
  const [qty, setQty] = useState(1);

  // const [liked, setLiked] = useState(false); // ❌ bỏ dùng

  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentSellerId, setCurrentSellerId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isBuying, setIsBuying] = useState(false);

  // ⭐️ Thêm mới:
  const [favorites, setFavorites] = useState(() => new Set());
  const [favInflight, setFavInflight] = useState(() => new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

  // fire-and-forget: tăng view cho 1 productId
  const incProductView = (pid) => {
    if (!pid) return;
    try {
      authFetch(apiUrl(API_CONFIG.endpoints.productView(pid)), {
        method: "GET",
        headers: { Accept: "application/json" },
      }).catch(() => {});
    } catch {}
  };

  // mở trang chi tiết kèm tăng view + tracking
  const openDetailWithView = (pid) => {
    incProductView(pid);
    try {
      if (currentUserId) trackProductView(currentUserId, pid);
    } catch {}
    navigate(`/products/${pid}`);
  };

  // QUICK VIEW
  const [openQuick, setOpenQuick] = useState(false);
  const [quickItem, setQuickItem] = useState(null);
  const openQuickView = (p) => {
    setQuickItem(p);
    setOpenQuick(true);
  };
  const closeQuickView = () => setOpenQuick(false);

  const goToShop = () => {
    const sid = seller?.id || product?.sellerId || product?.seller_id;
    if (!sid) return alert("Không tìm thấy sellerId của shop.");
    navigate(`/shop/${sid}`);
  };

  const isOwnerOfSeller = (sid) =>
    !!currentSellerId && String(currentSellerId) === String(sid);

  const handleToggleFavorite = async (ev) => {
    if (!authReady || !currentUserId) {
      showToast({
        title: "Cần đăng nhập",
        text: "Vui lòng đăng nhập để sử dụng Yêu thích.",
        type: "warning",
      });
      navigate(`/login`, { state: { from: `/products/${id}` } });
      return;
    }

    const sid = product?.sellerId || product?.seller_id;
    if (sid && isOwnerOfSeller(sid)) {
      showToast({
        title: "Không thể yêu thích",
        text: "Bạn là chủ shop — không thể yêu thích sản phẩm của chính mình.",
        type: "warning",
      });
      return;
    }

    const productId = product.id;
    const currentlyFav = favorites.has(productId);

    // Đã có request đang chạy cho sản phẩm này → bỏ qua
    if (favInflight.has(productId)) return;

    // Optimistic UI
    setFavorites((prev) => {
      const next = new Set(prev);
      if (currentlyFav) next.delete(productId);
      else next.add(productId);
      return next;
    });
    setFavInflight((s) => {
      const n = new Set(s);
      n.add(productId);
      return n;
    });

    try {
      const favs = currentlyFav
        ? await removeFavorite(authFetch, {
            userId: currentUserId,
            productId,
          })
        : await addFavorite(authFetch, {
            userId: currentUserId,
            productId,
          });

      // Cập nhật lại từ server
      setFavorites(new Set(favs));

      if (currentlyFav) {
        showToast({
          title: "Đã bỏ khỏi Yêu thích",
          text: "Sản phẩm đã được xóa khỏi danh sách yêu thích.",
          type: "info",
        });
      } else {
        showToast({
          title: "Đã thêm vào Yêu thích",
          text: "Bạn có thể xem lại trong danh sách yêu thích.",
          type: "success",
        });
      }
    } catch (err) {
      console.error("Toggle favorite failed:", err);

      // revert optimistic
      setFavorites((prev) => {
        const next = new Set(prev);
        if (currentlyFav) next.add(productId);
        else next.delete(productId);
        return next;
      });

      if (err?.status === 401 || err?.status === 403) {
        showToast({
          title: "Phiên đăng nhập hết hạn",
          text: "Vui lòng đăng nhập lại để tiếp tục.",
          type: "warning",
        });
        navigate(`/login`, { state: { from: `/products/${id}` } });
        return;
      }

      showToast({
        title: "Không thực hiện được",
        text: "Có lỗi khi cập nhật Yêu thích. Vui lòng thử lại.",
        type: "error",
      });
    } finally {
      setFavInflight((s) => {
        const n = new Set(s);
        n.delete(productId);
        return n;
      });
    }
  };

  /* ===== Load product + seller + profile ===== */
  useEffect(() => {
    if (!authReady) return;

    const ac = new AbortController();
    const { signal } = ac;

    (async () => {
      setSellerError(null);
      setProduct(null);
      setSeller(null);

      try {
        // (A) profile + sellerId của user hiện tại (nếu đăng nhập)
        // (A) profile + sellerId của user hiện tại (nếu đăng nhập)
        if (isAuthenticated) {
          try {
            // dùng service giống Home
            const me = await getMyProfile(authFetch);
            const uid = me?.id || me?.user_id || null;
            setCurrentUserId(uid);

            // ⭐️ Lấy danh sách sản phẩm yêu thích
            const favs = Array.isArray(me?.favorite_products)
              ? me.favorite_products
              : [];
            setFavorites(new Set(favs));

            if (uid) {
              try {
                const resSellerMe = await authFetch(
                  apiUrl(API_CONFIG.endpoints.searchSellerByUserId(uid)),
                  {
                    method: "GET",
                    headers: { Accept: "application/json" },
                    signal,
                  }
                );
                const dataSellerMe = await resSellerMe.json().catch(() => ({}));
                if (
                  resSellerMe.ok &&
                  (dataSellerMe?.result?.id || dataSellerMe?.result?.sellerId)
                ) {
                  setCurrentSellerId(
                    dataSellerMe.result.id || dataSellerMe.result.sellerId
                  );
                } else {
                  setCurrentSellerId(null);
                }
              } catch {
                setCurrentSellerId(null);
              }
            } else {
              setCurrentSellerId(null);
            }
          } catch (e) {
            console.error("Load profile failed:", e);
            setCurrentUserId(null);
            setCurrentSellerId(null);
            setFavorites(new Set());
          }
        } else {
          setCurrentUserId(null);
          setCurrentSellerId(null);
          setFavorites(new Set());
        }

        // (B) Lấy danh sách sản phẩm rồi find theo id (đúng API bạn gửi)
        const listRes = await fetch(apiUrl(API_CONFIG.endpoints.getProducts), {
          headers: { Accept: "application/json" },
          signal,
        });
        const listData = await listRes.json();
        if (!listRes.ok)
          throw new Error(listData.message || `HTTP ${listRes.status}`);

        const found = (listData?.result || []).find((p) => p.id === id);
        if (!found) throw new Error("Sản phẩm không tìm thấy");
        setProduct(found);

        // (C) Lấy seller của sản phẩm
        const sellerId = found.sellerId || found.seller_id;
        if (!sellerId) {
          setSellerError("Không tìm thấy sellerId trong sản phẩm");
          return;
        }
        const sellerRes = await fetch(
          apiUrl(API_CONFIG.endpoints.searchSellerBySellerId(sellerId)),
          { method: "GET", headers: { Accept: "application/json" }, signal }
        );
        const sellerData = await sellerRes.json();
        if (!sellerRes.ok)
          throw new Error(sellerData.message || `HTTP ${sellerRes.status}`);

        const shop = sellerData?.result;
        setSeller(
          shop
            ? {
                id: shop.id,
                shopName: shop.shop_name || "Shop",
                logoUrl: shop.avatar_link || "/img/default-shop.png",
                onlineStatus: shop.onlineStatus || "vừa xong",
                vouchers: shop.vouchers || [],
                ratings: shop.ratings || 384,
                productsCount: shop.products_count || 17,
                responseRate: shop.response_rate || "100%",
                responseTime: shop.response_time || "vài giờ",
                joined: shop.joined || "14 tháng trước",
                followers: shop.followers || 160,
              }
            : null
        );
        if (!shop) setSellerError("Shop không tồn tại");
      } catch (e) {
        if (signal.aborted) return;
        console.error("Load product detail failed:", e);
        setProduct(null);
        setSeller(null);
        setSellerError(e.message);
      }
    })();

    return () => ac.abort();
  }, [id, authReady, isAuthenticated, authFetch]);

  /* ===== Sản phẩm khác của shop ===== */
  const [sellerProducts, setSellerProducts] = useState([]);
  const [loadingSellerProducts, setLoadingSellerProducts] = useState(false);
  const [showAllSellerProducts, setShowAllSellerProducts] = useState(false);

  useEffect(() => {
    const sellerId = product?.sellerId || product?.seller_id;
    if (!sellerId) return;

    const ac = new AbortController();
    const { signal } = ac;

    (async () => {
      try {
        setLoadingSellerProducts(true);
        const url = apiUrl(
          `/product/searchBySeller/${encodeURIComponent(sellerId)}`
        );
        const res = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

        const list = Array.isArray(data?.result) ? data.result : [];
        setSellerProducts(list.filter((p) => p.id !== id));
      } catch (err) {
        if (signal.aborted) return;
        console.error("Load seller products failed:", err);
        setSellerProducts([]);
      } finally {
        if (!ac.signal.aborted) setLoadingSellerProducts(false);
      }
    })();

    return () => ac.abort();
  }, [product, id]);

  /* ===== Gợi ý cho bạn ===== */
  const [loadingRecsInternal, setLoadingRecsInternal] = useState(false); // giữ loading cục bộ cho skeleton
  useEffect(() => {
    if (!id) return;
    const ac = new AbortController();
    const { signal } = ac;

    (async () => {
      try {
        setLoadingRecs(true);
        setLoadingRecsInternal(true);
        const url = apiUrl(
          API_CONFIG.endpoints.semanticRecommendForProduct(id, "10\n")
        );
        const res = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal,
        });

        const text = await res.text();
        let json;
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          json = { message: text };
        }

        if (res.ok && Array.isArray(json?.results)) {
          const list = json.results.map((it) => it?.product).filter(Boolean);
          setRecs(list);
        } else {
          setRecs([]);
        }
      } catch (e) {
        if (!signal.aborted) {
          console.error("[recommend] error:", e);
          setRecs([]);
        }
      } finally {
        if (!signal.aborted) {
          setLoadingRecs(false);
          // trì hoãn 1 nhịp nhỏ để skeleton mượt
          setTimeout(() => setLoadingRecsInternal(false), 150);
        }
      }
    })();

    return () => ac.abort();
  }, [id]);

  useEffect(() => {
    setShowAllSellerProducts(false);
    setShowAllRecs(false);
  }, [id]);

  /* ===== Scroll to top khi đổi sản phẩm ===== */
  useEffect(() => {
    requestAnimationFrame(() => {
      if (topAnchorRef.current?.scrollIntoView) {
        topAnchorRef.current.scrollIntoView({
          behavior: "instant",
          block: "start",
        });
      } else {
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    });
  }, [id]);

  /* ====== VARIANTS (NEW) & SIZES (LEGACY) ====== */
  const hasVariants =
    Array.isArray(product?.variants) && product.variants.length > 0;

  // dùng thuật toán gộp nhóm giống QuickView
  const optionGroups = useMemo(
    () =>
      hasVariants
        ? buildOptionGroups(product.variants, product?.optionDefs)
        : [],
    [hasVariants, product?.variants, product?.optionDefs]
  );

  const [selectedOptions, setSelectedOptions] = useState({});
  const [selectionTouched, setSelectionTouched] = useState(false);

  // === Availability check like QuickView (dựa trên lựa chọn hiện tại & quantity > 0)
  const isVariantValueAvailable = (groupName, value) => {
    if (!hasVariants || !Array.isArray(product?.variants)) return true;

    const want = normalize(value);
    const keepKeys = Object.keys(selectedOptions).filter(
      (k) => k !== groupName
    );

    for (const v of product.variants) {
      if (v?.available === false) continue;
      const qty = Number(v?.quantity) || 0;
      if (qty <= 0) continue;

      const ops = v?.options || {};
      if (normalize(ops[groupName]) !== want) continue;

      const ok = keepKeys.every(
        (k) => normalize(ops[k]) === normalize(selectedOptions[k])
      );
      if (ok) return true;
    }
    return false;
  };

  // legacy sizes
  const sizeListLegacy = Array.isArray(product?.sizes) ? product.sizes : [];
  const [selectedSizeLegacy, setSelectedSizeLegacy] = useState(null);

  // KHÔNG reset auto-select người dùng khi đổi sp (vẫn reset state)
  useEffect(() => {
    setSelectedOptions({});
    setSelectedSizeLegacy(null);
    setSelectionTouched(false);
    setQty(1);
    setActiveIndex(0);
    setThumbStart(0);
  }, [product?.id]);

  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null;
    const keys = Object.keys(selectedOptions);
    if (!keys.length) return null;
    const pick = product.variants.find((v) => {
      const ops = v?.options || {};
      return keys.every(
        (k) => normalize(ops[k]) === normalize(selectedOptions[k])
      );
    });
    return pick || null;
  }, [hasVariants, product?.variants, selectedOptions]);

  /* ====== ADDED: TỰ ĐỘNG CHỌN BIẾN THỂ KHẢ DỤNG ĐẦU TIÊN ====== */
  const didAutoPickRef = useRef(false);
  useEffect(() => {
    if (!hasVariants || !product?.variants?.length) return;
    if (didAutoPickRef.current) return;
    // tìm biến thể còn hàng & available != false
    const v =
      product.variants.find((x) => {
        const q = Number(x?.quantity) || 0;
        return q > 0 && x?.available !== false;
      }) || product.variants[0];
    if (v && v.options && Object.keys(v.options).length) {
      didAutoPickRef.current = true;
      setSelectedOptions(v.options);
    }
  }, [hasVariants, product?.variants]);

  /* ====== HÌNH ẢNH ====== */
  const gallery = useMemo(() => collectGallery(product || {}), [product]);
  const images = useMemo(() => {
    const imgs = (product?.images || []).filter(
      (it) =>
        typeof it?.url === "string" &&
        !String(it.url).toLowerCase().endsWith(".mp4")
    );
    return imgs.length ? imgs : [{ url: "/img/default.png" }];
  }, [product]);

  // giữ active trong cửa sổ 3 thumb
  useEffect(() => {
    const windowSize = 3;
    if (activeIndex < thumbStart) setThumbStart(activeIndex);
    else if (activeIndex >= thumbStart + windowSize)
      setThumbStart(activeIndex - (windowSize - 1));
  }, [activeIndex, thumbStart]);

  // Media map và ảnh ưu tiên theo lựa chọn
  const mediaMap = useMemo(
    () => buildMediaMap(product?.mediaByOption || []),
    [product?.mediaByOption]
  );

  /* ====== ADDED: HOVER PREVIEW CHO ẢNH ====== */
  const [hoverPreview, setHoverPreview] = useState(null); // { groupName, value }
  const effectiveSelection = useMemo(() => {
    if (!hoverPreview) return selectedOptions;
    return { ...selectedOptions, [hoverPreview.groupName]: hoverPreview.value };
  }, [selectedOptions, hoverPreview]);

  const activeImageUrlFromSelection = useMemo(
    () => getActiveImageFromSelection(effectiveSelection, mediaMap),
    [effectiveSelection, mediaMap]
  );

  const mainUrl =
    activeImageUrlFromSelection ||
    gallery[activeIndex]?.url ||
    images[activeIndex]?.url ||
    pickImageUrl(product?.images);

  /* ====== GIÁ & TỒN KHO (ĐỒNG BỘ QUICKVIEW) ====== */
  const priceState = useMemo(
    () => computePriceState(product, selectedOptions, selectedSizeLegacy),
    [product, selectedOptions, selectedSizeLegacy]
  );

  const maxQty = useMemo(() => {
    if (hasVariants && selectedVariant) {
      const q = Number(selectedVariant?.quantity);
      return Number.isFinite(q) ? q : Infinity;
    }
    if (!hasVariants && sizeListLegacy.length > 0) {
      const s = sizeListLegacy.find(
        (it) => normalize(it?.size) === normalize(selectedSizeLegacy)
      );
      const q = Number(s?.quantity);
      return Number.isFinite(q) ? q : Infinity;
    }
    return Infinity;
  }, [
    hasVariants,
    selectedVariant?.quantity,
    sizeListLegacy,
    selectedSizeLegacy,
  ]);

  // clamp qty khi maxQty đổi
  useEffect(() => {
    if (!Number.isFinite(maxQty)) return;
    setQty((q) => (q > maxQty ? maxQty : q));
  }, [maxQty]);

  /* ====== Handlers ====== */
  const onThumbArrowDown = () =>
    setActiveIndex((i) => (i + 1) % (gallery.length || images.length));
  const onThumbArrowUp = () =>
    setActiveIndex(
      (i) =>
        (i - 1 + (gallery.length || images.length)) %
        (gallery.length || images.length)
    );

  const handlePickOption = (groupName, value) => {
    const normVal = String(value);
    setSelectedOptions((prev) => {
      const curr = normalize(prev[groupName]);
      if (curr === normalize(normVal)) {
        const { [groupName]: _omit, ...rest } = prev;
        return rest;
      }
      const next = { ...prev, [groupName]: normVal };
      return shallowEqual(prev, next) ? prev : next;
    });
  };

  const handlePickSizeLegacy = (val) => {
    const raw = String(val);
    setSelectedSizeLegacy((prev) =>
      normalize(prev) === normalize(raw) ? null : raw
    );
  };

  const isOwnerTryingToBuy = () => {
    const sid = product?.sellerId || product?.seller_id;
    if (!sid || !currentSellerId) return false;
    return String(sid) === String(currentSellerId);
  };
  const notifyOwnerBlocked = () =>
    showToast({
      title: "Không thể thao tác",
      text: "Bạn là chủ shop — không được phép mua sản phẩm của chính mình.",
      type: "warning",
    });

  // Tính các nhóm còn thiếu (giống QuickView)
  const missingGroups = useMemo(() => {
    if (hasVariants) {
      return optionGroups
        .filter((g) => !normalize(selectedOptions[g.name]))
        .map((g) => g.name);
    }
    if (
      !hasVariants &&
      sizeListLegacy.length > 0 &&
      !normalize(selectedSizeLegacy)
    ) {
      return ["Size"];
    }
    return [];
  }, [
    hasVariants,
    optionGroups,
    selectedOptions,
    sizeListLegacy,
    selectedSizeLegacy,
  ]);

  const guardSelection = () => {
    if (missingGroups.length > 0) {
      setSelectionTouched(true);
      showToast({
        title: "Thiếu thông tin",
        text: `Vui lòng chọn: ${missingGroups.join(", ")}.`,
        type: "warning",
      });
      try {
        document.querySelector(".pd-variant")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } catch {}
      return false;
    }
    return true;
  };

  const requireLoginIfNeeded = () => {
    if (!authReady || !currentUserId) {
      showToast({
        title: "Cần đăng nhập",
        text: "Vui lòng đăng nhập để tiếp tục.",
        type: "warning",
      });
      navigate(`/login`, { state: { from: `/products/${id}` } });
      return true;
    }
    return false;
  };

  const buildOptionsForBEFromSelection = () => {
    const rawOptions = hasVariants
      ? selectedOptions
      : sizeListLegacy.length > 0
      ? { "Kích cỡ": selectedSizeLegacy }
      : null;
    return normalizeOptionKeysForBE(rawOptions);
  };

  // Tạo object item để đẩy thẳng sang Checkout (CheckoutPage đọc fields này)
  const buildCheckoutItem = () => {
    // chọn giá hiệu lực theo priceState
    let effectivePrice = 0;
    if (priceState.mode === "exact" && Number.isFinite(priceState.price)) {
      effectivePrice = Number(priceState.price);
    } else if (
      priceState.mode === "single" &&
      Number.isFinite(priceState.price)
    ) {
      effectivePrice = Number(priceState.price);
    } else if (
      priceState.mode === "range" &&
      Number.isFinite(priceState.priceMin)
    ) {
      effectivePrice = Number(priceState.priceMin);
    }
    const opts = buildOptionsForBEFromSelection();
    const sizeForCompat = (opts && (opts["Kích cỡ"] || opts["Size"])) || "FREE";

    return {
      productId: product.id,
      sellerId: product.sellerId || product.seller_id || seller?.id,
      title: product.name,
      qty: Math.max(1, Number(qty) || 1),
      price: effectivePrice,
      image: mainUrl || pickImageUrl(product.images),
      options: opts || {},
      size: sizeForCompat, // để CheckoutPage có thể remove giỏ sau khi đặt
    };
  };

  const handleAddToCart = async () => {
    try {
      if (isOwnerTryingToBuy()) return void notifyOwnerBlocked();
      if (requireLoginIfNeeded()) return;
      if (!guardSelection()) return;

      const sellerId = product.sellerId || product.seller_id || seller?.id;
      if (!sellerId) {
        showToast({
          title: "Lỗi",
          text: "Không xác định được người bán.",
          type: "error",
        });
        return;
      }

      const body = {
        userId: currentUserId,
        productId: product.id,
        sellerId,
        sellerName: seller?.shopName || "Shop",
        quantity: Math.max(1, parseInt(qty, 10) || 1),
        options: buildOptionsForBEFromSelection(),
      };

      setIsAdding(true);
      const res = await authFetch(apiUrl(API_CONFIG.endpoints.cartAdd), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      setIsAdding(false);

      if (!res.ok || (data?.code && data.code !== 200))
        throw new Error(data?.message || `HTTP ${res.status}`);

      showToast({
        title: "Thành công",
        text: "Đã thêm vào giỏ hàng",
        type: "success",
      });

      try {
        // theo giá hiệu lực từ priceState
        let priceForTrack = 0;
        if (priceState.mode === "exact" && Number.isFinite(priceState.price))
          priceForTrack = priceState.price;
        else if (
          priceState.mode === "single" &&
          Number.isFinite(priceState.price)
        )
          priceForTrack = priceState.price;
        else if (
          priceState.mode === "range" &&
          Number.isFinite(priceState.priceMin)
        )
          priceForTrack = priceState.priceMin;

        trackAddToCart(currentUserId, body.productId, {
          quantity: body.quantity,
          price: Number(priceForTrack) || 0,
        });
      } catch {}
    } catch (err) {
      setIsAdding(false);
      console.error("Lỗi thêm vào giỏ:", err);
      showToast({
        title: "Thêm vào giỏ thất bại",
        text: err?.message || "Có lỗi xảy ra.",
        type: "error",
      });
    }
  };

  const handleBuyNow = async () => {
    try {
      if (isOwnerTryingToBuy()) return void notifyOwnerBlocked();
      if (requireLoginIfNeeded()) return;
      if (!guardSelection()) return;

      const sellerId = product.sellerId || product.seller_id || seller?.id;
      if (!sellerId) {
        showToast({
          title: "Lỗi",
          text: "Không xác định được người bán.",
          type: "error",
        });
        return;
      }

      const body = {
        userId: currentUserId,
        productId: product.id,
        sellerId,
        sellerName: seller?.shopName || "Shop",
        quantity: Math.max(1, parseInt(qty, 10) || 1),
        options: buildOptionsForBEFromSelection(),
      };

      setIsBuying(true);
      const res = await authFetch(apiUrl(API_CONFIG.endpoints.cartAdd), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data?.code && data.code !== 200))
        throw new Error(data?.message || `HTTP ${res.status}`);

      // item cho Checkout
      const checkoutItem = buildCheckoutItem();

      // Optionally đánh dấu preselect trong cart
      try {
        const sizeKey = (
          checkoutItem.options?.["Kích cỡ"] || "FREE"
        ).toUpperCase();
        const uniqueKey = `${body.sellerId}-${body.productId}-${sizeKey}`;
        sessionStorage.setItem("cart_preselect", uniqueKey);
      } catch {}

      try {
        trackAddToCart(currentUserId, body.productId, {
          quantity: body.quantity,
          price: checkoutItem.price,
        });
      } catch {}

      // ✅ Chuyển thẳng sang Checkout
      navigate("/checkout", {
        state: {
          items: [checkoutItem],
          userId: currentUserId,
          from: "buy_now",
        },
      });
    } catch (err) {
      console.error("Buy now error:", err);
      showToast({
        title: "Không thể mua ngay",
        text: err?.message || "Vui lòng thử lại sau.",
        type: "error",
      });
    } finally {
      setIsBuying(false);
    }
  };

  /* ===== Modal ảnh ===== */
  const openModalAt = (index) => {
    setModalIndex(index);
    setIsModalOpen(true);
  };
  const closeModal = () => setIsModalOpen(false);
  const modalPrev = () =>
    setModalIndex((i) => (i - 1 + images.length) % images.length);
  const modalNext = () => setModalIndex((i) => (i + 1) % images.length);

  if (!product) return <div className="product-detail-page">Đang tải…</div>;

  const visibleThumbs = (gallery.length ? gallery : images).slice(
    thumbStart,
    thumbStart + 3
  );

  /* ===== Skeleton helper (nhẹ, inline style) ===== */
  const SkeletonCard = () => (
    <div
      className="product-card"
      style={{
        pointerEvents: "none",
        animation: "pulse 1.2s ease-in-out infinite",
      }}
    >
      <div style={{ background: "#eee", width: "100%", paddingTop: "100%" }} />
      <div style={{ height: 12 }} />
      <div style={{ background: "#eee", height: 16, width: "80%" }} />
      <div style={{ height: 8 }} />
      <div style={{ background: "#f3f3f3", height: 14, width: "60%" }} />
      <style>{`
        @keyframes pulse { 
          0% { opacity: 0.6 } 
          50% { opacity: 1 } 
          100% { opacity: 0.6 } 
        }
      `}</style>
    </div>
  );

  return (
    <div className="product-detail-page" ref={topAnchorRef}>
      <div className="product-detail">
        {/* LEFT: GALLERY */}
        <div className="pd-gallery">
          <div className="pd-main-col">
            <div
              className="pd-main-image"
              onClick={() => openModalAt(activeIndex)}
            >
              <img src={mainUrl} alt={product.name} />
            </div>

            {/* Favorite */}
            {/* Favorite */}
            {(() => {
              const sid = product?.sellerId || product?.seller_id;
              const isOwnerProduct = sid && isOwnerOfSeller(sid);
              const isFav =
                currentUserId && favorites instanceof Set
                  ? favorites.has(product.id)
                  : false;

              return (
                <button
                  className={`favorite-btn ${isFav ? "active" : ""} ${
                    isOwnerProduct ? "is-owner" : ""
                  }`}
                  type="button"
                  title={
                    isOwnerProduct
                      ? "Bạn là chủ shop — không thể yêu thích sản phẩm của mình."
                      : isFav
                      ? "Bỏ khỏi danh sách yêu thích"
                      : "Thêm vào danh sách yêu thích"
                  }
                  disabled={favInflight.has(product.id) || isOwnerProduct}
                  onClick={handleToggleFavorite}
                >
                  <svg
                    className="favorite-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M12.001 20.727c-.2 0-.401-.06-.573-.18C9.3 19.07 3 14.74 3 9.41 3 7.03 4.882 5 7.23 5c1.42 0 2.79.68 3.77 1.84A5.04 5.04 0 0 1 14.77 5c2.35 0 4.23 2.03 4.23 4.41 0 5.33-6.3 9.66-8.428 11.137a1.01 1.01 0 0 1-.571.18Z" />
                  </svg>
                  Thêm vào danh sách yêu thích
                </button>
              );
            })()}
          </div>

          {/* THUMBS: 3 ảnh + mũi tên */}
          <div className="pd-thumbs-vertical">
            {thumbStart > 0 && (
              <button
                className="pd-thumb-arrow-up"
                type="button"
                aria-label="Ảnh trước"
                title="Ảnh trước"
                onClick={onThumbArrowUp}
              >
                ▴
              </button>
            )}

            <div className="pd-thumbs-window">
              {visibleThumbs.map((img, i) => {
                const realIndex = thumbStart + i;
                return (
                  <button
                    key={realIndex}
                    className={`pd-thumb-vert ${
                      realIndex === activeIndex ? "active" : ""
                    }`}
                    onClick={() => setActiveIndex(realIndex)}
                    aria-label={`Ảnh ${realIndex + 1}`}
                    title="Xem ảnh"
                  >
                    <img src={img.url} alt={`thumb-${realIndex}`} />
                  </button>
                );
              })}
            </div>

            <button
              className="pd-thumb-arrow-down"
              type="button"
              aria-label="Ảnh tiếp theo"
              title="Ảnh tiếp theo"
              onClick={onThumbArrowDown}
            >
              ▾
            </button>
          </div>
        </div>

        {/* RIGHT: INFO */}
        <div className="pd-info">
          <div className="pd-title-row">
            <h1 className="pd-title">{product.name}</h1>

            <button
              type="button"
              className="pd-warn"
              title="Báo cáo sản phẩm"
              aria-label="Báo cáo sản phẩm"
              onClick={() => setReportOpen(true)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <polygon
                  points="12,2 2,22 22,22"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <rect x="11" y="8" width="2" height="6" fill="#fff" />
                <circle cx="12" cy="17" r="1.6" fill="#fff" />
              </svg>
            </button>
          </div>

          <div className="pd-meta">
            <ProductRatingSummary productId={id} className="pd-rating" />
            <span className="pd-sep" aria-hidden="true">
              |
            </span>
            <span className="pd-stat">
              🛒 {Number(product.soldCount ?? 0).toLocaleString()} đã bán
            </span>
            <span className="pd-sep" aria-hidden="true">
              |
            </span>
            <span className="pd-stat">
              👁️ {Number(product.viewCount ?? 0).toLocaleString()} lượt xem
            </span>
          </div>

          {/* Giá — đồng bộ QuickView: exact | single | range */}
          <div className="pd-price-plain pd-space-block">
            {priceState.mode === "exact" && (
              <>
                <span className="pd-price">
                  {Number(priceState.price).toLocaleString()}đ
                </span>
                {Number.isFinite(priceState.compare) &&
                  priceState.compare > priceState.price && (
                    <span className="pd-compare">
                      {Number(priceState.compare).toLocaleString()}đ
                    </span>
                  )}
              </>
            )}
            {priceState.mode === "single" && (
              <>
                <span className="pd-price">
                  {Number(priceState.price).toLocaleString()}đ
                </span>
                {Number.isFinite(priceState.compare) &&
                  priceState.compare > priceState.price && (
                    <span className="pd-compare">
                      {Number(priceState.compare).toLocaleString()}đ
                    </span>
                  )}
              </>
            )}
            {priceState.mode === "range" && (
              <span className="pd-price">
                {Number(priceState.priceMin).toLocaleString()} –{" "}
                {Number(priceState.priceMax).toLocaleString()}đ
              </span>
            )}
            {priceState.mode === "none" && <span className="pd-price">-đ</span>}
          </div>

          {/* ====== NEW VARIANT UI (giống QuickView) ====== */}
          {hasVariants && optionGroups.length > 0 && (
            <div className="pd-space-block">
              {optionGroups.map((grp) => {
                const gName = grp.name;
                const missing =
                  selectionTouched && !normalize(selectedOptions[gName]);
                const isColorGroup = isColorGroupName(gName);

                return (
                  <div
                    key={`grp-${gName}`}
                    className={`pd-variant pd-variant--inline ${
                      missing ? "has-error" : ""
                    }`}
                  >
                    <div className="variant-label">{gName}</div>
                    <div className="variant-options">
                      {grp.values.map((val, vi) => {
                        const active =
                          normalize(selectedOptions[gName]) === normalize(val);
                        const disabled = !isVariantValueAvailable(gName, val);

                        const mediaKey = `${normalize(gName)}::${normalize(
                          val
                        )}`;
                        const thumb = mediaMap[mediaKey];

                        // xác định màu dot cho nhóm Màu (và nếu value là mã màu)
                        const colorCss = isColorGroup
                          ? resolveCssColor(val) || null
                          : null;

                        return (
                          <button
                            key={`opt-${gName}-${vi}-${val}`}
                            type="button"
                            className={`option-chip ${active ? "active" : ""} ${
                              disabled ? "disabled" : ""
                            }`}
                            onClick={() => {
                              if (disabled) return;
                              handlePickOption(gName, val);
                            }}
                            onMouseEnter={() =>
                              setHoverPreview({ groupName: gName, value: val })
                            }
                            onMouseLeave={() => setHoverPreview(null)}
                            aria-pressed={active}
                            aria-disabled={disabled}
                            disabled={disabled}
                            title={
                              isColorGroup
                                ? `${disabled ? "Hết hàng" : ""}`.trim()
                                : String(val) + (disabled ? " (Hết hàng)" : "")
                            }
                          >
                            {/* ẢNH THUMB (luôn giữ) */}
                            {thumb ? (
                              <span
                                className="chip-thumb"
                                style={{ marginRight: 6 }}
                              >
                                <img
                                  src={thumb}
                                  alt={isColorGroup ? "" : String(val)}
                                  style={{
                                    width: 18,
                                    height: 18,
                                    objectFit: "cover",
                                    borderRadius: 3,
                                  }}
                                />
                              </span>
                            ) : null}

                            {/* CHẤM MÀU (chỉ nhóm Màu) */}
                            {isColorGroup && colorCss ? (
                              <span
                                aria-hidden
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: "50%",
                                  background: colorCss,
                                  display: "inline-block",
                                  boxShadow: active
                                    ? "0 0 0 2px #111 inset"
                                    : "0 0 0 1px rgba(0,0,0,.2) inset",
                                }}
                              />
                            ) : null}

                            {/* VỚI NHÓM MÀU: KHÔNG HIỂN THỊ CHỮ */}
                            {/* NHÓM KHÁC: GIỮ CHỮ NHƯ CŨ */}
                            {!isColorGroup && (
                              <span style={{ marginLeft: thumb ? 6 : 0 }}>
                                {String(val)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ====== LEGACY SIZE UI ====== */}
          {!hasVariants && sizeListLegacy.length > 0 && (
            <div
              className={`pd-variant pd-space-block ${
                selectionTouched && !selectedSizeLegacy ? "has-error" : ""
              }`}
            >
              <div className="variant-label">Size</div>
              <div className="variant-options">
                {sizeListLegacy.map((s, idx) => {
                  const val = normalize(s?.size);
                  const isActive = normalize(selectedSizeLegacy) === val;
                  const qty = Number(s?.quantity);
                  const disabled = Number.isFinite(qty) && qty <= 0;

                  return (
                    <button
                      key={idx}
                      className={`option-chip ${isActive ? "active" : ""} ${
                        disabled ? "disabled" : ""
                      }`}
                      onClick={() => {
                        if (disabled) return;
                        handlePickSizeLegacy(val);
                      }}
                      aria-label={`Chọn size ${String(s.size).toUpperCase()}`}
                      aria-disabled={disabled}
                      disabled={disabled}
                      title={
                        String(s.size).toUpperCase() +
                        (disabled ? " (Hết hàng)" : "")
                      }
                    >
                      {String(s.size).toUpperCase()}
                    </button>
                  );
                })}
              </div>
              {selectionTouched && !selectedSizeLegacy && (
                <div className="size-error-msg" role="alert">
                  Vui lòng chọn size trước khi tiếp tục.
                </div>
              )}
            </div>
          )}

          {/* ====== TỒN KHO (trên Số lượng) ====== */}
          <div className="pd-row pd-space-block" style={{ marginTop: 6 }}>
            <div className="label">Tồn kho</div>
            <div className="value" style={{ fontWeight: 700, color: "#111" }}>
              {Number.isFinite(maxQty) ? maxQty : "∞"}
            </div>
          </div>

          {/* SỐ LƯỢNG */}
          <div className="pd-row pd-qty pd-space-block">
            <div className="label">Số lượng</div>
            <div className="value">
              <div className="qty-control">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  −
                </button>
                <input
                  value={qty}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value) || 1);
                    setQty(
                      Number.isFinite(maxQty) ? Math.min(val, maxQty) : val
                    );
                  }}
                />
                <button
                  onClick={() =>
                    setQty((q) =>
                      Number.isFinite(maxQty) ? Math.min(maxQty, q + 1) : q + 1
                    )
                  }
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="pd-actions">
            <button
              className="btn-outline-dark"
              onClick={() => {
                setSelectionTouched(true);
                handleAddToCart();
              }}
              disabled={isAdding || isBuying}
              title={isAdding ? "Đang thêm..." : "Thêm Vào Giỏ Hàng"}
            >
              {isAdding ? "Đang thêm..." : "Thêm Vào Giỏ Hàng"}
            </button>

            <button
              className="btn-primary-dark"
              onClick={() => {
                setSelectionTouched(true);
                handleBuyNow();
              }}
              disabled={isBuying || isAdding}
              title={isBuying ? "Đang xử lý..." : "Mua Ngay"}
            >
              {isBuying ? "Đang xử lý..." : "Mua Ngay"}
            </button>
          </div>
        </div>
      </div>

      {/* Seller */}
      <div className="pd-seller-card">
        {seller ? (
          <div className="pd-seller-header">
            <div className="pd-seller-left">
              <img
                src={seller.logoUrl || "/img/default-shop.png"}
                alt={seller.shopName || "Shop"}
                className="pd-seller-avatar"
              />
              <div className="pd-seller-info">
                <h3>By {seller.shopName || "Shop"}</h3>
                <p>Online {seller.onlineStatus || "vừa xong"}</p>
                <div className="pd-seller-actions">
                  <button
                    className="btn-chat"
                    onClick={() => {
                      const sid =
                        seller?.id || product?.sellerId || product?.seller_id;
                      if (!sid) {
                        alert("Không tìm thấy sellerId của shop.");
                        return;
                      }

                      // Tính giá để gửi qua chat (giống logic buy now / add to cart)
                      let chatPrice = 0;
                      if (
                        priceState.mode === "exact" &&
                        Number.isFinite(priceState.price)
                      ) {
                        chatPrice = Number(priceState.price);
                      } else if (
                        priceState.mode === "single" &&
                        Number.isFinite(priceState.price)
                      ) {
                        chatPrice = Number(priceState.price);
                      } else if (
                        priceState.mode === "range" &&
                        Number.isFinite(priceState.priceMin)
                      ) {
                        chatPrice = Number(priceState.priceMin);
                      }

                      const productLink = `${window.location.origin}/products/${product.id}`;

                      navigate(
                        `/chat-shop?sellerId=${encodeURIComponent(sid)}`,
                        {
                          state: {
                            sellerName: seller?.shopName || "Shop",
                            sellerAvatar:
                              seller?.logoUrl || "/img/default-shop.png",
                            autoGreet: true,
                            // ✅ Gửi thêm thông tin sản phẩm
                            initialProduct: {
                              id: product.id,
                              name: product.name,
                              image: mainUrl || pickImageUrl(product.images),
                              price: chatPrice,
                              link: productLink,
                            },
                          },
                        }
                      );
                    }}
                  >
                    💬 Chat Ngay
                  </button>

                  <button className="btn-outline shop-btn" onClick={goToShop}>
                    🏬 Xem Shop
                  </button>
                </div>
              </div>
            </div>

            <div className="pd-seller-stats">
              <div>
                <span className="label">Đánh Giá</span>
                <span className="value">{seller.ratings ?? 0}</span>
              </div>
              <div>
                <span className="label">Tỉ Lệ Phản Hồi</span>
                <span className="value">{seller.responseRate ?? "—"}</span>
              </div>
              <div>
                <span className="label">Tham Gia</span>
                <span className="value">{seller.joined ?? "—"}</span>
              </div>
              <div>
                <span className="label">Sản Phẩm</span>
                <span className="value">{seller.productsCount ?? 0}</span>
              </div>
              <div>
                <span className="label">Thời Gian</span>
                <span className="value">{seller.responseTime ?? "—"}</span>
              </div>
              <div>
                <span className="label">Người Theo Dõi</span>
                <span className="value">{seller.followers ?? 0}</span>
              </div>
            </div>
          </div>
        ) : (
          <div>{sellerError || "Đang tải thông tin shop…"}</div>
        )}
      </div>

      {/* Mô tả */}
      <div className="pd-desc-card">
        <h3>Mô tả sản phẩm</h3>
        <ProductDescription html={product?.description} isEscaped />
      </div>

      {/* === ĐÁNH GIÁ SẢN PHẨM === */}
      <ProductReviews productId={id} />

      {/* Các sản phẩm khác của shop */}
      <div className="pd-seller-more">
        <div className="pd-seller-more-head">
          <h3>Các sản phẩm khác của shop</h3>
          {seller?.id && (
            <button
              className="pd-seller-more-view"
              onClick={() => navigate(`/shop/${seller.id}`)}
              title="Xem shop"
            >
              Xem shop &gt;
            </button>
          )}
        </div>

        {loadingSellerProducts ? (
          <div className="product-list product-list-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={`spskel-${i}`} />
            ))}
          </div>
        ) : sellerProducts.length === 0 ? (
          <div className="pd-seller-more-empty">
            Shop chưa có sản phẩm khác.
          </div>
        ) : (
          <div className="product-list product-list-5">
            {(showAllSellerProducts
              ? sellerProducts
              : sellerProducts.slice(0, 5)
            ).map((p) => {
              // Lấy giá chuẩn
              const firstSize =
                Array.isArray(p?.sizes) && p.sizes.length ? p.sizes[0] : null;
              const price =
                firstSize && firstSize.price != null
                  ? Number(firstSize.price)
                  : Array.isArray(p?.variants) && p.variants.length
                  ? priceFromVariants(p.variants).price
                  : null;
              const compare =
                firstSize && firstSize.compareAtPrice != null
                  ? Number(firstSize.compareAtPrice)
                  : Array.isArray(p?.variants) && p.variants.length
                  ? priceFromVariants(p.variants).compare
                  : null;

              return (
                <div
                  key={p.id}
                  className="product-card"
                  onClick={() => openDetailWithView(p.id)}
                  title={p.name}
                >
                  <img src={pickImageUrl(p.images)} alt={p.name} />
                  <h3>{p.name}</h3>

                  <div className="price-line">
                    <span className="price">
                      {Number.isFinite(price)
                        ? Number(price).toLocaleString()
                        : "-"}
                      ₫
                    </span>
                    {Number.isFinite(compare) && (
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
        )}
        {sellerProducts.length > 5 && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button
              className="pbtn outline"
              onClick={() => setShowAllSellerProducts((v) => !v)}
            >
              {showAllSellerProducts ? "Ẩn bớt" : "Xem thêm"}
            </button>
          </div>
        )}
      </div>

      {/* Gợi ý cho bạn */}
      <div className="pd-seller-more" style={{ marginTop: 16 }}>
        <div className="pd-seller-more-head">
          <h3>Sản phẩm tương tự</h3>
        </div>

        {loadingRecs || loadingRecsInternal ? (
          <div className="product-list product-list-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={`recs-skel-${i}`} />
            ))}
          </div>
        ) : recs.length === 0 ? (
          <div className="pd-seller-more-empty">Chưa có gợi ý phù hợp.</div>
        ) : (
          <div className="product-list product-list-5">
            {(showAllRecs ? recs : recs.slice(0, 5)).map((p, idx) => {
              const pid = p._id || p.id;
              const name = p.name || "Sản phẩm";
              const img = pickImageUrl(p.images);

              const firstSize =
                Array.isArray(p?.sizes) && p.sizes.length ? p.sizes[0] : null;
              const vMin =
                Array.isArray(p?.variants) && p.variants.length
                  ? priceFromVariants(p.variants)
                  : null;
              const price = firstSize
                ? Number(firstSize.price)
                : vMin?.price ?? null;
              const compare = firstSize
                ? Number(firstSize.compareAtPrice)
                : vMin?.compare ?? null;

              return (
                <div
                  key={`${pid}-${idx}`}
                  className="product-card"
                  onClick={() => openDetailWithView(pid)}
                  title={name}
                >
                  <img src={img} alt={name} />
                  <h3>{name}</h3>

                  <div className="price-line">
                    <span className="price">
                      {Number.isFinite(price)
                        ? Number(price).toLocaleString()
                        : "-"}
                      ₫
                    </span>
                    {Number.isFinite(compare) && (
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
                          id: pid,
                          name,
                          images: p.images || [],
                          sizes: p.sizes || [],
                          sellerId: p.sellerId || p.seller_id || "",
                          variants: p.variants || [],
                          optionDefs: p.optionDefs || [],
                          mediaByOption: p.mediaByOption || [],
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
                          id: pid,
                          name,
                          images: p.images || [],
                          sizes: p.sizes || [],
                          sellerId: p.sellerId || p.seller_id || "",
                          variants: p.variants || [],
                          optionDefs: p.optionDefs || [],
                          mediaByOption: p.mediaByOption || [],
                        });
                      }}
                    >
                      Thêm vào giỏ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {recs.length > 5 && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button
              className="pbtn outline"
              onClick={() => setShowAllRecs((v) => !v)}
            >
              {showAllRecs ? "Ẩn bớt" : "Xem thêm"}
            </button>
          </div>
        )}
      </div>

      {/* Modal ảnh */}
      {isModalOpen && (
        <div className="img-modal" onClick={closeModal}>
          <div className="img-modal-inner" onClick={(e) => e.stopPropagation()}>
            <button
              className="img-modal-close"
              onClick={closeModal}
              aria-label="Đóng"
            >
              ×
            </button>
            <div className="img-modal-content">
              <div className="img-modal-left">
                <button
                  className="img-modal-nav left"
                  onClick={modalPrev}
                  aria-label="Ảnh trước"
                >
                  ‹
                </button>
                <img
                  src={images[modalIndex]?.url}
                  alt={`Ảnh ${modalIndex + 1}`}
                  className="img-modal-photo"
                />
                <button
                  className="img-modal-nav right"
                  onClick={modalNext}
                  aria-label="Ảnh sau"
                >
                  ›
                </button>
              </div>
              <div className="img-modal-right">
                <div className="img-modal-thumbs">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      className={`img-modal-thumb ${
                        i === modalIndex ? "active" : ""
                      }`}
                      onClick={() => setModalIndex(i)}
                      aria-label={`Ảnh ${i + 1}`}
                    >
                      <img src={img.url} alt={`thumb-${i}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick View */}
      <ProductQuickView
        product={quickItem}
        isOpen={openQuick}
        onClose={closeQuickView}
        onAddToCart={async ({ product, options, qty }) => {
          try {
            const sid = product?.sellerId || product?.seller_id || seller?.id;
            if (sid && isOwnerOfSeller(sid)) {
              showToast({
                title: "Không thể thao tác",
                text: "Bạn là chủ shop — không được phép mua sản phẩm của chính mình.",
                type: "warning",
              });
              return;
            }
            if (!authReady || !currentUserId) {
              navigate(`/login`, { state: { from: `/products/${id}` } });
              return;
            }

            const res = await authFetch(apiUrl(API_CONFIG.endpoints.cartAdd), {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                userId: currentUserId,
                productId: product.id,
                sellerId: sid,
                sellerName: seller?.shopName || "",
                quantity: Math.max(1, Number(qty) || 1),
                options: options || null,
              }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.code !== 200)
              throw new Error(data?.message || `HTTP ${res.status}`);
            showToast({
              title: "Thành công",
              text: data?.message || "Đã thêm vào giỏ hàng!",
              type: "success",
            });
            try {
              trackAddToCart(currentUserId, product.id, {
                quantity: Math.max(1, Number(qty) || 1),
                price: 0,
              });
            } catch {}
            closeQuickView();
          } catch (err) {
            console.error("Quick add-to-cart error:", err);
            showToast({
              title: "Thêm vào giỏ thất bại",
              text: err.message || "Có lỗi xảy ra.",
              type: "error",
            });
          }
        }}
        onBuyNow={async ({ product, options, qty }) => {
          try {
            const sid = product?.sellerId || product?.seller_id || seller?.id;
            if (sid && isOwnerOfSeller(sid)) {
              showToast({
                title: "Không thể thao tác",
                text: "Bạn là chủ shop — không được phép mua sản phẩm của chính mình.",
                type: "warning",
              });
              return;
            }
            if (!authReady || !currentUserId) {
              showToast({
                title: "Cần đăng nhập",
                text: "Vui lòng đăng nhập để tiếp tục.",
                type: "warning",
              });
              navigate(`/login`, { state: { from: `/products/${id}` } });
              return;
            }

            const res = await authFetch(apiUrl(API_CONFIG.endpoints.cartAdd), {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                userId: currentUserId,
                productId: product.id,
                sellerId: sid,
                sellerName: seller?.shopName || "",
                quantity: Math.max(1, Number(qty) || 1),
                options: options || null,
              }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.code !== 200)
              throw new Error(data?.message || `HTTP ${res.status}`);

            // Build one checkout item & go to checkout
            const sizeForCompat =
              (options && (options["Kích cỡ"] || options["Size"])) || "FREE";
            const checkoutItem = {
              productId: product.id,
              sellerId: sid,
              title: product.name,
              qty: Math.max(1, Number(qty) || 1),
              price: 0, // giá sẽ tính lại ở BE; FE chỉ hiển thị nếu cần
              image: pickImageUrl(product.images),
              options: options || {},
              size: sizeForCompat,
            };

            closeQuickView();
            navigate("/checkout", {
              state: {
                items: [checkoutItem],
                userId: currentUserId,
                from: "buy_now",
              },
            });
          } catch (err) {
            console.error("Quick buy-now error:", err);
            showToast({
              title: "Không thể mua ngay",
              text: err?.message || "Vui lòng thử lại sau.",
              type: "error",
            });
          }
        }}
      />

      <ReportProductModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        productId={product?.id}
        productName={product?.name}
        userId={currentUserId}
        authFetch={authFetch}
        showToast={showToast}
        onSuccess={(result) => {
          console.log("Report created:", result);
        }}
      />
    </div>
  );
}
