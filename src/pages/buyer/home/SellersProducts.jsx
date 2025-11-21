// src/pages/buyer/seller/SellersProducts.jsx
"use client";

import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { AuthContext } from "../../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../../config/api";
import "../../../styles/sellersproducts.css";
import "../../../styles/home.css";
import ProductQuickView from "../home/ProductQuickView";
import { showToast, hideToast } from "../../../utils/toast";

/** Lấy ảnh đầu tiên không phải video */
const pickImageUrl = (images = []) =>
  images.find(
    (it) =>
      typeof it?.url === "string" && !it.url.toLowerCase().endsWith(".mp4")
  )?.url || "/img/default.png";

// 👉 helper định dạng VND ngắn gọn (không có ký hiệu đ)
const fmtVND = (n) => new Intl.NumberFormat("vi-VN").format(Number(n) || 0);
// Ép số an toàn
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Lấy giá hiển thị cho card: ưu tiên variants (min price), fallback sizes[0]
function getCardPrice(p) {
  // A) Nếu có variants: lấy giá thấp nhất
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
        // nếu bằng nhau, lấy compare nhỏ hơn nhưng vẫn > price (để hiển thị hợp lý)
        if (cmp && cmp > price) {
          if (bestCompare == null || cmp < bestCompare) {
            bestCompare = cmp;
          }
        }
      }
    }

    return { price: minPrice, compare: bestCompare };
  }

  // B) Fallback: sizes[0]
  if (Array.isArray(p?.sizes) && p.sizes.length > 0) {
    const s0 = p.sizes[0];
    const price = num(s0?.price);
    const cmp = num(s0?.compareAtPrice);
    return {
      price,
      compare: cmp && price != null && cmp > price ? cmp : null,
    };
  }

  // C) Không có dữ liệu giá
  return { price: null, compare: null };
}
/** Mô tả nhanh loại voucher */
function describeVoucher(v) {
  if (v?.type === "PERCENTAGE") {
    const max =
      Number(v?.maxDiscountAmount || 0) > 0
        ? ` (tối đa ${fmtVND(v.maxDiscountAmount)}đ)`
        : "";
    return `Giảm ${v.discountValue}%${max}`;
  }
  if (v?.type === "FREE_SHIPPING") return "Miễn phí vận chuyển";
  // FIXED_AMOUNT
  return `Giảm ${fmtVND(v.discountValue)}đ`;
}

/** Lấy userId tươi từ profile (và đồng bộ sessionStorage) */
async function getFreshUserId(authFetch) {
  const res = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  const uid = data?.result?.id || data?.id;
  if (!res.ok || !uid) {
    throw new Error(data?.message || "Không lấy được userId từ profile");
  }
  sessionStorage.setItem("user_id", String(uid));
  return String(uid);
}

/** Đồng bộ cách lấy userId như CheckoutPage */
async function resolveUserId({ authFetch, location }) {
  const cached = sessionStorage.getItem("user_id");
  if (cached && typeof cached === "string" && cached.trim()) return cached;

  const fromState = location?.state?.userId;
  if (fromState && String(fromState).trim()) {
    sessionStorage.setItem("user_id", String(fromState).trim());
    return String(fromState).trim();
  }

  // fallback luôn dùng profile tươi
  return getFreshUserId(authFetch);
}

