// src/pages/cart/CartPage.jsx
"use client";

import { useEffect, useMemo, useState, useContext, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

import {
  getCartSummary,
  updateCartQuantity,
  updateCartSize,
  updateCartVariant,
  mapCartResultToUI,
  removeCartItemsBatch,
  removeCartItem,
} from "../../services/cartService";
import { API_CONFIG, apiUrl } from "../../config/api";
import { AuthContext } from "../../contexts/AuthContext";
import "../../styles/CartPage.css";
import { useNavigate } from "react-router-dom";
import { showToast, hideToast, confirmToast } from "../../utils/toast";

/* ========= Format tiền ========= */
const fmtVND = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    n ?? 0
  );

/* ========= Tour ========= */
const CART_TOUR_SEEN_KEY = "cart_tour_seen_v1";

/* ========= Helpers tên shop ========= */
const isBadSellerName = (name) => {
  const v = String(name || "")
    .trim()
    .toLowerCase();
  return !v || v === "shop" || v === "unknown seller" || v === "unknown";
};
const fallbackShopName = (sellerId) =>
  `Shop #${String(sellerId || "").slice(0, 8)}`;

const buildSearchSellerByIdUrl = (sid) => {
  if (API_CONFIG?.endpoints?.searchSellerBySellerId) {
    return apiUrl(API_CONFIG.endpoints.searchSellerBySellerId(sid));
  }
  return `${
    API_CONFIG.baseUrl
  }/info/sellers/searchBySellerId/${encodeURIComponent(sid)}`;
};

/* ========= Helpers normalize/option ========= */
const normalize = (v) => (v == null ? "" : String(v)).trim();
const nkey = (s) => normalize(s).toLowerCase();

/** Chuẩn hóa keys options để gửi BE giống QuickView */
const normalizeOptionKeysForBE = (opts) => {
  if (!opts || typeof opts !== "object") return null;
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

/** Gộp optionDefs trùng tên + bổ sung values từ variants (giống QuickView) */
const buildOptionGroups = (variants = [], optionDefs = []) => {
  const byName = new Map(); // normName -> { name, values:Set }
  const order = [];

  // Ưu tiên optionDefs
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
  // Bổ sung từ variants
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

  // Xuất mảng
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

/* ========= Helpers sản phẩm (đọc variants/sizes & tồn kho) ========= */
// đọc option bất đồng nhất
const getOpt = (m, ...keys) => {
  if (!m) return "";
  for (const k of keys) {
    if (m[k] != null) return String(m[k]);
  }
  return "";
};
// chuẩn hóa field tồn kho trên biến thể
const pickStock = (obj) => {
  const cand = [
    obj?.availableQty,
    obj?.quantity,
    obj?.stock,
    obj?.available,
    obj?.qty,
  ];
  for (const v of cand) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)))
      return Number(v);
    if (v === true) return 1;
  }
  return 0;
};

