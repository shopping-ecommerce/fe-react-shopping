// src/pages/home/ProductQuickView.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import "../../../styles/ProductQuickView.css";
import { API_CONFIG, apiUrl } from "../../../config/api";
import { createAuthFetch } from "../../../services/auth";
import {
  getMyProfile,
  addFavorite,
  removeFavorite,
} from "../../../services/favorites";

/* =========================
   Helpers chung
   ========================= */
const normalize = (v) => (v == null ? "" : String(v)).trim();
const nkey = (s) => normalize(s).toLowerCase();
const shallowEqual = (a = {}, b = {}) => {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (normalize(a[k]) !== normalize(b[k])) return false;
  return true;
};
const fmt = (n) =>
  Number.isFinite(Number(n))
    ? Number(n).toLocaleString("vi-VN") + "đ"
    : "-đ";

/* =========================
   Color helpers (dot & ẩn chữ cho nhóm Màu)
   ========================= */
const isColorGroupName = (name) => {
  const k = nkey(name);
  return k === "color" || k === "màu" || k === "màu sắc";
};

// Bản đồ tên màu tiếng Việt phổ biến -> CSS
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

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_RE =
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i;
const HSL_RE =
  /^hsla?\(\s*\d{1,3}\s*,\s*(\d{1,3}%){1}\s*,\s*(\d{1,3}%){1}(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i;

const resolveCssColor = (raw) => {
  const v = nkey(raw);
  if (!v) return null;
  if (VN_COLOR_MAP.has(v)) return VN_COLOR_MAP.get(v);
  if (HEX_RE.test(v) || RGB_RE.test(v) || HSL_RE.test(v)) return raw;
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

/* =========================
   Ảnh: gallery & media theo option
   ========================= */
const collectGallery = (p) => {
  const out = [];
  const seen = new Set();

  // 1) mediaByOption.image (URL)
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

  // 2) images[].url theo position
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

const buildMediaMap = (mediaByOption = []) => {
  const map = {};
  if (!Array.isArray(mediaByOption)) return map;
  mediaByOption.forEach((m) => {
    const name = normalize(m?.optionName);
    const val = normalize(m?.optionValue);
    const img = typeof m?.image === "string" ? m.image.trim() : "";
    if (!name || !val || !img || !/^https?:\/\//.test(img)) return;
    map[`${name}::${val}`] = img;
  });
  return map;
};

/* =========================
   Option groups (gộp trùng tên)
   ========================= */
const buildOptionGroups = (variants = [], optionDefs = []) => {
  const byName = new Map(); // key -> { name, values:Set }
  const order = [];

  // 1) Ưu tiên optionDefs
  if (Array.isArray(optionDefs) && optionDefs.length) {
    for (const d of optionDefs) {
      const rawName = typeof d === "string" ? d : d?.name ? String(d.name) : "";
      if (!rawName) continue;
      const key = nkey(rawName);
      if (!byName.has(key)) {
        byName.set(key, { name: rawName, values: new Set() });
        order.push(key);
      }
      const vals = Array.isArray(d?.values) ? d.values.map(String) : [];
      vals.forEach((v) => byName.get(key).values.add(v));
    }
  }

  // 2) Bổ sung từ variants
  for (const v of Array.isArray(variants) ? variants : []) {
    const ops = v?.options || {};
    for (const [k, val] of Object.entries(ops)) {
      const raw = String(k);
      const key = nkey(raw);
      if (!byName.has(key)) {
        byName.set(key, { name: raw, values: new Set() });
        order.push(key);
      }
      if (val != null && val !== "") byName.get(key).values.add(String(val));
    }
  }

  // 3) Xuất mảng
  return order.map((key) => {
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
};

/* =========================
   Chuẩn hoá options gửi BE
   ========================= */
const normalizeOptionKeysForBE = (opts) => {
  if (!opts) return null;
  const out = {};
  for (const [kRaw, v] of Object.entries(opts)) {
    const k = nkey(kRaw);
    if (k === "size" || k === "kích cỡ" || k === "kích thước")
      out["Kích cỡ"] = v;
    else if (k === "color" || k === "màu" || k === "màu sắc")
      out["Màu sắc"] = v;
    else out[kRaw] = v;
  }
  return Object.keys(out).length ? out : null;
};

/* =========================
   Giá: tính toán theo lựa chọn
   ========================= */
const filterVariantsBySelection = (variants = [], selection = {}) => {
  if (!Array.isArray(variants)) return [];
  const keys = Object.keys(selection || {}).filter(
    (k) =>
      selection[k] !== undefined &&
      selection[k] !== null &&
      selection[k] !== ""
  );
  if (!keys.length) return variants.slice();
  return variants.filter((v) => {
    const ops = v?.options || {};
    return keys.every((k) => nkey(ops[k]) === nkey(selection[k]));
  });
};

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

/* =========================
   Loading dots
   ========================= */
function Dots() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v + 1) % 4), 400);
    return () => clearInterval(t);
  }, []);
  return <span>{Array(n).fill(".").join("")}</span>;
}

/* =========================
   Component chính
   ========================= */
export default function ProductQuickView({
  product,
  isOpen,
  onClose,
  onAddToCart,
  onBuyNow,
  currentSellerId,
  showToast,
}) {
  const navigate = useNavigate();

  const [activeIndex, setActiveIndex] = useState(0);
  const [thumbStart, setThumbStart] = useState(0);
  const [qty, setQty] = useState(1);

  const toast = React.useMemo(() => {
    const bus = typeof window !== "undefined" ? window.__appToastBus : null;
    return (opts) => {
      if (!opts) return;
      if (typeof showToast === "function") return showToast(opts);
      bus?.show?.(opts);
    };
  }, [showToast]);

  const authFetch = useMemo(() => createAuthFetch(), []);
  const [userId, setUserId] = useState(null);
  const [favorites, setFavorites] = useState(() => new Set());
  const [favInflight, setFavInflight] = useState(() => new Set());

  // Lấy profile + favorite_products
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await getMyProfile(authFetch);
        if (!mounted || !me) return;

        const uid = me?.id || me?.user_id || me?.result?.id || null;
        if (uid) setUserId(uid);

        const favs = Array.isArray(me?.favorite_products)
          ? me.favorite_products
          : Array.isArray(me?.result?.favorite_products)
          ? me.result.favorite_products
          : [];
        setFavorites(new Set(favs));
      } catch (err) {
        if (mounted) {
          console.warn("QuickView load profile failed:", err);
          setUserId(null);
          setFavorites(new Set());
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authFetch]);

  // ============= CHỌN BIẾN THỂ =============
  const sizeListLegacy = Array.isArray(product?.sizes) ? product.sizes : [];
  const hasVariants =
    Array.isArray(product?.variants) && product.variants.length > 0;

  const optionGroups = useMemo(
    () =>
      hasVariants
        ? buildOptionGroups(product.variants, product?.optionDefs)
        : [],
    [hasVariants, product?.variants, product?.optionDefs]
  );

  const mediaMap = useMemo(
    () => buildMediaMap(product?.mediaByOption),
    [product?.mediaByOption]
  );

  const [selectedOptions, setSelectedOptions] = useState({});
  const [selectedSizeLegacy, setSelectedSizeLegacy] = useState(null);
  const [selectionTouched, setSelectionTouched] = useState(false);

  // Reset khi mở modal
  useEffect(() => {
    if (!isOpen) return;
    setSelectedOptions({});
    setSelectedSizeLegacy(null);
    setSelectionTouched(false);
    setQty(1);
    setActiveIndex(0);
    setThumbStart(0);
  }, [isOpen, product?.id]);

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

  // ============= ẢNH =============
  const gallery = useMemo(() => collectGallery(product || {}), [product]);

  const activeImageUrlFromSelection = useMemo(() => {
    const preferOrder = ["màu sắc", "màu", "color"];
    const entries = Object.entries(selectedOptions);
    entries.sort((a, b) => {
      const ai = preferOrder.indexOf(nkey(a[0]));
      const bi = preferOrder.indexOf(nkey(b[0]));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    for (const [k, v] of entries) {
      const key = `${normalize(k)}::${normalize(v)}`;
      if (mediaMap[key]) return mediaMap[key];
    }
    return null;
  }, [selectedOptions, mediaMap]);

  const mainUrl =
    activeImageUrlFromSelection || gallery[activeIndex]?.url || "/img/default.png";

  useEffect(() => {
    const W = 3;
    if (activeIndex < thumbStart) setThumbStart(activeIndex);
    else if (activeIndex >= thumbStart + W)
      setThumbStart(activeIndex - (W - 1));
  }, [activeIndex, thumbStart]);

  const visibleThumbs = gallery.slice(thumbStart, thumbStart + 3);
  const onThumbArrowDown = () =>
    setActiveIndex((i) => (i + 1) % gallery.length);
  const onThumbArrowUp = () =>
    setActiveIndex((i) => (i - 1 + gallery.length) % gallery.length);

  // ============= GIÁ & TỒN KHO =============
  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null;
    const keys = Object.keys(selectedOptions);
    if (!keys.length) return null;
    const pick = product.variants.find((v) => {
      const ops = v?.options || {};
      return (
        keys.length === Object.keys(ops).length &&
        keys.every((k) => nkey(ops[k]) === nkey(selectedOptions[k]))
      );
    });
    return pick || null;
  }, [hasVariants, product?.variants, selectedOptions]);

  const priceState = useMemo(
    () => computePriceState(product, selectedOptions, selectedSizeLegacy),
    [product, selectedOptions, selectedSizeLegacy]
  );

  const maxQty = useMemo(() => {
    if (hasVariants && selectedVariant) {
      const q = Number(selectedVariant?.quantity);
      return Number.isFinite(q) ? q : Infinity;
    }
    if (!hasVariants && sizeListLegacy.length) {
      const s = sizeListLegacy.find(
        (it) => nkey(it?.size) === nkey(selectedSizeLegacy)
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

  useEffect(() => {
    if (!Number.isFinite(maxQty)) return;
    setQty((q) => (q > maxQty ? maxQty : q));
  }, [maxQty]);

  // ============= OPEN/CLOSE & SCROLL LOCK =============
  const [addLoading, setAddLoading] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);

  const lockRef = useRef({ y: 0 });
  const lockScroll = () => {
    const W = typeof window !== "undefined" ? window : globalThis;
    W.__qvLockCount = (W.__qvLockCount || 0) + 1;
    if (W.__qvLockCount === 1) {
      const y = window.scrollY || window.pageYOffset || 0;
      lockRef.current.y = y;
      const body = document.body;
      body.style.position = "fixed";
      body.style.top = `-${y}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
    }
  };
  const unlockScroll = () => {
    try {
      const W = typeof window !== "undefined" ? window : globalThis;
      if (W.__qvLockCount) W.__qvLockCount -= 1;
      if (!W.__qvLockCount) {
        const body = document.body;
        const top = parseInt(body.style.top || "0", 10) || 0;
        body.style.position = "";
        body.style.top = "";
        body.style.left = "";
        body.style.right = "";
        body.style.width = "";
        body.style.overflow = "";
        window.scrollTo(0, -top || lockRef.current.y || 0);
        lockRef.current.y = 0;
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      setAddLoading(false);
      setBuyLoading(false);
      lockScroll();
      requestAnimationFrame(() => {
        overlayRef.current?.scrollTo?.(0, 0);
        dialogRef.current?.focus?.({ preventScroll: true });
      });
    }

    const onKey = (e) => e.key === "Escape" && onClose?.();
    if (isOpen) window.addEventListener("keydown", onKey);

    return () => {
      if (isOpen) {
        unlockScroll();
        window.removeEventListener("keydown", onKey);
      }
    };
  }, [isOpen, onClose]);

  // ============= GUARDS & OWNER =============
  const isOwnerOfSeller = (sid) =>
    !!currentSellerId && !!sid && String(currentSellerId) === String(sid);

  const isOwnerTryingToBuy = () => {
    const sid = product?.sellerId || product?.seller_id;
    if (!sid || !currentSellerId) return false;
    return String(sid) === String(currentSellerId);
  };
  const notifyOwnerBlocked = () => {
    toast({
      title: "Không thể thao tác",
      text: "Bạn là chủ shop — không được phép mua sản phẩm.",
      type: "warning",
    });
  };

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
      toast({
        title: "Thiếu thông tin",
        text: `Vui lòng chọn: ${missingGroups.join(", ")}.`,
        type: "warning",
      });
      try {
        document.querySelector(".qv-variant")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } catch {}
      return false;
    }
    return true;
  };

  if (!isOpen || !product) return null;

  // ============= HANDLERS =============
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

  const handleAdd = async () => {
    if (isOwnerTryingToBuy()) return void notifyOwnerBlocked();
    if (!guardSelection()) return;

    const rawOptions = hasVariants
      ? selectedOptions
      : Array.isArray(product?.sizes) && product.sizes.length
      ? { "Kích cỡ": selectedSizeLegacy }
      : null;

    const optionsForBE = normalizeOptionKeysForBE(rawOptions);

    try {
      setAddLoading(true);

      let uid = userId;
      if (!uid) {
        const resMe = await authFetch(
          apiUrl(API_CONFIG.endpoints.getMyProfile),
          {
            method: "GET",
            headers: { Accept: "application/json" },
          }
        );
        const me = await resMe.json().catch(() => ({}));
        uid = me?.result?.id || me?.id || null;
      }

      const body = {
        userId: uid,
        productId: product?.id || product?._id,
        sellerId: product?.sellerId || product?.seller_id,
        sellerName: product?.sellerName || product?.seller?.name || "Shop",
        quantity: Math.max(1, parseInt(qty, 10) || 1),
        options: optionsForBE,
      };

      if (!body.userId) throw new Error("Thiếu userId (không lấy được profile).");
      if (!body.productId) throw new Error("Thiếu productId.");
      if (!body.sellerId) throw new Error("Thiếu sellerId.");

      const addUrl = API_CONFIG?.endpoints?.cartAdd
        ? apiUrl(API_CONFIG.endpoints.cartAdd)
        : apiUrl("/cart/add");

      const res = await authFetch(addUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });

      const text = await res.text().catch(() => "");
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {}

      if (!res.ok) {
        const msg =
          data?.message || data?.error || data?.msg || text || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      if (data?.code && data.code !== 200) {
        throw new Error(data?.message || `API code=${data.code}`);
      }

      toast({
        title: "Thành công",
        text: "Đã thêm vào giỏ hàng",
        type: "success",
      });
      onAddToCart?.({ product, options: optionsForBE, qty });
    } catch (err) {
      toast({
        title: "Lỗi",
        text: err?.message || "Thêm vào giỏ thất bại",
        type: "danger",
      });
      console.warn("Add to cart error:", err);
    } finally {
      setAddLoading(false);
    }
  };

  const handleBuyNow = async () => {
    if (isOwnerTryingToBuy()) return void notifyOwnerBlocked();
    if (!guardSelection()) return;

    try {
      setBuyLoading(true);

      const rawOptions = hasVariants
        ? selectedOptions
        : Array.isArray(product?.sizes) && product.sizes.length
        ? { "Kích cỡ": selectedSizeLegacy }
        : null;
      const optionsForBE = normalizeOptionKeysForBE(rawOptions);

      const authFetchLocal = createAuthFetch();
      let uid = userId;
      if (!uid) {
        const resMe = await authFetchLocal(
          apiUrl(API_CONFIG.endpoints.getMyProfile),
          {
            method: "GET",
            headers: { Accept: "application/json" },
          }
        );
        const me = await resMe.json().catch(() => ({}));
        uid = me?.result?.id || me?.id || null;
      }

      const body = {
        userId: uid,
        productId: product?.id || product?._id,
        sellerId: product?.sellerId || product?.seller_id,
        sellerName: product?.sellerName || product?.seller?.name || "Shop",
        quantity: Math.max(1, parseInt(qty, 10) || 1),
        options: optionsForBE,
      };

      if (!body.userId || !body.productId || !body.sellerId) {
        throw new Error("Thiếu dữ liệu bắt buộc.");
      }

      const addUrl = API_CONFIG?.endpoints?.cartAdd
        ? apiUrl(API_CONFIG.endpoints.cartAdd)
        : apiUrl("/cart/add");
      const res = await authFetchLocal(addUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });

      const text = await res.text().catch(() => "");
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {}
      if (!res.ok || (data?.code && data.code !== 200)) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

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

      const pickedSize =
        (hasVariants
          ? normalize(
              selectedOptions["Kích cỡ"] ||
                selectedOptions["Size"] ||
                selectedOptions["kích cỡ"] ||
                selectedOptions["kích thước"]
            )
          : normalize(selectedSizeLegacy)) || "FREE";
      const pickedColor =
        (hasVariants
          ? normalize(
              selectedOptions["Màu sắc"] ||
                selectedOptions["Color"] ||
                selectedOptions["màu"] ||
                selectedOptions["color"]
            )
          : "") || undefined;

      const checkoutItem = {
        id: `${body.sellerId}-${body.productId}-${pickedSize.toUpperCase()}`,
        sellerId: body.sellerId,
        productId: body.productId,
        title: product?.name || "Sản phẩm",
        image: mainUrl,
        price: effectivePrice,
        qty: body.quantity,
        options: optionsForBE,
        size: pickedSize,
        color: pickedColor,
      };

      try {
        sessionStorage.setItem(
          "checkout_items",
          JSON.stringify([checkoutItem])
        );
      } catch {}

      toast({
        title: "Đi tới thanh toán",
        text: "Đã thêm vào giỏ. Chuyển tới trang thanh toán...",
        type: "success",
      });

      onClose?.();
      navigate("/checkout", {
        state: { from: "buy_now", items: [checkoutItem], userId: uid },
      });
    } catch (e) {
      toast({
        title: "Không thể mua ngay",
        text: "Vui lòng thử lại sau.",
        type: "danger",
      });
    } finally {
      setBuyLoading(false);
    }
  };

  // ============= FAVORITE HANDLER =============
  const pid = product?.id || product?._id;
  const sellerId = product?.sellerId || product?.seller_id;
  const isOwnerProduct = isOwnerOfSeller(sellerId);
  const isFav = pid && favorites instanceof Set ? favorites.has(pid) : false;

  const handleToggleFavorite = async () => {
    if (!pid) return;

    if (isOwnerProduct) {
      toast({
        title: "Không thể yêu thích",
        text: "Bạn là chủ shop — không thể yêu thích sản phẩm của chính mình.",
        type: "warning",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "Cần đăng nhập",
        text: "Vui lòng đăng nhập để sử dụng Yêu thích.",
        type: "warning",
      });
      navigate("/login");
      return;
    }

    if (favInflight.has(pid)) return;

    const currentlyFav = favorites.has(pid);

    // Optimistic UI
    setFavorites((prev) => {
      const next = new Set(prev);
      if (currentlyFav) next.delete(pid);
      else next.add(pid);
      return next;
    });
    setFavInflight((s) => {
      const n = new Set(s);
      n.add(pid);
      return n;
    });

    try {
      const favs = currentlyFav
        ? await removeFavorite(authFetch, { userId, productId: pid })
        : await addFavorite(authFetch, { userId, productId: pid });

      setFavorites(new Set(favs));

      toast({
        title: currentlyFav
          ? "Đã bỏ khỏi Yêu thích"
          : "Đã thêm vào Yêu thích",
        text: currentlyFav
          ? "Sản phẩm đã được xóa khỏi danh sách yêu thích."
          : "Bạn có thể xem lại trong danh sách yêu thích.",
        type: currentlyFav ? "info" : "success",
      });
    } catch (err) {
      console.error("QuickView toggle favorite failed:", err);
      // Revert
      setFavorites((prev) => {
        const next = new Set(prev);
        if (currentlyFav) next.add(pid);
        else next.delete(pid);
        return next;
      });

      if (err?.status === 401 || err?.status === 403) {
        toast({
          title: "Phiên đăng nhập hết hạn",
          text: "Vui lòng đăng nhập lại để tiếp tục.",
          type: "warning",
        });
        navigate("/login");
      } else {
        toast({
          title: "Không thực hiện được",
          text: "Có lỗi khi cập nhật Yêu thích. Vui lòng thử lại.",
          type: "error",
        });
      }
    } finally {
      setFavInflight((s) => {
        const n = new Set(s);
        n.delete(pid);
        return n;
      });
    }
  };

  // ============= RENDER =============
  const overlay = (
    <div
      className="qv-overlay qv-overlay--transparent"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      ref={overlayRef}
      data-qv-overlay
    >
      <div
        className="qv-dialog"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
        aria-label="Quick view product"
        data-qv-dialog
      >
        <div className="qv-body">
          <button className="qv-close" aria-label="Đóng" onClick={onClose}>
            ×
          </button>

          <div className="qv-grid">
            {/* LEFT */}
            <div className="qv-gallery">
              <div className="qv-main-col">
                <div className="qv-main-image">
                  <img src={mainUrl} alt={product.name} />
                </div>

                <button
                  className={`qv-fav ${isFav ? "active" : ""} ${
                    isOwnerProduct ? "is-owner" : ""
                  }`}
                  onClick={handleToggleFavorite}
                  type="button"
                  disabled={favInflight.has(pid) || isOwnerProduct}
                  title={
                    isOwnerProduct
                      ? "Bạn là chủ shop — không thể yêu thích sản phẩm của mình."
                      : isFav
                      ? "Bỏ khỏi danh sách yêu thích"
                      : "Thêm vào danh sách yêu thích"
                  }
                >
                  <svg viewBox="0 0 24 24" className="qv-fav-ic">
                    <path d="M12.001 20.727c-.2 0-.401-.06-.573-.18C9.3 19.07 3 14.74 3 9.41 3 7.03 4.882 5 7.23 5c1.42 0 2.79.68 3.77 1.84A5.04 5.04 0 0 1 14.77 5c2.35 0 4.23 2.03 4.23 4.41 0 5.33-6.3 9.66-8.428 11.137a1.01 1.01 0 0 1-.571.18Z" />
                  </svg>
                  Thêm vào danh sách yêu thích
                </button>
              </div>

              <div className="qv-thumbs-vertical">
                {thumbStart > 0 && (
                  <button
                    className="qv-thumb-up"
                    onClick={onThumbArrowUp}
                    title="Ảnh trước"
                  >
                    ▴
                  </button>
                )}

                <div className="qv-thumbs-window">
                  {visibleThumbs.map((img, i) => {
                    const realIndex = thumbStart + i;
                    return (
                      <button
                        key={`thumb-${realIndex}`}
                        className={`qv-thumb ${
                          realIndex === activeIndex ? "active" : ""
                        }`}
                        onClick={() => setActiveIndex(realIndex)}
                        aria-label={`Ảnh ${realIndex + 1}`}
                      >
                        <img src={img.url} alt={`thumb-${realIndex}`} />
                      </button>
                    );
                  })}
                </div>

                <button
                  className="qv-thumb-down"
                  onClick={onThumbArrowDown}
                  title="Ảnh tiếp theo"
                >
                  ▾
                </button>
              </div>
            </div>

            {/* RIGHT */}
            <div className="qv-info">
              <h1 className="qv-title">{product.name}</h1>

              <div className="qv-meta">
                <span className="qv-rating">5.0 ★★★★★</span>
                <span className="qv-sold">
                  Đã bán {product.soldCount ?? product.sold ?? 35}
                </span>
              </div>

              {/* Giá 1 hàng: exact | single | range */}
              <div className="qv-price-line">
                {priceState.mode === "exact" && (
                  <>
                    <span className="qv-price">{fmt(priceState.price)}</span>
                    {Number.isFinite(priceState.compare) &&
                      priceState.compare > priceState.price && (
                        <span className="qv-compare">
                          {fmt(priceState.compare)}
                        </span>
                      )}
                  </>
                )}
                {priceState.mode === "single" && (
                  <>
                    <span className="qv-price">{fmt(priceState.price)}</span>
                    {Number.isFinite(priceState.compare) &&
                      priceState.compare > priceState.price && (
                        <span className="qv-compare">
                          {fmt(priceState.compare)}
                        </span>
                      )}
                  </>
                )}
                {priceState.mode === "range" && (
                  <>
                    <span className="qv-price">
                      {fmt(priceState.priceMin)} – {fmt(priceState.priceMax)}
                    </span>
                  </>
                )}
                {priceState.mode === "none" && (
                  <span className="qv-price">-đ</span>
                )}
              </div>

              {/* ====== VARIANT UI (gộp trùng tên) — KHÔNG auto-chọn ====== */}
              {hasVariants && optionGroups.length > 0 && (
                <div className="qv-variant">
                  {optionGroups.map((grp, idx) => {
                    const gName = grp.name;
                    const isColorGroup = isColorGroupName(gName);
                    const missing =
                      selectionTouched && !selectedOptions[gName];

                    return (
                      <div
                        key={`opt-${idx}-${gName}`}
                        className={`qv-variant ${
                          missing ? "qv-variant--error" : ""
                        }`}
                      >
                        <div className="qv-variant-label">{gName}</div>
                        <div className="qv-variant-options">
                          {grp.values.map((val, vi) => {
                            const active =
                              nkey(selectedOptions[gName]) === nkey(val);
                            const disabled = !isVariantValueAvailable(
                              gName,
                              val
                            );
                            const mediaKey = `${normalize(
                              gName
                            )}::${normalize(val)}`;
                            const thumb = mediaMap[mediaKey];

                            // màu chấm (nếu là nhóm Màu)
                            const colorCss = isColorGroup
                              ? resolveCssColor(val)
                              : null;

                            return (
                              <button
                                key={`optv-${idx}-${vi}-${val}`}
                                type="button"
                                className={`qv-chip ${
                                  active ? "active" : ""
                                } ${disabled ? "disabled" : ""}`}
                                onClick={() => {
                                  if (disabled) return;
                                  setSelectionTouched(true);
                                  handlePickOption(gName, val);
                                }}
                                aria-pressed={active}
                                aria-disabled={disabled}
                                disabled={disabled}
                                title={
                                  isColorGroup
                                    ? `${disabled ? "Hết hàng" : ""}`.trim()
                                    : String(val) +
                                      (disabled
                                        ? " (Hết hàng với lựa chọn hiện tại)"
                                        : "")
                                }
                              >
                                {/* ẢNH THUMB (luôn giữ nếu có) */}
                                {thumb ? (
                                  <span
                                    className="qv-chip-thumb"
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

                                {/* NHÓM MÀU: KHÔNG HIỂN THỊ CHỮ */}
                                {!isColorGroup && (
                                  <span style={{ marginLeft: thumb ? 6 : 0 }}>
                                    {String(val)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {missing && (
                          <div className="qv-size-error">
                            Vui lòng chọn {gName.toLowerCase()}.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ====== LEGACY SIZE UI (fallback) — KHÔNG auto-chọn ====== */}
              {!hasVariants && sizeListLegacy.length > 0 && (
                <div
                  className={`qv-variant ${
                    selectionTouched && !selectedSizeLegacy
                      ? "qv-variant--error"
                      : ""
                  }`}
                >
                  <div className="qv-variant-label">Size</div>
                  <div className="qv-variant-options">
                    {sizeListLegacy.map((s, i) => {
                      const val = nkey(s?.size);
                      const label =
                        (normalize(s?.size) || "FREE").toUpperCase();
                      const active = nkey(selectedSizeLegacy) === val;
                      const disabled = !(Number(s?.quantity) > 0);
                      return (
                        <button
                          key={`legacy-${i}-${val || "FREE"}`}
                          type="button"
                          className={`qv-chip ${
                            active ? "active" : ""
                          } ${disabled ? "disabled" : ""}`}
                          onClick={() => {
                            if (disabled) return;
                            setSelectionTouched(true);
                            setSelectedSizeLegacy((prev) =>
                              nkey(prev) === val ? null : s?.size
                            );
                          }}
                          aria-pressed={active}
                          aria-disabled={disabled}
                          disabled={disabled}
                          title={label + (disabled ? " (Hết hàng)" : "")}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {selectionTouched && !selectedSizeLegacy && (
                    <div className="qv-size-error">
                      Vui lòng chọn size trước khi tiếp tục.
                    </div>
                  )}
                </div>
              )}

              <div className="qv-stock">
                <span className="qv-stock-label">Tồn kho:</span>
                <span className="qv-stock-num">
                  {Number.isFinite(maxQty) ? maxQty : "∞"}
                </span>
              </div>

              <div className="qv-qty-stock-row">
                <div className="qv-qty-label">Số lượng</div>
                <div className="qv-qty-value">
                  <div className="qv-qty-control">
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                    >
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
                      inputMode="numeric"
                      aria-label="Số lượng"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setQty((q) => {
                          const v = q + 1;
                          return Number.isFinite(maxQty)
                            ? Math.min(v, maxQty)
                            : v;
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="qv-actions">
                <button
                  className={`qv-btn outline ${
                    addLoading ? "is-loading" : ""
                  }`}
                  onClick={handleAdd}
                  disabled={addLoading || buyLoading}
                  type="button"
                >
                  {addLoading ? (
                    <>
                      Đang thêm <Dots />
                    </>
                  ) : (
                    "Thêm vào giỏ"
                  )}
                </button>

                <button
                  className={`qv-btn primary ${
                    buyLoading ? "is-loading" : ""
                  }`}
                  onClick={handleBuyNow}
                  disabled={buyLoading || addLoading}
                  type="button"
                >
                  {buyLoading ? (
                    <>
                      Mua ngay <Dots />
                    </>
                  ) : (
                    "Mua ngay"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