export default function SellersProducts() {
  const params = useParams();
  const location = useLocation();
  const paramSellerId = params?.sellerId;
  const { authFetch } = useContext(AuthContext);
  const navigate = useNavigate();

  const [seller, setSeller] = useState(null);
  const [loadingSeller, setLoadingSeller] = useState(true);
  const [sellerErr, setSellerErr] = useState("");

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // 👤 userId đồng bộ theo CheckoutPage
  const [userId, setUserId] = useState(null);

  // Quick view modal
  const [openQuick, setOpenQuick] = useState(false);
  const [quickItem, setQuickItem] = useState(null);

  // 🔹 cache sellerName theo sellerId (để payload có sellerName)
  const [sellerNameMap, setSellerNameMap] = useState({});

  // 🚫 Nếu user là chủ shop → không cho thao tác
  const [isOwner, setIsOwner] = useState(false);
  const [mySellerId, setMySellerId] = useState(null); // 🆕 lưu sellerId của chính mình

  // === Load userId như CheckoutPage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const uid = await resolveUserId({ authFetch, location });
        if (!cancelled) setUserId(uid);
      } catch (e) {
        console.warn("Resolve userId failed:", e?.message || e);
        if (!cancelled) setUserId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authFetch]);

  // === Lấy sellerId hiệu lực
  const [effectiveSellerId, setEffectiveSellerId] = useState(
    paramSellerId || ""
  );
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setSellerErr("");
        setLoadingSeller(true);
        if (paramSellerId) {
          setEffectiveSellerId(paramSellerId);
        } else {
          // Nếu trang không có param sellerId: lấy seller theo user hiện tại (giống logic cũ)
          const resProf = await authFetch(
            `${API_CONFIG.baseUrl}/info/profiles/getMyProfile`,
            { method: "GET", headers: { Accept: "application/json" } }
          );
          const dataProf = await resProf.json().catch(() => ({}));
          if (!resProf.ok)
            throw new Error(dataProf?.message || `HTTP ${resProf.status}`);
          const uid = dataProf?.result?.id;
          if (!uid) throw new Error("Không lấy được userId từ profile.");

          const resSeller = await authFetch(
            `${
              API_CONFIG.baseUrl
            }/info/sellers/searchByUserId/${encodeURIComponent(uid)}`,
            { method: "GET", headers: { Accept: "application/json" } }
          );
          const dataSeller = await resSeller.json().catch(() => ({}));
          if (!resSeller.ok)
            throw new Error(dataSeller?.message || `HTTP ${resSeller.status}`);

          const s = dataSeller?.result || {};
          if (!s?.id)
            throw new Error(
              "Tài khoản chưa có sellerId hoặc seller chưa được duyệt."
            );
          if (!cancelled) setEffectiveSellerId(s.id);

          if (!cancelled) {
            setSeller({
              id: s.id,
              name: s.shop_name || "Shop",
              avatar: s.avatar_link || "/img/default-shop.png",
              address: s.address || "",
              email: s.email || "",
              productsCount: 0,
              rating: "4.9",
              followers: "8.9k",
              responseRate: "89%",
              cancelRate: "1%",
              joined: "4 năm trước",
              online: "22 phút trước",
            });
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Lấy sellerId thất bại:", e);
          setSellerErr(e.message || "Không lấy được thông tin shop");
          setSeller(null);
          setEffectiveSellerId("");
        }
      } finally {
        if (!cancelled) setLoadingSeller(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paramSellerId, authFetch]);

  // Bổ sung info khi có paramSellerId
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!paramSellerId) return;
      try {
        const res = await authFetch(
          `${
            API_CONFIG.baseUrl
          }/info/sellers/searchBySellerId/${encodeURIComponent(paramSellerId)}`,
          { method: "GET", headers: { Accept: "application/json" } }
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          const s = data?.result || {};
          if (!cancelled) {
            setSeller((prev) => ({
              id: s.id,
              name: s.shop_name || "Shop",
              avatar: s.avatar_link || "/img/default-shop.png",
              address: s.address || "",
              email: s.email || "",
              productsCount: prev?.productsCount ?? 0,
              rating: "4.9",
              followers: "8.9k",
              responseRate: "89%",
              cancelRate: "1%",
              joined: "4 năm trước",
              online: "22 phút trước",
            }));
          }
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [paramSellerId, authFetch]);

  // === Lấy sản phẩm theo seller
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!effectiveSellerId) return;
      try {
        setLoadingProducts(true);
        const res = await fetch(
          `${API_CONFIG.baseUrl}/product/searchBySeller/${encodeURIComponent(
            effectiveSellerId
          )}`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
            credentials: "include",
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
        const list = Array.isArray(data?.result) ? data.result : [];
        if (!cancelled) {
          setProducts(list);
          setSeller((prev) =>
            prev ? { ...prev, productsCount: list.length } : prev
          );
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Load seller products failed:", e);
          setProducts([]);
        }
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveSellerId]);

  const headCount = useMemo(
    () => (loadingProducts ? "" : `(${products.length})`),
    [loadingProducts, products.length]
  );

  // ================== VOUCHER ==================
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherErr, setVoucherErr] = useState("");
  const [voucherList, setVoucherList] = useState([]);

  // Xác định chủ shop (so sánh sellerId của user hiện tại với effectiveSellerId)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!userId || !effectiveSellerId) return;
        const url = apiUrl(API_CONFIG.endpoints.searchSellerByUserId(userId));
        const res = await authFetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        const mine = data?.result?.id;
        if (!cancelled) {
          setMySellerId(mine || null); // 🆕 lưu sellerId của mình
          setIsOwner(Boolean(mine && mine === effectiveSellerId)); // set isOwner
        }
      } catch {
        if (!cancelled) {
          setMySellerId(null);
          setIsOwner(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, effectiveSellerId, authFetch]);

  // 🔥 Fetch voucher theo seller
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!effectiveSellerId || !userId) return;
      try {
        setVoucherLoading(true);
        setVoucherErr("");

        const url = `${API_CONFIG.baseUrl}/voucher/seller/${encodeURIComponent(
          effectiveSellerId
        )}?userId=${encodeURIComponent(userId)}`;

        const res = await authFetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || data?.code !== 200) {
          throw new Error(data?.message || `HTTP ${res.status}`);
        }

        const arr = Array.isArray(data?.result) ? data.result : [];
        if (!cancelled) setVoucherList(arr);
      } catch (e) {
        if (!cancelled) {
          setVoucherErr(e?.message || "Không tải được voucher.");
          setVoucherList([]);
        }
      } finally {
        if (!cancelled) setVoucherLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveSellerId, userId, authFetch]);

  // Khóa scroll khi mở QuickView và đảm bảo modal overlay dạng fixed
  useEffect(() => {
    if (openQuick) {
      document.body.classList.add("qv-body-lock");
    } else {
      document.body.classList.remove("qv-body-lock");
    }
    return () => document.body.classList.remove("qv-body-lock");
  }, [openQuick]);

  // Helpers: tính tồn & trạng thái thời gian
  const computeRemaining = (v) => {
    if (typeof v?.remainingQuantity === "number") return v.remainingQuantity;
    if (
      typeof v?.totalQuantity === "number" &&
      typeof v?.claimedQuantity === "number"
    ) {
      return v.totalQuantity - v.claimedQuantity;
    }
    return undefined;
  };

  const isInTimeWindow = (v) => {
    const now = Date.now();
    const startOk = v?.startDate
      ? now >= new Date(v.startDate).getTime()
      : true;
    const endOk = v?.endDate ? now <= new Date(v.endDate).getTime() : true;
    return startOk && endOk;
  };

  // ✅ HIỂN THỊ TẤT CẢ VOUCHER ĐANG DIỄN RA
  const displayVouchers = useMemo(() => {
    const filtered = (voucherList || []).filter((v) => {
      const statusActive = (v?.status || "").toUpperCase() === "ACTIVE";
      const inTimeWindow = isInTimeWindow(v);
      return statusActive && inTimeWindow;
    });

    const withFlags = filtered.map((v) => {
      const remaining = computeRemaining(v);
      const stockOk = remaining === undefined ? true : Number(remaining) > 0;
      const userClaimed = Boolean(v?.userClaimed);
      const canClaim = Boolean(v?.canClaim);
      const statusActive = (v?.status || "").toUpperCase() === "ACTIVE";
      const userUsed =
        String(v?.userVoucherStatus || "").toUpperCase() === "USED";
      const canUse = Boolean(v?.canUse);

      return {
        v,
        remaining,
        stockOk,
        userClaimed,
        canClaim,
        statusActive,
        userUsed,
        canUse,
      };
    });

    withFlags.sort((a, b) => {
      if (a.userClaimed !== b.userClaimed) return a.userClaimed ? 1 : -1;
      if (a.canClaim !== b.canClaim) return a.canClaim ? -1 : 1;
      if (a.stockOk !== b.stockOk) return a.stockOk ? -1 : 1;
      if (a.userUsed !== b.userUsed) return a.userUsed ? 1 : -1;
      const aEnd = a.v?.endDate ? Date.parse(a.v.endDate) : Infinity;
      const bEnd = b.v?.endDate ? Date.parse(b.v.endDate) : Infinity;
      return aEnd - bEnd;
    });

    return withFlags;
  }, [voucherList]);

  // Trạng thái chặn thao tác khi đang nhận mã
  const [claimingCode, setClaimingCode] = useState(null);

  /** Nhận voucher — POST /voucher/claim?voucherCode=&userId= */
  const handleClaim = async (voucherCode) => {
    if (isOwner) return;

    const loadingId = showToast({
      title: "Đang nhận voucher…",
      type: "info",
      duration: 0,
    });
    setClaimingCode(voucherCode);

    const doPostClaim = async (uid) => {
      const qs = `voucherCode=${encodeURIComponent(
        voucherCode
      )}&userId=${encodeURIComponent(uid)}`;
      const url = `${API_CONFIG.baseUrl}/voucher/claim?${qs}`;
      const res = await authFetch(url, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      let data = {};
      try {
        data = await res.json();
      } catch {}
      return { res, data };
    };

    try {
      let uid = (await getFreshUserId(authFetch)).trim();
      if (!uid) {
        hideToast(loadingId);
        setClaimingCode(null);
        showToast({
          title: "Cần đăng nhập",
          text: "Vui lòng đăng nhập để nhận voucher.",
          type: "warning",
        });
        navigate("/login", { state: { from: location.pathname } });
        return;
      }

      let { res, data } = await doPostClaim(uid);

      const msg = String(data?.message || "").toLowerCase();
      const isUserNotFound =
        res.status === 404 ||
        msg.includes("user not found") ||
        msg.includes("không tìm thấy user");
      if (isUserNotFound) {
        uid = (await getFreshUserId(authFetch)).trim();
        ({ res, data } = await doPostClaim(uid));
      }

      if (!res.ok || data?.code !== 200) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      // 🔄 Refresh lại danh sách
      try {
        const listUrl = `${
          API_CONFIG.baseUrl
        }/voucher/seller/${encodeURIComponent(
          effectiveSellerId
        )}?userId=${encodeURIComponent(uid)}`;
        const r2 = await authFetch(listUrl, {
          headers: { Accept: "application/json" },
        });
        const d2 = await r2.json().catch(() => ({}));
        if (r2.ok && d2?.code === 200 && Array.isArray(d2.result)) {
          setVoucherList(d2.result);
        }
      } catch {}

      hideToast(loadingId);
      setClaimingCode(null);
      showToast({
        title: "Đã nhận voucher 🎉",
        text: data?.message || "Áp dụng khi thanh toán để được giảm.",
        type: "success",
        duration: 2200,
      });
    } catch (e) {
      hideToast(loadingId);
      setClaimingCode(null);
      showToast({
        title: "Nhận voucher thất bại",
        text: e?.message || "Vui lòng thử lại sau.",
        type: "error",
        duration: 3000,
      });
    }
  };

  // ===== QuickView helpers =====
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

  const buildCartPayloadFromQuick = async ({ product, size, qty }) => {
    if (!product) throw new Error("Không có thông tin sản phẩm.");

    const sellerId = String(product.sellerId ?? product.seller_id ?? "").trim();
    if (!sellerId) throw new Error("Không xác định được người bán (sellerId).");

    // 🧱 Chặn chủ shop (defensive)
    if (mySellerId && String(mySellerId) === sellerId) {
      throw new Error(
        "Bạn là chủ shop — không được phép mua sản phẩm của chính mình."
      );
    }

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
      userId: userId,
      productId: String(product.id),
      sellerId,
      sellerName,
      productName: product?.name || "",
      productImage: pickImageUrl(product?.images),
      size: String(chosenSize).toUpperCase(),
      unitPrice,
      quantity,
    };

    console.log("[SellerPage QV] cartAdd payload:", payload);
    return payload;
  };

  // ===== Voucher rail handlers (drag/scroll) =====
  const railRef = useRef(null);
  const INTERACTIVE_SEL = 'button, a, input, textarea, select, [role="button"]';

  const scrollByCards = (dir = 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector(".voucher-card");
    const gap = 14;
    const cardW = card ? card.getBoundingClientRect().width : 320;
    rail.scrollBy({ left: dir * (cardW + gap) * 2, behavior: "smooth" });
  };

  let isDown = false,
    startX = 0,
    scrollLeft = 0,
    didMove = false;
  const onPointerDown = (e) => {
    if (!railRef.current) return;
    if (e.target.closest(INTERACTIVE_SEL)) return;
    if (e.button !== 0) return;

    isDown = true;
    didMove = false;
    railRef.current.classList.add("is-dragging");
    startX = e.pageX || e.clientX;
    scrollLeft = railRef.current.scrollLeft;
  };
  const onPointerMove = (e) => {
    if (!isDown || !railRef.current) return;
    const x = e.pageX || e.clientX;
    const dx = x - startX;

    if (!didMove && Math.abs(dx) < 3) return;

    if (!didMove) {
      didMove = true;
      railRef.current.setPointerCapture?.(e.pointerId);
    }
    railRef.current.scrollLeft = scrollLeft - dx * 1.1;
  };
  const onPointerUp = (e) => {
    if (!railRef.current) return;
    isDown = false;
    railRef.current.classList.remove("is-dragging");
    if (didMove) {
      railRef.current.releasePointerCapture?.(e.pointerId);
    }
  };

  // ===== Handlers mở QuickView có chặn chủ shop =====
  const openQuickView = (p) => {
    const sellerId = String(p?.sellerId ?? p?.seller_id ?? "");
    if (mySellerId && String(mySellerId) === sellerId) {
      showToast({
        title: "Không thể mua",
        text: "Bạn là chủ shop — không được phép mua sản phẩm của chính mình.",
        type: "warning",
      });
      return;
    }
    setQuickItem(p);
    setOpenQuick(true);
  };
  const closeQuickView = () => setOpenQuick(false);

  // ===== Render =====
  return (
    <div className="seller-page">
      {/* ===== Hero ===== */}
      <div className="seller-hero">
        <div className="seller-cover">
          <div className="seller-name-line" title={seller?.name || "Shop"}>
            <span className="seller-name-pill">{seller?.name || "Shop"}</span>
          </div>
        </div>

        <div className="seller-top">
          <img
            className="seller-avatar"
            src={seller?.avatar || "/img/default-shop.png"}
            alt={seller?.name || "Shop"}
          />
        </div>
        <div className="seller-stats">
          <div className="stat">
            <div className="label">Sản phẩm</div>
            <div className="value">
              {loadingProducts ? "…" : products.length}
            </div>
          </div>
          <div className="stat">
            <div className="label">Người theo dõi</div>
            <div className="value">{seller?.followers}</div>
          </div>
          <div className="stat">
            <div className="label">Đánh giá</div>
            <div className="value">{seller?.rating}</div>
          </div>
          <div className="stat">
            <div className="label">Tỉ lệ phản hồi chat</div>
            <div className="value">{seller?.responseRate}</div>
          </div>
          <div className="stat">
            <div className="label">Tỉ lệ huỷ đơn</div>
            <div className="value">{seller?.cancelRate}</div>
          </div>
          <div className="stat">
            <div className="label">Tham gia</div>
            <div className="value">{seller?.joined}</div>
          </div>
        </div>
      </div>

      {/* ===== Voucher ===== */}
      <div
        className="seller-vouchers"
        style={{ maxWidth: 1200, margin: "16px auto" }}
      >
        <div className="voucher-head">
          <div className="voucher-title">Voucher của shop</div>
          <div className="voucher-note">
            {voucherLoading
              ? "Đang tải voucher…"
              : isOwner
              ? "Bạn là chủ shop — không thể thao tác trên voucher của mình"
              : "Vuốt / kéo hoặc bấm nút để xem thêm"}
          </div>
        </div>

        {voucherErr && (
          <div className="vm-info-box error" style={{ marginTop: 8 }}>
            ⚠️ {voucherErr}
          </div>
        )}

        <div className="voucher-rail-wrap">
          <button
            type="button"
            className="vc-nav vc-nav--prev"
            aria-label="Xem trước"
            onClick={() => scrollByCards(-1)}
          >
            ‹
          </button>

          <div
            className="voucher-rail"
            ref={railRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {voucherLoading ? (
              [...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="voucher-card shimmer"
                  style={{ height: 96 }}
                />
              ))
            ) : displayVouchers.length === 0 ? (
              <div className="sp-empty" style={{ padding: 12 }}>
                Hiện không có voucher đang diễn ra.
              </div>
            ) : (
              displayVouchers.map(
                ({
                  v,
                  remaining,
                  stockOk,
                  userClaimed,
                  canClaim,
                  canUse,
                  userUsed,
                }) => {
                  const statusActive =
                    (v?.status || "").toUpperCase() === "ACTIVE";
                  const canClaimFinal = Boolean(
                    canClaim && statusActive && stockOk && !isOwner
                  );

                  // 🎯 Logic hiển thị nút
                  const btnText = isOwner
                    ? "Bạn là chủ shop"
                    : userClaimed
                    ? userUsed
                      ? "Đã sử dụng"
                      : canUse
                      ? "Đã nhận"
                      : v?.message || "Đã nhận"
                    : canClaimFinal
                    ? claimingCode === v.code
                      ? "Đang nhận…"
                      : "Nhận ngay"
                    : !stockOk
                    ? "Hết lượt"
                    : v?.message || "Không khả dụng";

                  const disabled =
                    isOwner || !canClaimFinal || claimingCode === v.code;

                  return (
                    <div
                      key={v.id || v.code}
                      className={`voucher-card ${
                        userClaimed ? "is-claimed" : ""
                      } ${userUsed ? "is-used" : ""} ${
                        !stockOk ? "is-soldout" : ""
                      } ${claimingCode === v.code ? "is-blocking" : ""}`}
                      title={
                        isOwner
                          ? "Bạn là chủ shop — không thể nhận voucher này"
                          : v?.message || ""
                      }
                    >
                      {claimingCode === v.code && (
                        <div className="vc-block-overlay">
                          <div className="vc-spinner" />
                        </div>
                      )}

                      <div className="vc-badge">
                        <div style={{ fontWeight: 700 }}>
                          {describeVoucher(v)}
                        </div>
                      </div>
                      <i className="vc-perf" aria-hidden="true" />
                      <div className="vc-main">
                        <div className="vc-off">{v.name || v.code}</div>
                        <div className="vc-min">
                          Đơn tối thiểu: {fmtVND(v.minOrderAmount)}đ • Hiệu lực:{" "}
                          {v?.startDate
                            ? new Date(v.startDate).toLocaleDateString("vi-VN")
                            : "?"}{" "}
                          —{" "}
                          {v?.endDate
                            ? new Date(v.endDate).toLocaleDateString("vi-VN")
                            : "?"}
                        </div>
                        <div className="vc-exp">
                          Mã: {v.code}
                          {typeof remaining === "number"
                            ? ` • Còn: ${remaining}`
                            : ""}
                        </div>
                      </div>
                      <div className="vc-actions">
                        <button
                          className={`vc-btn ${
                            canClaimFinal && !disabled
                              ? "is-claim"
                              : userClaimed
                              ? userUsed
                                ? "is-used"
                                : "is-claimed"
                              : ""
                          } ${claimingCode === v.code ? "is-loading" : ""}`}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => canClaimFinal && handleClaim(v.code)}
                          disabled={disabled}
                          aria-busy={claimingCode === v.code ? "true" : "false"}
                          aria-live="polite"
                        >
                          {claimingCode === v.code && (
                            <span className="vc-btn-spinner" aria-hidden />
                          )}
                          <span className="vc-btn-label">
                            {isOwner
                              ? "Chủ shop"
                              : userClaimed
                              ? userUsed
                                ? "Đã sử dụng"
                                : canUse
                                ? "Đã nhận"
                                : v?.message || "Đã nhận"
                              : canClaimFinal
                              ? "Nhận ngay"
                              : !stockOk
                              ? "Hết lượt"
                              : v?.message || "Không khả dụng"}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                }
              )
            )}
          </div>

          <button
            type="button"
            className="vc-nav vc-nav--next"
            aria-label="Xem tiếp"
            onClick={() => scrollByCards(1)}
          >
            ›
          </button>

          <div className="voucher-rail-fade voucher-rail-fade--left" />
          <div className="voucher-rail-fade voucher-rail-fade--right" />
        </div>
      </div>

      {/* Lỗi seller */}
      {!loadingSeller && sellerErr && (
        <div style={{ maxWidth: 1200, margin: "8px auto", color: "#b00" }}>
          {sellerErr}
        </div>
      )}

      {/* ===== Product list ===== */}
      <div className="seller-products">
        <div className="seller-products-head">
          <div className="seller-products-title">
            Tất cả sản phẩm {headCount}
          </div>
          {!loadingProducts && (
            <div className="seller-products-count">
              Hiển thị {products.length} sản phẩm
            </div>
          )}
        </div>

        {loadingProducts ? (
          <div className="sp-list">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="sp-card">
                <div
                  className="shimmer"
                  style={{ height: 210, borderRadius: 10 }}
                />
                <div
                  className="shimmer"
                  style={{ height: 18, marginTop: 12 }}
                />
                <div
                  className="shimmer"
                  style={{ height: 18, marginTop: 8, width: "70%" }}
                />
                <div
                  className="shimmer"
                  style={{ height: 14, marginTop: "auto", width: "40%" }}
                />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="sp-empty">Shop chưa có sản phẩm.</div>
        ) : (
          <div className="sp-list">
            {products.map((p) => {
              const { price, compare } = getCardPrice(p);
              const sellerIdOfProduct = String(
                p?.sellerId ?? p?.seller_id ?? ""
              );

              const onCardPrimary = (e) => {
                e.stopPropagation();
                if (mySellerId && String(mySellerId) === sellerIdOfProduct) {
                  showToast({
                    title: "Không thể mua",
                    text: "Bạn là chủ shop — không được phép mua sản phẩm của chính mình.",
                    type: "warning",
                  });
                  return;
                }
                openQuickView(p);
              };

              return (
                <div
                  key={p.id}
                  className="product-card"
                  data-pid={p.id}
                  onClick={() => navigate(`/products/${p.id}`)}
                  title={p.name}
                >
                  <img src={pickImageUrl(p.images)} alt={p.name} />
                  <h3>{p.name}</h3>

                  <div className="price-line">
                    <span className="price">
                      {price != null ? fmtVND(price) : "-"}₫
                    </span>
                    {compare != null && (
                      <span className="compare">{fmtVND(compare)}₫</span>
                    )}
                  </div>

                  <div className="card-actions">
                    <button className="pbtn primary" onClick={onCardPrimary}>
                      Mua ngay
                    </button>
                    <button className="pbtn outline" onClick={onCardPrimary}>
                      Thêm vào giỏ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick View modal */}
      <ProductQuickView
        product={quickItem}
        isOpen={openQuick}
        onClose={closeQuickView}
        currentSellerId={mySellerId} // 🆕 truyền xuống để QuickView tự chặn
        onAddToCart={async ({ product, size, qty }) => {
          try {
            // Chặn chủ shop (defensive)
            const sellerId = String(
              product?.sellerId ?? product?.seller_id ?? ""
            );
            if (mySellerId && String(mySellerId) === sellerId) {
              showToast({
                title: "Không thể thêm",
                text: "Bạn là chủ shop — không được phép mua sản phẩm của chính mình.",
                type: "warning",
              });
              return;
            }

            const uid =
              userId || (await resolveUserId({ authFetch, location })).trim();
            if (!uid) {
              showToast({
                title: "Cần đăng nhập",
                text: "Vui lòng đăng nhập để thêm vào giỏ.",
                type: "warning",
              });
              navigate("/login", { state: { from: location.pathname } });
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
              console.error("[SellerPage QV] cartAdd failed:", {
                status: res.status,
                data,
              });
              throw new Error(data?.message || `HTTP ${res.status}`);
            }
            showToast({
              title: "Đã thêm vào giỏ hàng",
              type: "success",
              duration: 1800,
            });
            closeQuickView();
          } catch (err) {
            console.error("SellerPage quick add-to-cart error:", err);
            showToast({
              title: "Thêm vào giỏ thất bại",
              text: err.message || "Vui lòng thử lại.",
              type: "error",
            });
          }
        }}
        onBuyNow={async ({ product, size, qty }) => {
          try {
            // Chặn chủ shop (defensive)
            const sellerId = String(
              product?.sellerId ?? product?.seller_id ?? ""
            );
            if (mySellerId && String(mySellerId) === sellerId) {
              showToast({
                title: "Không thể mua",
                text: "Bạn là chủ shop — không được phép mua sản phẩm của chính mình.",
                type: "warning",
              });
              return;
            }

            const uid =
              userId || (await resolveUserId({ authFetch, location })).trim();
            if (!uid) {
              showToast({
                title: "Cần đăng nhập",
                text: "Vui lòng đăng nhập để mua ngay.",
                type: "warning",
              });
              navigate("/login", { state: { from: location.pathname } });
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
              console.error("[SellerPage QV] buy-now failed:", {
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
            navigate("/cart", { state: { from: "buy_now", userId: uid } });
          } catch (err) {
            console.error("SellerPage quick buy-now error:", err);
            showToast({
              title: "Không thể mua ngay",
              text: err.message || "Vui lòng thử lại.",
              type: "error",
            });
          }
        }}
      />
    </div>
  );
}