/* ========= Component ========= */
export default function CartPage() {
  const { authFetch } = useContext(AuthContext);
  const [cartItems, setCartItems] = useState([]);
  const [cartTotals, setCartTotals] = useState(null);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState({});

  // Fallback legacy maps (size/color) + tồn kho gộp
  const [sizesByProductId, setSizesByProductId] = useState({});
  const [colorsByProductId, setColorsByProductId] = useState({});
  const [inventoryByProductId, setInventoryByProductId] = useState({}); // bySize/byColor/byPair

  // NEW: option động & index variants
  const [optionGroupsByProductId, setOptionGroupsByProductId] = useState({});
  const [variantsIndexByProductId, setVariantsIndexByProductId] = useState({}); // pid -> [{ rawOps, normOps, qty, price }]

  const [userId, setUserId] = useState(null);

  const [sellerNameMap, setSellerNameMap] = useState({});
  const [showTools, setShowTools] = useState(false);
  const toolsRef = useRef(null);

  const navigate = useNavigate();

  /* ===== User ===== */
  const fetchProfileUserId = async () => {
    const res = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) {
      throw new Error(json.message || `HTTP ${res.status}`);
    }
    const data = json.result ?? json;
    const id = data?.id || data?.userId || data?.user_id || null;
    if (!id) throw new Error("Không tìm thấy user id trong getMyProfile");
    return id;
  };

  /* ===== Load Cart + Products ===== */
  useEffect(() => {
    let cancelled = false;

    const fillSellerNames = async (items) => {
      const needFetch = new Set(
        items
          .filter((it) => it?.sellerId && isBadSellerName(it?.sellerName))
          .map((it) => String(it.sellerId))
      );
      if (needFetch.size === 0) return;

      const localMap = { ...sellerNameMap };

      await Promise.all(
        Array.from(needFetch).map(async (sid) => {
          if (localMap[sid] !== undefined) return;
          try {
            const url = buildSearchSellerByIdUrl(sid);
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
            localMap[sid] = name || "";
          } catch {
            localMap[sid] = "";
          }
        })
      );

      if (!cancelled) setSellerNameMap(localMap);

      if (!cancelled) {
        setCartItems((prev) =>
          prev.map((it) => {
            if (!it?.sellerId) return it;
            if (!isBadSellerName(it?.sellerName)) return it;
            const good =
              (localMap[it.sellerId] && String(localMap[it.sellerId]).trim()) ||
              "";
            return {
              ...it,
              sellerName: good || fallbackShopName(it.sellerId),
            };
          })
        );
      }
    };

    (async () => {
      try {
        setLoading(true);
        setError("");

        // user
        try {
          const uid = await fetchProfileUserId();
          if (!cancelled) setUserId(uid);
        } catch (e) {
          console.warn("Không lấy được userId từ getMyProfile:", e);
          if (!cancelled) {
            setUserId(null);
            showToast({
              title: "Thiếu thông tin người dùng",
              text: "Không xác định được userId. Vui lòng đăng nhập lại.",
              type: "error",
              duration: 2500,
            });
          }
        }

        // cart
        const data = await getCartSummary();
        const result = data?.result || {};
        const ui = mapCartResultToUI(result);

        if (cancelled) return;

        setCartItems(ui.items);

        // tick preselect
        const preselectKey = sessionStorage.getItem("cart_preselect");
        const initialChecked = Object.fromEntries(
          ui.items.map((i) => [i.uniqueKey, i.uniqueKey === preselectKey])
        );
        setChecked(initialChecked);
        if (preselectKey) sessionStorage.removeItem("cart_preselect");

        setCartTotals(ui.totals);

        await fillSellerNames(ui.items);

        // products (để build option groups + tồn kho)
        try {
          const res = await authFetch(
            apiUrl(API_CONFIG.endpoints.getProducts),
            {
              method: "GET",
              headers: { Accept: "application/json" },
            }
          );
          const productsData = await res.json().catch(() => ({}));
          if (!res.ok)
            throw new Error(productsData.message || `HTTP ${res.status}`);

          const all = productsData?.result || [];
          const idsInCart = new Set(ui.items.map((i) => i.productId));

          const sizesMap = {};
          const colorsMap = {};
          const inventories = {};
          const optionGroupsMap = {};
          const variantsIndexMap = {};

          all.forEach((p) => {
            if (!idsInCart.has(p.id)) return;

            /* ---- Legacy maps (size/color) + tồn kho gộp ---- */
            const sizeSet = new Set();
            const colorSet = new Set();
            const inv = { bySize: {}, byColor: {}, byPair: {} };

            if (Array.isArray(p.variants) && p.variants.length) {
              p.variants.forEach((v) => {
                const size =
                  getOpt(v.options, "Kích cỡ", "Size", "size", "SIZE") ||
                  "FREE";
                const color =
                  getOpt(v.options, "Màu sắc", "Color", "color", "COLOR") || "";
                sizeSet.add(size);
                if (color) colorSet.add(color);

                const stock = pickStock(v);
                if (!inv.byPair[size]) inv.byPair[size] = {};
                inv.byPair[size][color] =
                  (inv.byPair[size][color] || 0) + stock;
                inv.bySize[size] = (inv.bySize[size] || 0) + stock;
                if (color)
                  inv.byColor[color] = (inv.byColor[color] || 0) + stock;
              });
            }

            if (Array.isArray(p.sizes) && p.sizes.length) {
              p.sizes.forEach((s) => {
                const sz = s?.size != null ? String(s.size) : "FREE";
                sizeSet.add(sz);
                const stock = pickStock(s);
                inv.bySize[sz] = (inv.bySize[sz] || 0) + stock;
                if (!inv.byPair[sz]) inv.byPair[sz] = {};
                inv.byPair[sz][""] = (inv.byPair[sz][""] || 0) + stock;
              });
            }

            // đảm bảo giá trị đang nằm trong giỏ
            ui.items
              .filter((it) => it.productId === p.id)
              .forEach((it) => {
                sizeSet.add(String(it.size || "FREE"));
                if (it.color) colorSet.add(String(it.color));
                if (!inv.byPair[it.size || "FREE"])
                  inv.byPair[it.size || "FREE"] = {};
                if (inv.byPair[it.size || "FREE"][it.color || ""] == null) {
                  inv.byPair[it.size || "FREE"][it.color || ""] =
                    inv.bySize[it.size || "FREE"] ?? 0;
                }
              });

            inventories[p.id] = inv;
            sizesMap[p.id] = Array.from(sizeSet).map((size) => ({
              size,
              inStock:
                (inv.byPair?.[size] &&
                  Object.values(inv.byPair[size]).some((q) => (q ?? 0) > 0)) ||
                (inv.bySize?.[size] ?? 0) > 0,
            }));
            colorsMap[p.id] =
              colorSet.size > 0
                ? Array.from(colorSet).map((color) => ({
                    color,
                    inStock: (inv.byColor?.[color] ?? 0) > 0,
                  }))
                : [{ color: "", inStock: (inv.bySize?.["FREE"] ?? 0) > 0 }];

            /* ---- NEW: option groups + variants index để kiểm tra khả dụng theo tổ hợp ---- */
            const groups = buildOptionGroups(
              p?.variants || [],
              p?.optionDefs || []
            );
            optionGroupsMap[p.id] = groups;

            const idx = [];
            if (Array.isArray(p?.variants) && p.variants.length) {
              for (const v of p.variants) {
                const rawOps = v?.options || {};
                const normOps = {};
                for (const [k, val] of Object.entries(rawOps)) {
                  normOps[nkey(k)] = normalize(val);
                }
                idx.push({
                  rawOps,
                  normOps,
                  qty: pickStock(v),
                  price: Number.isFinite(Number(v?.price))
                    ? Number(v.price)
                    : null,
                });
              }
            } else if (Array.isArray(p?.sizes) && p.sizes.length) {
              // Legacy size coi như 1 nhóm "Kích cỡ"
              for (const s of p.sizes) {
                const val = s?.size != null ? String(s.size) : "FREE";
                const rawOps = { "Kích cỡ": val };
                const normOps = { [nkey("Kích cỡ")]: normalize(val) };
                idx.push({
                  rawOps,
                  normOps,
                  qty: pickStock(s),
                  price: Number.isFinite(Number(s?.price))
                    ? Number(s.price)
                    : null,
                });
              }
            }
            variantsIndexMap[p.id] = idx;
          });

          setSizesByProductId(sizesMap);
          setColorsByProductId(colorsMap);
          setInventoryByProductId(inventories);
          setOptionGroupsByProductId(optionGroupsMap);
          setVariantsIndexByProductId(variantsIndexMap);
        } catch (err) {
          console.warn("Không lấy được size/color/option theo product:", err);
        }
      } catch (e) {
        console.error("❌ Lỗi lấy giỏ hàng:", e);
        if (!cancelled) {
          setError(e.message || "Không lấy được giỏ hàng");
          setCartItems([]);
          setCartTotals(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authFetch]);

  /* ===== Tour ===== */
  function runCartTour() {
    if (!cartItems || cartItems.length === 0) {
      showToast({
        title: "Giỏ hàng trống",
        text: "Thêm sản phẩm vào giỏ hàng để xem hướng dẫn.",
        type: "info",
        duration: 2200,
      });
      return;
    }

    const drv = driver({
      allowClose: true,
      animate: true,
      opacity: 0.45,
      stagePadding: 8,
    });

    const rawSteps = [
      {
        element: '.cart__item:first-of-type [data-tour="select-item"]',
        popover: {
          title: "Chọn sản phẩm",
          description: "Tick để chọn sản phẩm bạn muốn thanh toán.",
          side: "bottom",
          align: "start",
        },
      },
      {
        element: '.cart__item:first-of-type [data-tour="select-variant"]',
        popover: {
          title: "Chọn biến thể",
          description: "Nếu có Size/Màu/Dung tích… hãy chọn tại đây.",
          side: "bottom",
          align: "start",
        },
      },
      {
        element: '.cart__item:first-of-type [data-tour="change-qty"]',
        popover: {
          title: "Chỉnh số lượng",
          description: "Dùng nút – / + để giảm/tăng số lượng.",
          side: "bottom",
          align: "center",
        },
      },
      {
        element: '[data-tour="delete-selected"]',
        popover: {
          title: "Xoá các sản phẩm đã chọn",
          description:
            "Sau khi tick chọn các sản phẩm, bấm nút này để xoá hàng loạt.\n(Mẹo: Có thể “Chọn tất cả” theo từng shop ở phần tiêu đề shop.)",
          side: "top",
          align: "start",
        },
      },
      {
        element: '[data-tour="checkout"]',
        popover: {
          title: "Thanh toán",
          description: "Chọn ít nhất 1 sản phẩm rồi bấm nút này để tiếp tục.",
          side: "top",
          align: "end",
        },
      },
    ];

    const steps = rawSteps.filter((s) => {
      try {
        return !!document.querySelector(s.element);
      } catch {
        return false;
      }
    });

    if (steps.length === 0) {
      drv.highlight({
        popover: {
          title: "Hướng dẫn nhanh",
          description:
            "Trong giỏ hàng, hãy: chọn sản phẩm, chọn biến thể, chỉnh số lượng, rồi bấm Thanh toán.",
          side: "center",
        },
      });
      return;
    }

    drv.setSteps(steps);
    drv.drive();
  }

  useEffect(() => {
    if (loading) return;
    if (!cartItems || cartItems.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const forceShow = params.get("showTour") === "1";
    const seen = localStorage.getItem(CART_TOUR_SEEN_KEY) === "true";
    if (seen && !forceShow) return;

    const t = setTimeout(() => {
      const firstItem = document.querySelector(".cart__item:first-of-type");
      const checkoutBtn = document.querySelector('[data-tour="checkout"]');
      if (firstItem && checkoutBtn) {
        runCartTour();
        if (!forceShow) localStorage.setItem(CART_TOUR_SEEN_KEY, "true");
      }
    }, 300);
    return () => clearTimeout(t);
  }, [loading, cartItems]);

  useEffect(() => {
    function onDocClick(e) {
      if (!toolsRef.current) return;
      if (!toolsRef.current.contains(e.target)) {
        setShowTools(false);
      }
    }
    if (showTools) {
      document.addEventListener("click", onDocClick);
    }
    return () => document.removeEventListener("click", onDocClick);
  }, [showTools]);

  /* ===== Group theo seller ===== */
  const groupedBySeller = useMemo(() => {
    const map = new Map();
    for (const it of cartItems) {
      if (!map.has(it.sellerId)) {
        map.set(it.sellerId, {
          sellerId: it.sellerId,
          sellerName: isBadSellerName(it.sellerName)
            ? sellerNameMap[it.sellerId] || fallbackShopName(it.sellerId)
            : it.sellerName,
          items: [],
        });
      }
      const g = map.get(it.sellerId);
      if (
        isBadSellerName(g.sellerName) &&
        !isBadSellerName(it.sellerName || sellerNameMap[it.sellerId])
      ) {
        g.sellerName =
          it.sellerName ||
          sellerNameMap[it.sellerId] ||
          fallbackShopName(it.sellerId);
      }
      g.items.push(it);
    }
    return Array.from(map.values());
  }, [cartItems, sellerNameMap]);

  const selectedItems = useMemo(
    () => cartItems.filter((i) => checked[i.uniqueKey]),
    [cartItems, checked]
  );

  const selectedTotals = useMemo(() => {
    const selectedItemsList = cartItems.filter((i) => checked[i.uniqueKey]);
    const subtotal = selectedItemsList.reduce(
      (sum, item) => sum + (item.totalPrice ?? 0),
      0
    );
    const shipping =
      selectedItemsList.length > 0 ? cartTotals?.totalShipping ?? 0 : 0;
    const discount =
      selectedItemsList.length > 0 ? cartTotals?.totalDiscount ?? 0 : 0;

    return {
      subtotal,
      shipping,
      discount,
      finalAmount: subtotal + shipping - discount,
    };
  }, [cartItems, checked, cartTotals]);

  const canSelectItem = (item) => {
    if (checked[item.uniqueKey]) return true;
    const currentSelected = cartItems.filter((i) => checked[i.uniqueKey]);
    if (currentSelected.length === 0) return true;
    return currentSelected.every(
      (selectedItem) => selectedItem.sellerId === item.sellerId
    );
  };

  function toggleItemCheck(item) {
    const currentSelected = cartItems.filter((i) => checked[i.uniqueKey]);

    if (checked[item.uniqueKey]) {
      setChecked((prev) => ({ ...prev, [item.uniqueKey]: false }));
      return;
    }

    if (currentSelected.length === 0) {
      setChecked((prev) => ({ ...prev, [item.uniqueKey]: true }));
      return;
    }

    const hasItemFromDifferentSeller = currentSelected.some(
      (selectedItem) => selectedItem.sellerId !== item.sellerId
    );

    if (hasItemFromDifferentSeller) {
      setChecked((prev) => {
        const newChecked = {};
        Object.keys(prev).forEach((key) => (newChecked[key] = false));
        newChecked[item.uniqueKey] = true;
        return newChecked;
      });
    } else {
      setChecked((prev) => ({ ...prev, [item.uniqueKey]: true }));
    }
  }

  const getSelectAllState = (sellerId) => {
    const sellerItems = cartItems.filter((item) => item.sellerId === sellerId);
    const selectedSellerItems = sellerItems.filter(
      (item) => checked[item.uniqueKey]
    );
    return (
      sellerItems.length > 0 &&
      selectedSellerItems.length === sellerItems.length
    );
  };

  const handleSelectAllForSeller = (sellerId) => {
    const sellerItems = cartItems.filter((item) => item.sellerId === sellerId);
    const isAllSelected = getSelectAllState(sellerId);

    setChecked((prev) => {
      const newChecked = { ...prev };
      if (isAllSelected) {
        sellerItems.forEach((item) => (newChecked[item.uniqueKey] = false));
      } else {
        Object.keys(newChecked).forEach((key) => (newChecked[key] = false));
        sellerItems.forEach((item) => (newChecked[item.uniqueKey] = true));
      }
      return newChecked;
    });
  };

  const setItemUpdating = (key, val) =>
    setUpdating((prev) => ({ ...prev, [key]: !!val }));

  const enrichNamesAfterSet = async (result) => {
    const ui = mapCartResultToUI(result || {});
    setCartItems(ui.items);
    setCartTotals(ui.totals);
    setChecked((prev) => {
      const next = {};
      ui.items.forEach(
        (it) => (next[it.uniqueKey] = prev[it.uniqueKey] ?? false)
      );
      return next;
    });

    const need = ui.items.filter((x) => isBadSellerName(x.sellerName));
    if (need.length) {
      const localMap = { ...sellerNameMap };
      const sids = [
        ...new Set(
          need.filter((x) => x.sellerId).map((x) => String(x.sellerId))
        ),
      ];
      await Promise.all(
        sids.map(async (sid) => {
          if (localMap[sid] !== undefined) return;
          try {
            const url = buildSearchSellerByIdUrl(sid);
            const res = await authFetch(url, {
              method: "GET",
              headers: { Accept: "application/json" },
            });
            const data = await res.json().catch(() => ({}));
            const nm =
              data?.result?.shop_name ||
              data?.result?.shopName ||
              data?.result?.name ||
              "";
            localMap[sid] = nm || "";
          } catch {
            localMap[sid] = "";
          }
        })
      );
      setSellerNameMap(localMap);
      setCartItems((prev) =>
        prev.map((it) => {
          if (!it?.sellerId) return it;
          if (!isBadSellerName(it?.sellerName)) return it;
          const good =
            (localMap[it.sellerId] && String(localMap[it.sellerId]).trim()) ||
            "";
          return { ...it, sellerName: good || fallbackShopName(it.sellerId) };
        })
      );
    }
  };

  /* ====== Inventory/Variants helpers ====== */
  const getInventory = (pid) =>
    inventoryByProductId[pid] || { bySize: {}, byColor: {}, byPair: {} };

  const getPairStock = (pid, size, color) => {
    // legacy (size/color)
    const inv = getInventory(pid);
    const s = String(size || "FREE");
    const c = String(color || "");
    const pair = inv.byPair?.[s]?.[c];
    if (typeof pair === "number") return pair;
    const bySize = inv.bySize?.[s];
    if (typeof bySize === "number") return bySize;
    const byColor = inv.byColor?.[c];
    if (typeof byColor === "number") return byColor;
    return null; // không biết
  };

  const getItemSelection = (item) => {
    // ưu tiên item.options nếu có
    if (item?.options && typeof item.options === "object") return item.options;
    const o = {};
    if (item.size) o["Kích cỡ"] = item.size;
    if (item.color) o["Màu sắc"] = item.color;
    return o;
  };

  const getSelectionValue = (selection, groupName) => {
    const want = nkey(groupName);
    for (const [k, v] of Object.entries(selection || {})) {
      if (nkey(k) === want) return v;
    }
    return "";
  };

  const buildUniqueKeyFromOptions = (sellerId, productId, sel) => {
    const entries = Object.entries(sel || {}).map(([k, v]) => [
      nkey(k),
      normalize(v),
    ]);
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    const sig = entries.map(([k, v]) => `${k}=${v || "NA"}`).join("|");
    return `${sellerId}-${productId}-${sig || "DEFAULT"}`;
  };

  const findExactVariant = (pid, selection) => {
    const idx = variantsIndexByProductId[pid] || [];
    const normSel = {};
    for (const [k, v] of Object.entries(selection || {})) {
      normSel[nkey(k)] = normalize(v);
    }
    // match exact: tất cả cặp key/value trong variant phải trùng normSel
    return (
      idx.find((row) => {
        const a = row.normOps || {};
        const ka = Object.keys(a);
        const kb = Object.keys(normSel);
        if (ka.length !== kb.length) return false;
        for (const k of ka) {
          if (a[k] !== normSel[k]) return false;
        }
        return true;
      }) || null
    );
  };

  const getExactVariantQty = (pid, selection) => {
    const v = findExactVariant(pid, selection);
    return Number.isFinite(v?.qty) ? v.qty : null;
  };

  const isValueAvailableForProductSelection = (
    pid,
    selection,
    groupName,
    candidateValue
  ) => {
    const idx = variantsIndexByProductId[pid] || [];
    if (!idx.length) return true; // không có index -> không chặn

    const cand = normalize(candidateValue);
    const keep = {};
    for (const [k, v] of Object.entries(selection || {})) {
      if (nkey(k) === nkey(groupName)) continue;
      keep[nkey(k)] = normalize(v);
    }

    // có ít nhất 1 variant với qty>0 thỏa keep + groupName=cand
    return idx.some((row) => {
      if (!(Number(row?.qty) > 0)) return false;
      const ops = row.normOps || {};
      if (ops[nkey(groupName)] !== cand) return false;
      for (const [k, val] of Object.entries(keep)) {
        if (ops[k] !== val) return false;
      }
      return true;
    });
  };

  /* ====== Actions: Qty ====== */
  async function applyQtyChange(item, nextQty) {
    if (nextQty < 1) return;
    if (!userId) {
      alert("Không xác định được người dùng. Vui lòng đăng nhập lại.");
      return;
    }

    // chặn vượt tồn kho (ưu tiên exact variant)
    const selection = getItemSelection(item);
    const exact = getExactVariantQty(item.productId, selection);
    const stockAvail =
      exact ?? getPairStock(item.productId, item.size, item.color);

    if (Number.isFinite(stockAvail) && nextQty > stockAvail) {
      showToast({
        title: "Vượt tồn kho",
        text: `Chỉ còn ${stockAvail} sản phẩm khả dụng cho lựa chọn này.`,
        type: "warning",
      });
      return;
    }

    const key = item.uniqueKey;
    const prevItems = cartItems;
    const prevTotals = cartTotals;

    setCartItems((prev) =>
      prev.map((i) =>
        i.uniqueKey === key
          ? {
              ...i,
              quantity: nextQty,
              totalPrice: (i.unitPrice ?? 0) * nextQty,
            }
          : i
      )
    );
    setItemUpdating(key, true);

    try {
      const optionsForBE = normalizeOptionKeysForBE(selection);
      const body = {
        productId: item.productId,
        sellerId: item.sellerId,
        quantity: nextQty,
        userId,
        ...(optionsForBE && Object.keys(optionsForBE).length
          ? { options: optionsForBE }
          : { size: item.size || "FREE", color: item.color || "" }),
      };
      const resp = await updateCartQuantity({
        productId: item.productId,
        sellerId: item.sellerId,
        quantity: nextQty,
        userId,
        options: optionsForBE, // gửi full options hiện tại (ví dụ "Dung tích")
        size: item.size || "FREE", // fallback, không hại nếu đã có options
        color: item.color || "",
      });

      await enrichNamesAfterSet(resp?.result);
    } catch (e) {
      showToast({
        title: "Lỗi",
        text: e.message || "Cập nhật số lượng thất bại",
        type: "error",
      });
      setCartItems(prevItems);
      setCartTotals(prevTotals);
    } finally {
      setItemUpdating(key, false);
    }
  }
  const incQty = (item) => applyQtyChange(item, (item.quantity || 0) + 1);
  const decQty = (item) => {
    if (item.quantity > 1) applyQtyChange(item, (item.quantity || 0) - 1);
  };

  /* ====== Actions: Legacy size/color (fallback) ====== */
  async function applySizeChange(item, nextSize) {
    if (!userId) {
      alert("Không xác định được người dùng. Vui lòng đăng nhập lại.");
      return;
    }
    const stockAvail = getPairStock(item.productId, nextSize, item.color);
    if (Number.isFinite(stockAvail) && stockAvail <= 0) {
      showToast({
        title: "Hết hàng",
        text: "Kích cỡ này hiện đã hết hàng cho màu đang chọn.",
        type: "warning",
      });
      return;
    }

    const key = item.uniqueKey;
    const prevItems = cartItems;
    const prevTotals = cartTotals;

    const newKey = `${item.sellerId}-${item.productId}-${item.color || "NA"}-${
      nextSize || "FREE"
    }`;

    setCartItems((prev) =>
      prev.map((i) =>
        i.uniqueKey === key
          ? {
              ...i,
              size: nextSize,
              uniqueKey: newKey,
            }
          : i
      )
    );
    setChecked((prev) => {
      const next = { ...prev };
      const wasChecked = !!prev[key];
      delete next[key];
      next[newKey] = wasChecked;
      return next;
    });
    setItemUpdating(newKey, true);

    try {
      const resp = await updateCartSize({
        productId: item.productId,
        sellerId: item.sellerId,
        fromSize: item.size || "FREE",
        toSize: nextSize || "FREE",
        quantity: item.quantity ?? 1,
        userId,
        color: item.color || "",
      });

      await enrichNamesAfterSet(resp?.result);
    } catch (e) {
      console.error("❌ Cập nhật size lỗi:", e);
      alert(e.message || "Cập nhật size thất bại");
      setCartItems(prevItems);
      setCartTotals(prevTotals);
    } finally {
      setItemUpdating(newKey, false);
    }
  }

  async function applyColorChange(item, nextColor) {
    if (!userId) {
      alert("Không xác định được người dùng. Vui lòng đăng nhập lại.");
      return;
    }
    const stockAvail = getPairStock(item.productId, item.size, nextColor);
    if (Number.isFinite(stockAvail) && stockAvail <= 0) {
      showToast({
        title: "Hết hàng",
        text: "Màu này hiện đã hết hàng cho kích cỡ đang chọn.",
        type: "warning",
      });
      return;
    }

    const key = item.uniqueKey;
    const prevItems = cartItems;
    const prevTotals = cartTotals;

    const newKey = `${item.sellerId}-${item.productId}-${nextColor || "NA"}-${
      item.size || "FREE"
    }`;

    setCartItems((prev) =>
      prev.map((i) =>
        i.uniqueKey === key ? { ...i, color: nextColor, uniqueKey: newKey } : i
      )
    );
    setChecked((prev) => {
      const next = { ...prev };
      const wasChecked = !!prev[key];
      delete next[key];
      next[newKey] = wasChecked;
      return next;
    });
    setItemUpdating(newKey, true);

    try {
      const resp = await updateCartVariant({
        userId,
        productId: item.productId,
        sellerId: item.sellerId,
        quantity: item.quantity ?? 1,
        originalOptions: {
          "Kích cỡ": String(item.size || "FREE"),
          ...(item.color ? { "Màu sắc": String(item.color) } : {}),
        },
        options: {
          "Kích cỡ": String(item.size || "FREE"),
          ...(nextColor ? { "Màu sắc": String(nextColor) } : {}),
        },
      });

      await enrichNamesAfterSet(resp?.result);
    } catch (e) {
      console.error("❌ Cập nhật màu lỗi:", e);
      showToast({
        title: "Cập nhật màu thất bại",
        text: e.message || "Không thể cập nhật màu",
        type: "error",
      });
      setCartItems(prevItems);
      setCartTotals(prevTotals);
    } finally {
      setItemUpdating(newKey, false);
    }
  }

  /* ====== Actions: Generic option change (Size/Color/Dung tích/…) ====== */
  async function applyOptionChange(item, groupName, nextValue) {
    if (!userId) {
      alert("Không xác định được người dùng. Vui lòng đăng nhập lại.");
      return;
    }

    const selection = getItemSelection(item) || {};
    const newSelection = { ...selection };
    // tìm đúng key theo tên nhóm (theo normalization)
    let replacedKey = groupName;
    for (const k of Object.keys(newSelection)) {
      if (nkey(k) === nkey(groupName)) {
        replacedKey = k;
        break;
      }
    }
    newSelection[replacedKey] = String(nextValue ?? "");

    // check tồn kho khả dụng cho lựa chọn mới
    const ok = isValueAvailableForProductSelection(
      item.productId,
      selection,
      groupName,
      nextValue
    );
    if (!ok) {
      return showToast({
        title: "Hết hàng",
        text: "Lựa chọn này hiện không còn hàng cho các thuộc tính đang chọn.",
        type: "warning",
      });
    }

    // Optimistic UI
    const key = item.uniqueKey;
    const prevItems = cartItems;
    const prevTotals = cartTotals;

    const newKey = buildUniqueKeyFromOptions(
      item.sellerId,
      item.productId,
      newSelection
    );

    // Nếu groupName là "Kích cỡ"/"Màu sắc" -> cập nhật các field tường minh để đồng bộ UI cũ
    const isSizeGroup =
      nkey(groupName) === "kích cỡ" ||
      nkey(groupName) === "size" ||
      nkey(groupName) === "kích thước";
    const isColorGroup =
      nkey(groupName) === "màu sắc" ||
      nkey(groupName) === "màu" ||
      nkey(groupName) === "color";

    // Thử lấy giá từ exact variant (nếu có) để cập nhật unitPrice optimistically
    const vExact = findExactVariant(item.productId, newSelection);
    const nextPrice = Number.isFinite(Number(vExact?.price))
      ? Number(vExact.price)
      : item.unitPrice;

    setCartItems((prev) =>
      prev.map((i) =>
        i.uniqueKey === key
          ? {
              ...i,
              options: newSelection,
              size: isSizeGroup ? String(nextValue || "FREE") : i.size,
              color: isColorGroup ? String(nextValue || "") : i.color,
              unitPrice: nextPrice,
              totalPrice: (nextPrice ?? 0) * (i.quantity ?? 1),
              uniqueKey: newKey,
            }
          : i
      )
    );
    setChecked((prev) => {
      const next = { ...prev };
      const wasChecked = !!prev[key];
      delete next[key];
      next[newKey] = wasChecked;
      return next;
    });
    setItemUpdating(newKey, true);

    try {
      // Nếu chỉ là legacy size (không có variants index khác), fallback gọi updateCartSize
      const hasIndex =
        (variantsIndexByProductId[item.productId] || []).length > 0;
      const bodyOptionsOld = normalizeOptionKeysForBE(selection);
      const bodyOptionsNew = normalizeOptionKeysForBE(newSelection);

      if (!hasIndex && isSizeGroup) {
        const resp = await updateCartSize({
          productId: item.productId,
          sellerId: item.sellerId,
          fromSize: String(
            selection["Kích cỡ"] ??
              selection["Size"] ??
              selection["kích cỡ"] ??
              selection["kích thước"] ??
              "FREE"
          ),
          toSize: String(
            newSelection["Kích cỡ"] ??
              newSelection["Size"] ??
              newSelection["kích cỡ"] ??
              newSelection["kích thước"] ??
              "FREE"
          ),
          quantity: item.quantity ?? 1,
          userId,
          color: String(
            selection["Màu sắc"] ??
              selection["Color"] ??
              selection["màu"] ??
              selection["color"] ??
              ""
          ),
        });
        await enrichNamesAfterSet(resp?.result);
      } else {
        // generic: dùng updateCartVariant
        const resp = await updateCartVariant({
          userId,
          productId: item.productId,
          sellerId: item.sellerId,
          quantity: item.quantity ?? 1,
          originalOptions: bodyOptionsOld,
          options: bodyOptionsNew,
        });
        await enrichNamesAfterSet(resp?.result);
      }
    } catch (e) {
      console.error("❌ Cập nhật biến thể lỗi:", e);
      showToast({
        title: "Cập nhật biến thể thất bại",
        text: e.message || "Không thể cập nhật lựa chọn",
        type: "error",
      });
      setCartItems(prevItems);
      setCartTotals(prevTotals);
      setChecked((prev) => ({ ...prev, [key]: !!prev[key] })); // trả về trạng thái chọn cũ
    } finally {
      setItemUpdating(newKey, false);
    }
  }

  /* ====== Remove items ====== */
  async function handleRemoveOne(item) {
    if (!userId) {
      showToast({
        title: "Thiếu thông tin",
        text: "Vui lòng đăng nhập lại.",
        type: "error",
      });
      return;
    }

    const ok = await confirmToast({
      title: "Xoá sản phẩm?",
      text: `Bạn có chắc muốn xóa "${item.productName}" khỏi giỏ hàng?`,
      confirmText: "Xoá",
      cancelText: "Hủy",
      type: "warning",
    });
    if (!ok) return;

    const loadingId = showToast({
      title: "Đang xoá…",
      type: "info",
      duration: 0,
    });

    const key = item.uniqueKey;
    const prevItems = cartItems;
    const prevTotals = cartTotals;

    const optimisticItems = prevItems.filter((i) => i.uniqueKey !== key);
    setCartItems(optimisticItems);
    setChecked((prev) => {
      const n = { ...prev };
      delete n[key];
      return n;
    });
    setCartTotals((t) => {
      if (!t) return t;
      const subtotal = optimisticItems.reduce(
        (s, it) => s + (it.totalPrice ?? 0),
        0
      );
      return {
        ...t,
        subtotal,
        finalAmount: subtotal + (t.totalShipping ?? 0) - (t.totalDiscount ?? 0),
        totalItems: optimisticItems.reduce(
          (s, it) => s + (it.quantity ?? 0),
          0
        ),
        totalSellers: new Set(optimisticItems.map((i) => i.sellerId)).size,
      };
    });

    try {
      const sel = getItemSelection(item); // ưu tiên item.options
      const canonical = normalizeOptionKeysForBE(sel);
      const resp = await removeCartItem({
        userId,
        sellerId: item.sellerId,
        productId: item.productId,
        options: canonical, // ✅ truyền đúng options hiện có
        // fallback size/color sẽ do service lo nếu options null
      });

      await enrichNamesAfterSet(resp?.result);

      hideToast(loadingId);
      showToast({ title: "Đã xoá sản phẩm", type: "success", duration: 1800 });
    } catch (e) {
      hideToast(loadingId);
      showToast({
        title: "Xoá thất bại",
        text: e.message || "Không thể xoá sản phẩm.",
        type: "error",
        duration: 2500,
      });
      setCartItems(prevItems);
      setCartTotals(prevTotals);
      setChecked((prev) => ({ ...prev, [key]: true }));
    }
  }

  async function handleRemoveSelected() {
    if (!userId) {
      showToast({
        title: "Thiếu thông tin",
        text: "Vui lòng đăng nhập lại.",
        type: "error",
      });
      return;
    }
    const itemsToRemove = cartItems.filter((i) => checked[i.uniqueKey]);
    if (itemsToRemove.length === 0) {
      showToast({
        title: "Chưa chọn sản phẩm nào",
        type: "warning",
        duration: 2000,
      });
      return;
    }

    const ok = await confirmToast({
      title: `Xoá ${itemsToRemove.length} sản phẩm?`,
      text: "Hành động này không thể hoàn tác.",
      confirmText: "Xoá",
      cancelText: "Hủy",
      type: "warning",
    });
    if (!ok) return;

    const loadingId = showToast({
      title: "Đang xoá các sản phẩm…",
      type: "info",
      duration: 0,
    });

    const prevItems = cartItems;
    const prevTotals = cartTotals;

    const toRemoveSet = new Set(itemsToRemove.map((i) => i.uniqueKey));
    const optimisticItems = prevItems.filter(
      (i) => !toRemoveSet.has(i.uniqueKey)
    );
    setCartItems(optimisticItems);
    setChecked((prev) => {
      const n = { ...prev };
      itemsToRemove.forEach((i) => {
        delete n[i.uniqueKey];
      });
      return n;
    });
    setCartTotals((t) => {
      if (!t) return t;
      const subtotal = optimisticItems.reduce(
        (s, it) => s + (it.totalPrice ?? 0),
        0
      );
      return {
        ...t,
        subtotal,
        finalAmount: subtotal + (t.totalShipping ?? 0) - (t.totalDiscount ?? 0),
        totalItems: optimisticItems.reduce(
          (s, it) => s + (it.quantity ?? 0),
          0
        ),
        totalSellers: new Set(optimisticItems.map((i) => i.sellerId)).size,
      };
    });

    try {
      const payload = itemsToRemove.map((i) => {
        const sel = getItemSelection(i);
        const canonical = normalizeOptionKeysForBE(sel);
        return {
          sellerId: i.sellerId,
          productId: i.productId,
          options: canonical, // ✅ giữ nguyên toàn bộ option (Dung tích/Khối lượng/…)
        };
      });
      const resp = await removeCartItemsBatch({ userId, items: payload });

      await enrichNamesAfterSet(resp?.result);

      hideToast(loadingId);
      showToast({
        title: "Đã xoá các sản phẩm",
        type: "success",
        duration: 1800,
      });
    } catch (e) {
      hideToast(loadingId);
      showToast({
        title: "Xoá thất bại",
        text: e.message || "Không thể xoá các sản phẩm đã chọn.",
        type: "error",
        duration: 2500,
      });
      setCartItems(prevItems);
      setCartTotals(prevTotals);
      setChecked((prev) => {
        const n = { ...prev };
        itemsToRemove.forEach((i) => {
          n[i.uniqueKey] = true;
        });
        return n;
      });
    }
  }

  async function handleClearAll() {
    if (!userId) {
      showToast({
        title: "Thiếu thông tin",
        text: "Vui lòng đăng nhập lại.",
        type: "error",
      });
      return;
    }
    if (cartItems.length === 0) return;

    const ok = await confirmToast({
      title: `Xoá toàn bộ giỏ hàng?`,
      text: `Bạn có chắc muốn xoá ${cartItems.length} sản phẩm khỏi giỏ hàng?`,
      confirmText: "Xoá hết",
      cancelText: "Hủy",
      type: "warning",
    });
    if (!ok) return;

    const loadingId = showToast({
      title: "Đang xoá giỏ hàng…",
      type: "info",
      duration: 0,
    });

    const prevItems = cartItems;
    const prevTotals = cartTotals;

    setCartItems([]);
    setChecked({});
    setCartTotals((t) =>
      t
        ? {
            ...t,
            totalItems: 0,
            totalSellers: 0,
            subtotal: 0,
            totalShipping: 0,
            totalDiscount: 0,
            finalAmount: 0,
          }
        : t
    );

    try {
      const payload = prevItems.map((i) => {
        const sel = getItemSelection(i); // ưu tiên i.options
        const canonical = normalizeOptionKeysForBE(sel); // chuẩn hoá key
        return {
          sellerId: i.sellerId,
          productId: i.productId,
          ...(canonical && Object.keys(canonical).length
            ? { options: canonical }
            : {}),
        };
      });
      const resp = await removeCartItemsBatch({ userId, items: payload });

      await enrichNamesAfterSet(resp?.result);
      setChecked({});

      hideToast(loadingId);
      showToast({
        title: "Đã xoá giỏ hàng",
        type: "success",
        duration: 1600,
      });
    } catch (e) {
      hideToast(loadingId);
      showToast({
        title: "Xoá giỏ hàng thất bại",
        text: e.message || "Vui lòng thử lại.",
        type: "error",
        duration: 2600,
      });
      setCartItems(prevItems);
      setCartTotals(prevTotals);
    }
  }

  function resetCartTour() {
    try {
      localStorage.removeItem(CART_TOUR_SEEN_KEY);
      showToast({
        title: "Đã reset hướng dẫn",
        type: "success",
        duration: 1200,
      });
    } catch {}
  }

  /* ====== Render ====== */
  if (loading) {
    return (
      <div className="cart">
        <div className="cart__topbar">
          <button
            type="button"
            className="cart__continue"
            onClick={() => window.history.back()}
          >
            <span className="cart__continue-ic">←</span>
            Tiếp tục mua sắm
          </button>

          <div className="cart__topbar-tools" ref={toolsRef}>
            <button
              type="button"
              className="help-toggle"
              aria-expanded={showTools}
              aria-label="Hỗ trợ"
              onClick={() => setShowTools((v) => !v)}
            >
              ?
            </button>

            <div className={`tools-list ${showTools ? "is-open" : ""}`}>
              <button
                type="button"
                className="btn btn--tour"
                onClick={runCartTour}
              >
                Hướng dẫn
              </button>
              {process.env.NODE_ENV === "development" && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={resetCartTour}
                >
                  Reset hướng dẫn
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="cart__wrap">
          <div style={{ padding: "2rem" }}>
            <h2>Đang tải giỏ hàng…</h2>
            {error && <p style={{ color: "#d33" }}>{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (!cartItems.length) {
    return (
      <div className="cart">
        <div className="cart__topbar">
          <button
            type="button"
            className="cart__continue"
            onClick={() => window.history.back()}
          >
            <span className="cart__continue-ic">←</span>
            Tiếp tục mua sắm
          </button>

          <div className="cart__topbar-tools" ref={toolsRef}>
            <button
              type="button"
              className="help-toggle"
              aria-expanded={showTools}
              aria-label="Hỗ trợ"
              onClick={() => setShowTools((v) => !v)}
            >
              ?
            </button>

            <div className={`tools-list ${showTools ? "is-open" : ""}`}>
              <button
                type="button"
                className="btn btn--tour"
                onClick={runCartTour}
              >
                Hướng dẫn
              </button>
              {process.env.NODE_ENV === "development" && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={resetCartTour}
                >
                  Reset hướng dẫn
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="cart__wrap">
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <h2>Giỏ hàng trống</h2>
            <p>{error || "Bạn chưa có sản phẩm nào trong giỏ hàng"}</p>
          </div>
        </div>
      </div>
    );
  }

  const totalItemsCount = cartItems.length;

  return (
    <div className="cart">
      <div className="cart__topbar">
        <button
          type="button"
          className="cart__continue"
          onClick={() => window.history.back()}
        >
          <span className="cart__continue-ic">←</span>
          Tiếp tục mua sắm
        </button>

        <div className="cart__topbar-tools" ref={toolsRef}>
          <button
            type="button"
            className="help-toggle"
            aria-expanded={showTools}
            aria-label="Hỗ trợ"
            onClick={() => setShowTools((v) => !v)}
          >
            ?
          </button>

          <div className={`tools-list ${showTools ? "is-open" : ""}`}>
            <button
              type="button"
              className="btn btn--tour"
              onClick={runCartTour}
            >
              Hướng dẫn
            </button>
            {process.env.NODE_ENV === "development" && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={resetCartTour}
              >
                Reset hướng dẫn
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="cart__wrap">
        <header className="cart__header">
          <div
            className="cart__header-row"
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <div className="cart__header-left">
              <h1>Giỏ hàng</h1>
              <p>
                Có <b>{totalItemsCount}</b> sản phẩm trong giỏ hàng
              </p>
            </div>

            <div style={{ marginLeft: "auto" }}>
              <button
                type="button"
                className="cart__clear-all"
                onClick={handleClearAll}
                disabled={cartItems.length === 0}
                title="Xoá toàn bộ giỏ hàng"
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: cartItems.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                🗑️ Xoá giỏ hàng
              </button>
            </div>
          </div>

          <div className="cart__divider" />
        </header>

        <div className="cart__list">
          {groupedBySeller.map((seller) => (
            <section key={seller.sellerId} className="cart__shop">
              <div className="cart__shop-head">
                <div className="cart__shop-dot" />
                <div className="cart__shop-name">{seller.sellerName}</div>

                <label className="chk" style={{ marginLeft: "auto" }}>
                  <input
                    type="checkbox"
                    checked={getSelectAllState(seller.sellerId)}
                    onChange={() => handleSelectAllForSeller(seller.sellerId)}
                  />
                  <span className="chk__dot" />
                </label>
                <span style={{ marginLeft: "8px", fontSize: "14px" }}>
                  Chọn tất cả ({seller.items.length})
                </span>
              </div>

              {seller.items.map((item) => {
                /* ===== Lấy option groups động cho product này ===== */
                const groups = optionGroupsByProductId[item.productId] || [];

                /* ===== Legacy fallback (nếu không có groups) ===== */
                const rawSizeOpts = sizesByProductId[item.productId];
                const baseSizes =
                  Array.isArray(rawSizeOpts) && rawSizeOpts.length > 0
                    ? rawSizeOpts
                    : [{ size: item.size || "FREE", inStock: true }];

                const sizeDedup = new Map(
                  baseSizes
                    .concat([{ size: item.size || "FREE", inStock: true }])
                    .map((o) => [
                      String(o.size),
                      { size: String(o.size), inStock: !!o.inStock },
                    ])
                );
                const sizeOptions = Array.from(sizeDedup.values());

                const rawColorOpts = colorsByProductId[item.productId];
                const baseColors =
                  Array.isArray(rawColorOpts) && rawColorOpts.length > 0
                    ? rawColorOpts
                    : [{ color: item.color || "", inStock: true }];

                const colorDedup = new Map(
                  baseColors
                    .concat([{ color: item.color || "", inStock: true }])
                    .map((o) => [
                      String(o.color),
                      { color: String(o.color), inStock: !!o.inStock },
                    ])
                );
                const colorOptions = Array.from(colorDedup.values());

                /* ===== Tồn kho cho tổ hợp hiện tại ===== */
                const selection = getItemSelection(item);
                const exactAvail = getExactVariantQty(
                  item.productId,
                  selection
                );

                // Fallback nếu không index được exact variant
                const inv = getInventory(item.productId);
                const pairAvailLegacy = getPairStock(
                  item.productId,
                  item.size,
                  item.color
                );

                const pairAvail = Number.isFinite(exactAvail)
                  ? exactAvail
                  : pairAvailLegacy;

                const isPairOOS = Number.isFinite(pairAvail)
                  ? pairAvail <= 0
                  : false;

                const isBusy = !!updating[item.uniqueKey];
                const isItemSelected = !!checked[item.uniqueKey];
                const canSelect = canSelectItem(item);

                // Disable nút + nếu vượt tồn kho
                const disablePlus =
                  isBusy ||
                  (Number.isFinite(pairAvail) &&
                    (item.quantity ?? 0) >= pairAvail);

                return (
                  <article key={item.uniqueKey} className="cart__item">
                    <button
                      className="cart__item-remove"
                      title="Xoá sản phẩm"
                      onClick={() => handleRemoveOne(item)}
                      aria-label="Xoá"
                    >
                      ×
                    </button>

                    <div className="cart__check">
                      <label className="chk" data-tour="select-item">
                        <input
                          type="checkbox"
                          checked={isItemSelected}
                          onChange={() => toggleItemCheck(item)}
                          disabled={!canSelect && !isItemSelected}
                        />
                        <span
                          className={`chk__dot ${
                            isItemSelected ? "chk__dot--checked" : ""
                          }`}
                        />
                      </label>
                    </div>

                    <div className="cart__thumb">
                      {item.productImage ? (
                        <img
                          src={item.productImage}
                          alt={item.productName || "Sản phẩm không tên"}
                          onError={(e) =>
                            (e.currentTarget.src =
                              "https://placehold.co/150x150")
                          }
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="skeleton"
                          style={{
                            width: 100,
                            height: 100,
                            background: "#eee",
                            borderRadius: 8,
                          }}
                        />
                      )}
                    </div>

                    <div className="cart__main">
                      <h3 className="cart__title">
                        {item.productName || "Sản phẩm không tên"}
                      </h3>

                      {/* ====== Biến thể động nếu có groups ====== */}
                      {Array.isArray(groups) && groups.length > 0 ? (
                        <div className="cart__variants">
                          {groups.map((grp, idx) => {
                            const currVal =
                              getSelectionValue(selection, grp.name) || "";
                            return (
                              <div
                                className="cart__variant"
                                key={`${item.productId}-grp-${idx}`}
                              >
                                <span>{grp.name}:</span>
                                <div
                                  className="select"
                                  data-tour="select-variant"
                                >
                                  <select
                                    value={currVal}
                                    disabled={isBusy}
                                    onChange={(e) =>
                                      applyOptionChange(
                                        item,
                                        grp.name,
                                        e.target.value
                                      )
                                    }
                                  >
                                    {grp.values.map((val) => {
                                      const available =
                                        isValueAvailableForProductSelection(
                                          item.productId,
                                          selection,
                                          grp.name,
                                          val
                                        );
                                      const disabled = !available;
                                      return (
                                        <option
                                          key={`${grp.name}-${val}`}
                                          value={val}
                                          disabled={disabled}
                                          title={
                                            disabled ? "Hết hàng" : "Còn hàng"
                                          }
                                        >
                                          {String(val) +
                                            (disabled ? " (hết)" : "")}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  <span className="select__caret">▾</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* ====== Fallback legacy: chỉ Màu + Size ====== */
                        <div className="cart__variants">
                          {/* Màu (chỉ hiển thị nếu product thực sự có color list) */}
                          {colorOptions.length > 1 && (
                            <div className="cart__variant">
                              <span>Màu:</span>
                              <div className="select" data-tour="select-color">
                                <select
                                  value={item.color || ""}
                                  disabled={isBusy}
                                  onChange={(e) =>
                                    applyColorChange(item, e.target.value)
                                  }
                                >
                                  {colorOptions.map((opt) => {
                                    const stockForThisColor =
                                      (getPairStock(
                                        item.productId,
                                        item.size,
                                        opt.color
                                      ) ??
                                        inv.byColor?.[opt.color] ??
                                        0) ||
                                      0;
                                    const disabled = stockForThisColor <= 0;
                                    return (
                                      <option
                                        key={opt.color || "NA"}
                                        value={opt.color || ""}
                                        disabled={disabled}
                                        title={
                                          disabled ? "Hết hàng" : "Còn hàng"
                                        }
                                      >
                                        {(opt.color || "—") +
                                          (disabled ? " (hết)" : "")}
                                      </option>
                                    );
                                  })}
                                </select>
                                <span className="select__caret">▾</span>
                              </div>
                            </div>
                          )}

                          {/* Size luôn hiển thị nếu có ít nhất một size */}
                          {sizeOptions.length > 0 && (
                            <div className="cart__variant">
                              <span>Size:</span>
                              <div
                                className="select"
                                data-tour="select-variant"
                              >
                                <select
                                  value={item.size}
                                  disabled={isBusy}
                                  onChange={(e) =>
                                    applySizeChange(item, e.target.value)
                                  }
                                >
                                  {(sizeOptions || [{ size: item.size }]).map(
                                    (opt) => {
                                      const stockForThisSize =
                                        (getPairStock(
                                          item.productId,
                                          opt.size,
                                          item.color
                                        ) ??
                                          inv.bySize?.[opt.size] ??
                                          0) ||
                                        0;
                                      const disabled = stockForThisSize <= 0;
                                      return (
                                        <option
                                          key={opt.size}
                                          value={opt.size}
                                          disabled={disabled}
                                          title={
                                            disabled ? "Hết hàng" : "Còn hàng"
                                          }
                                        >
                                          {String(opt.size).toUpperCase() +
                                            (disabled ? " (hết)" : "")}
                                        </option>
                                      );
                                    }
                                  )}
                                </select>
                                <span className="select__caret">▾</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {isPairOOS && (
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 12,
                            color: "#d33",
                          }}
                        >
                          Biến thể đã hết hàng — hãy chọn thuộc tính khác.
                        </div>
                      )}
                    </div>

                    <div className="cart__qty" data-tour="change-qty">
                      <button
                        className="qty__btn qty__btn--minus"
                        onClick={() => decQty(item)}
                        disabled={item.quantity <= 1 || isBusy}
                        aria-label="Giảm số lượng"
                      >
                        –
                      </button>
                      <div className="qty__num">
                        {isBusy ? "…" : item.quantity}
                      </div>
                      <button
                        className="qty__btn qty__btn--plus"
                        onClick={() => incQty(item)}
                        disabled={disablePlus}
                        aria-label="Tăng số lượng"
                        title={
                          disablePlus && Number.isFinite(pairAvail)
                            ? `Tối đa ${pairAvail} sản phẩm`
                            : "Tăng số lượng"
                        }
                      >
                        +
                      </button>
                    </div>

                    <div className="cart__price">
                      {fmtVND((item.unitPrice ?? 0) * (item.quantity ?? 0))}
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
        </div>

        <footer className="cart__footer">
          <button
            className="cart__delete-selected"
            data-tour="delete-selected"
            onClick={handleRemoveSelected}
            disabled={selectedItems.length === 0}
            title={
              selectedItems.length
                ? `Xoá ${selectedItems.length} sản phẩm đã chọn`
                : "Chưa chọn sản phẩm"
            }
          >
            Xoá đã chọn{" "}
            {selectedItems.length > 0 && `(${selectedItems.length})`}
          </button>

          <div className="cart__spacer" />

          <div className="cart__summary">
            <div
              style={{
                textAlign: "right",
                fontSize: "14px",
                marginBottom: "5px",
              }}
            >
              <div>Tạm tính: {fmtVND(selectedTotals.subtotal)}</div>
              {selectedItems.length > 0 && (
                <>
                  <div>Phí vận chuyển: {fmtVND(selectedTotals.shipping)}</div>
                  {selectedTotals.discount > 0 && (
                    <div>Giảm giá: -{fmtVND(selectedTotals.discount)}</div>
                  )}
                </>
              )}
            </div>
            <div className="cart__total">
              <span>Tổng cộng:</span>
              <strong>{fmtVND(selectedTotals.finalAmount)}</strong>
            </div>
          </div>

          <button
            className="cart__checkout"
            data-tour="checkout"
            onClick={() => {
              const selected = cartItems.filter((i) => checked[i.uniqueKey]);
              if (!selected.length) {
                showToast({
                  title: "Chưa chọn sản phẩm",
                  text: "Vui lòng chọn ít nhất 1 sản phẩm để thanh toán.",
                  type: "warning",
                });
                return;
              }

              const payload = selected.map((i) => {
                // lấy selection hiện tại (ưu tiên i.options nếu có)
                const sel =
                  i.options && typeof i.options === "object"
                    ? i.options
                    : (() => {
                        const o = {};
                        if (i.size) o["Kích cỡ"] = String(i.size);
                        if (i.color) o["Màu sắc"] = String(i.color);
                        return o;
                      })();

                // chuẩn hoá key để khớp BE
                const canonical = (function normalizeForBE(opts) {
                  const out = {};
                  for (const [k, v] of Object.entries(opts || {})) {
                    const kk = String(k).toLowerCase().trim();
                    if (["size", "kích cỡ", "kích thước"].includes(kk))
                      out["Kích cỡ"] = v;
                    else if (["color", "màu", "màu sắc"].includes(kk))
                      out["Màu sắc"] = v;
                    else out[k] = v;
                  }
                  return out;
                })(sel);

                return {
                  id: `${i.sellerId}-${i.productId}-${i.color || "NA"}-${
                    i.size || "FREE"
                  }`,
                  productId: i.productId,
                  sellerId: i.sellerId,
                  sellerName: isBadSellerName(i.sellerName)
                    ? sellerNameMap[i.sellerId] || fallbackShopName(i.sellerId)
                    : i.sellerName,
                  title: i.productName || "Sản phẩm",
                  image: i.productImage || "https://placehold.co/150x150",
                  color: i.color || "",
                  size: i.size || "FREE",
                  qty: i.quantity ?? 1,
                  price: i.unitPrice ?? 0,
                  options: canonical,
                  selectedOptions: canonical,
                };
              });

              sessionStorage.setItem("checkout_items", JSON.stringify(payload));
              navigate("/checkout", { state: { items: payload } });
            }}
            disabled={selectedItems.length === 0}
          >
            Thanh toán {selectedItems.length > 0 && `(${selectedItems.length})`}
          </button>
        </footer>
      </div>
    </div>
  );
}
