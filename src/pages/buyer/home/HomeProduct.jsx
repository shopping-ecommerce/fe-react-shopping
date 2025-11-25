import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../../../contexts/AuthContext";
import { API_CONFIG, apiUrl, trackAddToCart } from "../../../config/api";
import "../../../styles/home.css";
import ProductQuickView from "./ProductQuickView";
import { showToast } from "../../../utils/toast";
import {
  getMyProfile,
  addFavorite,
  removeFavorite,
  pickImageUrl,
} from "../../../services/favorites";
import {
  fetchProducts,
  fetchBestSellingProducts, // ⬅️ NEW
} from "../../../services/products"; // ⬅️ update import

// 👉 Driver.js tour
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

import { trackProductView } from "../../../config/api";

import PersonalRecommendations from "./PersonalRecommendations";

const CATEGORY_TRANSLATIONS = {
  Electronics: "Điện tử",
  Fashion: "Thời trang",
  Books: "Sách",
  Home: "Nhà cửa",
  Sports: "Thể thao",
  Beauty: "Làm đẹp",
  Toys: "Đồ chơi",
  Automotive: "Ô tô - Xe máy",
  Health: "Sức khỏe",
  Grocery: "Tạp hóa",
  SecondHand: "Đồ cũ",
  All: "Tất cả",
};

const CATEGORY_ICONS = {
  Electronics: "/img/icon-sidebar/man-hinh-may-tinh-5-800x450-1.jpg",
  Fashion:
    "/img/icon-sidebar/lovepik-fashion-womens-summer-shopping-image-picture_500961857.jpg",
  Books: "/img/icon-sidebar/images.jpeg",
  Home: "/img/icon-sidebar/anh-mo-ta.jpeg",
  Sports: "/img/icon-sidebar/hinh-nen-bong-da-49.jpg",
  Beauty: "/img/icon-sidebar/lam-dep.jpg",
  Toys: "/img/icon-sidebar/do_choi.jpg",
  Automotive: "/img/icon-sidebar/oto-xemay.jpg",
  Health: "/img/icon-sidebar/suc-khoe1.jpg",
  Grocery: "/img/icon-sidebar/tap-hoa.jpeg",
  SecondHand: "/img/icon-sidebar/do-cu.jpeg",
  All: "/img/icon-sidebar/all.jpg",
};

/* =========================
   Helpers ảnh & giá (API mới)
   ========================= */
// Ưu tiên ảnh từ mediaByOption.image nếu là URL; rơi về images[].url có position nhỏ nhất
const pickCover = (p) => {
  const m = Array.isArray(p?.mediaByOption)
    ? p.mediaByOption.find(
        (x) => typeof x?.image === "string" && /^https?:\/\//i.test(x.image)
      )
    : null;
  if (m?.image) return m.image;

  const first =
    Array.isArray(p?.images) && p.images.length > 0
      ? [...p.images].sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))[0]
          ?.url
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

function Home() {
  const navigate = useNavigate();

  const navigateToEvents = () => {
    navigate("/events");
  };

  const location = useLocation();
  const { authFetch } = useContext(AuthContext);

  // read filters from URL
  const searchParams = new URLSearchParams(location.search);
  const categoryId = searchParams.get("categoryId") || "";
  const categoryName = searchParams.get("name") || "";

  // current user's sellerId (block owner actions)
  const [currentSellerId, setCurrentSellerId] = useState(null);

  // remember scroll/card on leaving detail
  const rememberBrowseState = (productId) => {
    try {
      sessionStorage.setItem(
        "lastProductBrowse",
        JSON.stringify({
          url:
            location.pathname + (location.search || "") + (location.hash || ""),
          scrollY: window.scrollY,
          pid: productId,
          ts: Date.now(),
        })
      );
    } catch {}
  };

  // Lắng nghe yêu cầu chạy tour từ FloatingAssistant
  useEffect(() => {
    const handler = () => runHomeTour();
    window.addEventListener("RUN_HOME_TOUR", handler);
    // optional: expose global fallback
    window.__runHomeTour = runHomeTour;
    return () => {
      window.removeEventListener("RUN_HOME_TOUR", handler);
      try {
        delete window.__runHomeTour;
      } catch {}
    };
  }, []);

  useEffect(() => {
    const needRestore = sessionStorage.getItem("restoreOnList") === "1";
    if (!needRestore) return;
    sessionStorage.removeItem("restoreOnList");
    try {
      const raw = sessionStorage.getItem("lastProductBrowse");
      if (!raw) return;
      const last = JSON.parse(raw);
      setTimeout(() => {
        if (last?.pid) {
          const card = document.querySelector(`[data-pid="${last.pid}"]`);
          if (card) {
            const y = card.getBoundingClientRect().top + window.scrollY - 120;
            window.scrollTo({ top: Math.max(0, y), behavior: "instant" });
            card.classList.add("card-restore-blink");
            setTimeout(() => card.classList.remove("card-restore-blink"), 1200);
            return;
          }
        }
        if (typeof last?.scrollY === "number") {
          window.scrollTo({ top: last.scrollY, behavior: "instant" });
        }
      }, 0);
    } catch {}
  }, []);

  // cache sellerName
  const [sellerNameMap, setSellerNameMap] = useState({});
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

  // banner slider
  const [currentSlide, setCurrentSlide] = useState(0);
  const slideInterval = useRef();
  const totalSlides = 3;
  const slides = [
    { left: "/img/cartBaner1.jpg", right: "/img/cartBaner2.png" },
    { left: "/img/cartbaner3.png", right: "/img/cartbaner4.png" },
    { left: "/img/cartbaner5.png", right: "/img/cartbaner6.png" },
  ];

  // categories
  const [categories, setCategories] = useState([]);

  // products
  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // best-selling
  const [bestSellers, setBestSellers] = useState([]);
  const [loadingBest, setLoadingBest] = useState(false);
  // best-selling pagination
  const [bestPage, setBestPage] = useState(0);
  const bestPerPage = 5;
  const bestTotalPages = Math.ceil(bestSellers.length / bestPerPage);
  const currentBestItems = bestSellers.slice(
    bestPage * bestPerPage,
    (bestPage + 1) * bestPerPage
  );
  useEffect(() => setBestPage(0), [bestSellers]);

  // user + favorites
  const [userId, setUserId] = useState(null);
  const [userReady, setUserReady] = useState(false);
  const [favorites, setFavorites] = useState(() => new Set());
  const [favInflight, setFavInflight] = useState(() => new Set());

  // QuickView
  const [openQuick, setOpenQuick] = useState(false);
  const [quickItem, setQuickItem] = useState(null);

  const openQuickView = (p) => {
    const sellerId = String(p?.sellerId ?? p?.seller_id ?? "");
    if (currentSellerId && String(currentSellerId) === sellerId) {
      showToast({
        title: "Không thể thực hiện",
        text: "Bạn là chủ shop — không được phép mua sản phẩm của chính mình.",
        type: "warning",
      });
      return;
    }
    setQuickItem(p);
    setOpenQuick(true);
  };
  const closeQuickView = () => setOpenQuick(false);

  // get current sellerId of user
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const my = await getMyProfile(authFetch).catch(() => null);
        const uid = my?.id;
        if (!cancelled) {
          if (uid) setUserId(uid);
          setUserReady(true);
        }
        if (!uid) return;

        const resp = await authFetch(
          apiUrl(API_CONFIG.endpoints.searchSellerByUserId(uid)),
          { method: "GET", headers: { Accept: "application/json" } }
        );
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data?.message || `HTTP ${resp.status}`);
        const sid = data?.result?.id || data?.result?.sellerId || null;
        if (!cancelled) setCurrentSellerId(sid);
      } catch (e) {
        if (!cancelled) {
          setCurrentSellerId(null);
          setUserReady((r) => r || true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // build cart payload
  const buildCartPayloadFromQuick = async ({ product, size, qty }) => {
    if (!product) return { error: "NO_PRODUCT" };

    const sellerId = String(product.sellerId ?? product.seller_id ?? "").trim();
    if (!sellerId) return { error: "NO_SELLER" };

    if (currentSellerId && String(currentSellerId) === sellerId) {
      return { error: "OWNER" };
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
      return { error: "BAD_PRICE" };
    }

    const quantity = Math.max(1, parseInt(qty, 10) || 1);
    const sellerName = await ensureSellerName(product);

    const payload = {
      userId,
      productId: String(product.id),
      sellerId,
      sellerName,
      productName: product?.name || "",
      productImage: pickImageUrl(product?.images),
      size: String(chosenSize).toUpperCase(),
      unitPrice,
      quantity,
    };
    return { payload };
  };

  // load categories
  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(apiUrl(API_CONFIG.endpoints.categories), {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const data = await res.json();
        setCategories(data.result || []);
      } catch (err) {
        console.error("❌ Lỗi load categories:", err);
      }
    })();
  }, [authFetch]);

  // load all products (promo) -> dùng fetchProducts (API mới)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchProducts(authFetch);
        if (!cancelled) setAllProducts(list);
      } catch (err) {
        console.error("❌ Error loading all products:", err);
        if (!cancelled) setAllProducts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // load best-selling products
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingBest(true);
      try {
        const list = await fetchBestSellingProducts(authFetch);
        if (!cancelled) setBestSellers(list);
      } catch (err) {
        console.error("❌ Error loading best sellers:", err);
        if (!cancelled) setBestSellers([]);
      } finally {
        if (!cancelled) setLoadingBest(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // load filtered products (grid)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingProducts(true);
      try {
        let list = [];
        if (categoryId && categoryId.trim()) {
          const url = apiUrl(API_CONFIG.endpoints.searchByCategory(categoryId));
          const res = await authFetch(url, {
            method: "GET",
            headers: { Accept: "application/json" },
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
          list = Array.isArray(data?.result) ? data.result : [];
        } else {
          list = await fetchProducts(authFetch); // ⬅️ dùng API mới
        }
        if (!cancelled) setFilteredProducts(list);
      } catch (err) {
        console.error("❌ Error loading filtered products:", err);
        if (!cancelled) setFilteredProducts([]);
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, location.search]);

  // load profile favorites
  useEffect(() => {
    (async () => {
      try {
        const pf = await getMyProfile(authFetch);
        if (pf?.id) setUserId(pf.id);
        const favs = Array.isArray(pf?.favorite_products)
          ? pf.favorite_products
          : [];
        setFavorites(new Set(favs));
        setUserReady(true);
      } catch (e) {
        if (e?.status === 401 || e?.status === 403) {
          setUserId(null);
          setFavorites(new Set());
          setUserReady(false);
        } else {
          console.error("❌ Lỗi load profile:", e);
          setUserId(null);
          setFavorites(new Set());
          setUserReady(false);
        }
      }
    })();
  }, [authFetch]);

  // promo pagination
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(allProducts.length / itemsPerPage);
  const currentPromoItems = allProducts.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );
  useEffect(() => setCurrentPage(0), [allProducts]);

  // slider autoplay
  const startSlide = () => {
    stopSlide();
    slideInterval.current = setInterval(
      () => setCurrentSlide((prev) => (prev + 1) % totalSlides),
      4000
    );
  };
  const stopSlide = () => {
    if (slideInterval.current) clearInterval(slideInterval.current);
  };
  useEffect(() => {
    startSlide();
    return () => stopSlide();
  }, []);
  const goToSlide = (i) => setCurrentSlide(i);
  const translateValue = -(currentSlide * (100 / totalSlides));

  // fire-and-forget tăng view (không chặn UI)
  const incProductView = (pid) => {
    try {
      authFetch(apiUrl(API_CONFIG.endpoints.productView(pid)), {
        method: "GET", // theo curl bạn đưa
        headers: { Accept: "application/json" },
      }).catch(() => {});
    } catch {}
  };

  const openDetail = (p) => {
    // 1) tăng view BE (mỗi lần bấm = 1 view)
    incProductView(p.id);

    // 2) track sự kiện xem sản phẩm (hệ thống gợi ý/analytics của bạn)
    trackProductView(userId, p.id);

    // 3) nhớ vị trí duyệt & điều hướng
    rememberBrowseState(p.id);
    navigate(`/products/${p.id}`);
  };

  // toggle favorite
  const onClickFavorite = async (product, ev) => {
    if (!userReady || !userId) {
      showToast({
        title: "Cần đăng nhập",
        text: "Vui lòng đăng nhập để sử dụng Yêu thích.",
        type: "warning",
      });
      navigate("/login");
      return;
    }

    const sellerId = String(product?.sellerId ?? product?.seller_id ?? "");
    if (currentSellerId && String(currentSellerId) === sellerId) {
      showToast({
        title: "Không thể yêu thích",
        text: "Bạn là chủ shop — không thể yêu thích sản phẩm của chính mình.",
        type: "warning",
      });
      return;
    }

    const productId = product.id;
    const currentlyFav = favorites.has(productId);

    // optimistic
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

      // sync from server
      setFavorites(new Set(favs));

      // toast + heart fly
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
        if (ev && ev.currentTarget) {
          const card = ev.currentTarget.closest(".product-card");
          if (card) {
            const fly = document.createElement("div");
            fly.className = "fv-fly";
            fly.innerHTML = "❤";
            const btnRect = ev.currentTarget.getBoundingClientRect();
            const cardRect = card.getBoundingClientRect();
            fly.style.left = `${
              btnRect.left - cardRect.left + btnRect.width / 2
            }px`;
            fly.style.top = `${
              btnRect.top - cardRect.top + btnRect.height / 2
            }px`;
            card.appendChild(fly);
            setTimeout(() => fly.remove(), 900);
          }
        }
      }
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        showToast({
          title: "Phiên đăng nhập hết hạn",
          text: "Vui lòng đăng nhập lại để tiếp tục.",
          type: "warning",
        });
        setUserId(null);
        setFavorites(new Set());
        setUserReady(false);
        navigate("/login");
        return;
      }

      console.error("❌ Toggle favorite failed:", err);
      // revert optimistic
      setFavorites((prev) => {
        const next = new Set(prev);
        if (currentlyFav) next.add(productId);
        else next.delete(productId);
        return next;
      });
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

  // scroll to category section on change
  const topRef = useRef(null);
  useEffect(() => {
    if (!loadingProducts && categoryId) {
      requestAnimationFrame(() => {
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => {
          if (!topRef.current) {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }, 150);
      });
    }
  }, [loadingProducts, categoryId]);

  // ===== TOUR across header + sidebar + cards
  const runHomeTour = () => {
    const rawSteps = [
      {
        element: '[data-tour="notif"]',
        popover: {
          title: "Thông báo",
          description: "Xem thông báo hệ thống, tin nhắn & cập nhật đơn hàng.",
          side: "bottom",
          align: "start",
        },
      },
      {
        element: '[data-tour="search"]',
        popover: {
          title: "Tìm kiếm",
          description: "Bấm để mở ô tìm kiếm nhanh cho sản phẩm.",
          side: "bottom",
          align: "start",
        },
      },
      {
        element: '[data-tour="favorites"]',
        popover: {
          title: "Danh sách yêu thích",
          description: "Xem lại các sản phẩm bạn đã thả tim.",
          side: "bottom",
          align: "center",
        },
      },
      {
        element: '[data-tour="cart"]',
        popover: {
          title: "Giỏ hàng",
          description: "Mọi thứ bạn đã thêm sẽ nằm ở đây.",
          side: "bottom",
          align: "center",
        },
      },
      {
        element: '[data-tour="account"]',
        popover: {
          title: "Quản lý tài khoản",
          description: "Thông tin cá nhân, địa chỉ, đơn mua & cài đặt.",
          side: "bottom",
          align: "end",
        },
      },
      {
        element: '[data-tour="sidebar-category"]',
        popover: {
          title: "Danh mục",
          description: "Nhấn 1 danh mục để lọc sản phẩm.",
          side: "right",
          align: "start",
        },
      },
      {
        element: '[data-tour="card-fav"]',
        popover: {
          title: "Thêm vào yêu thích",
          description: "Nhấn tim để lưu sản phẩm.",
          side: "top",
          align: "end",
        },
      },
      {
        element: '[data-tour="card-buy"]',
        popover: {
          title: "Mua ngay",
          description: "Mở nhanh chọn size/số lượng và đặt mua.",
          side: "top",
          align: "center",
        },
      },
      {
        element: '[data-tour="card-add"]',
        popover: {
          title: "Thêm vào giỏ",
          description: "Thêm vào giỏ để thanh toán sau.",
          side: "top",
          align: "start",
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

    if (!steps.length) {
      const d = driver({ allowClose: true, opacity: 0.45, stagePadding: 8 });
      d.highlight({
        popover: {
          title: "Hướng dẫn nhanh",
          description:
            "Trên cùng: tìm kiếm, yêu thích, giỏ hàng, tài khoản. Trái: danh mục. Thẻ sản phẩm: tim, mua ngay, thêm giỏ.",
          side: "center",
        },
      });
      return;
    }

    const drv = driver({
      allowClose: true,
      animate: true,
      opacity: 0.45,
      stagePadding: 8,
    });

    drv.setSteps(steps);
    drv.drive();
  };

  return (
    <div className="home-wrapper">
      <div className="home-container">
        {/* Banner slider */}
        <div
          className="banner-slider"
          onMouseEnter={stopSlide}
          onMouseLeave={startSlide}
        >
          <div
            className="banner-section"
            style={{ transform: `translateX(${translateValue}%)` }}
          >
            {slides.map((slide, index) => (
              <div
                key={index}
                className="banner-slide"
                onClick={navigateToEvents}
                style={{ cursor: "pointer" }}
              >
                <div className="banner-content">
                  <div className="banner-left">
                    <img src={slide.left} alt="Banner Left" />
                  </div>
                  <div className="banner-right">
                    <img src={slide.right} alt="Banner Right" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            className="prev-slide"
            onClick={() =>
              goToSlide((currentSlide - 1 + totalSlides) % totalSlides)
            }
          >
            &lt;
          </button>
          <button
            className="next-slide"
            onClick={() => goToSlide((currentSlide + 1) % totalSlides)}
          >
            &gt;
          </button>
          <div className="slider-dots">
            {slides.map((_, index) => (
              <span
                key={index}
                className={`slider-dot ${
                  currentSlide === index ? "active" : ""
                }`}
                onClick={() => goToSlide(index)}
              />
            ))}
          </div>
        </div>

        {/* Navigation categories */}
        <div className="nav-container">
          <button
            className="nav-arrow left"
            onClick={() =>
              document
                .querySelector(".nav-section")
                ?.scrollBy({ left: -200, behavior: "smooth" })
            }
          >
            &lt;
          </button>

          <div className="nav-section">
            {categories.map((cat) => {
              const viName = CATEGORY_TRANSLATIONS[cat.name] || cat.name;
              const iconPath = CATEGORY_ICONS[cat.name] || "/img/default.png";
              const isActive = categoryId === cat.id;

              const goCategory = () => {
                navigate(
                  `/?categoryId=${encodeURIComponent(
                    cat.id
                  )}&name=${encodeURIComponent(cat.name)}`
                );
                window.scrollTo({ top: 0, behavior: "smooth" });
              };

              return (
                <div
                  key={cat.id}
                  className={`nav-item ${isActive ? "active" : ""}`}
                  onClick={goCategory}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && goCategory()}
                >
                  <img src={iconPath} alt={viName} />
                  <span>{viName}</span>
                </div>
              );
            })}
          </div>

          <button
            className="nav-arrow right"
            onClick={() =>
              document
                .querySelector(".nav-section")
                ?.scrollBy({ left: 200, behavior: "smooth" })
            }
          >
            &gt;
          </button>
        </div>

        {/* Filter banner */}
        <div ref={topRef} />
        {categoryId && (
          <div
            className="section-card bw filter-banner"
            style={{ marginTop: 16 }}
          >
            <div>
              <strong>🏷️ Đang lọc theo danh mục:</strong>{" "}
              <span style={{ fontWeight: 700 }}>
                {CATEGORY_TRANSLATIONS[categoryName] ||
                  categoryName ||
                  "Không xác định"}
              </span>
              {filteredProducts.length > 0 && (
                <span style={{ marginLeft: 8, color: "#555" }}>
                  ({filteredProducts.length} sản phẩm)
                </span>
              )}
            </div>
            <button
              className="pbtn outline"
              onClick={() => {
                navigate("/");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              style={{ minWidth: "auto" }}
            >
              ✕ Xoá lọc
            </button>
          </div>
        )}

        {/* Promo section */}
        <div className="section-card promo-section">
          <div className="promo-header">
            <h2 className="promo-title">Tìm kiếm hàng đầu</h2>
            <a href="#" className="promo-see-all">
              Xem tất cả &gt;
            </a>
          </div>
          <hr className="promo-divider" />

          <div className="promo-items">
            {currentPromoItems.map((p) => (
              <div
                key={p.id}
                className="promo-item"
                data-pid={p.id}
                onClick={() => openDetail(p)}
              >
                <img src={pickCover(p)} alt={p.name} />
                <span className="promo-item-title" title={p.name}>
                  {p.name}
                </span>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <>
              <button
                className="promo-prev"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                style={{ visibility: currentPage === 0 ? "hidden" : "visible" }}
              >
                &lt;
              </button>
              <button
                className="promo-next"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                }
                style={{
                  visibility:
                    currentPage === totalPages - 1 ? "hidden" : "visible",
                }}
              >
                &gt;
              </button>
            </>
          )}
        </div>

        {/* Best-selling section */}
        {/* Best-selling section */}
        <div className="section-card promo-section bestsell-section">
          <div className="promo-header">
            <h2 className="promo-title">Sản phẩm bán chạy</h2>
          </div>
          <hr className="promo-divider" />

          {loadingBest ? (
            <div style={{ padding: 16, textAlign: "center" }}>🔄 Đang tải…</div>
          ) : currentBestItems.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: "#666" }}>
              📭 Chưa có dữ liệu bán chạy
            </div>
          ) : (
            <>
              <div className="promo-items">
                {currentBestItems.map((p) => {
                  const { price, compare } = priceFromVariants(p.variants);
                  return (
                    <div
                      key={p.id}
                      className="promo-item"
                      data-pid={p.id}
                      onClick={() => openDetail(p)}
                    >
                      <img src={pickCover(p)} alt={p.name} />
                      <span className="promo-item-title" title={p.name}>
                        {p.name}
                      </span>
                    </div>
                  );
                })}
              </div>

              {bestTotalPages > 1 && (
                <>
                  <button
                    className="promo-prev"
                    onClick={() => setBestPage((p) => Math.max(0, p - 1))}
                    style={{
                      visibility: bestPage === 0 ? "hidden" : "visible",
                    }}
                  >
                    &lt;
                  </button>
                  <button
                    className="promo-next"
                    onClick={() =>
                      setBestPage((p) => Math.min(bestTotalPages - 1, p + 1))
                    }
                    style={{
                      visibility:
                        bestPage === bestTotalPages - 1 ? "hidden" : "visible",
                    }}
                  >
                    &gt;
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Product grid */}
        <div className="section-card product-grid">
          <h2 className="product-title">
            {categoryId
              ? `Sản phẩm ${
                  CATEGORY_TRANSLATIONS[categoryName] || categoryName
                }`
              : "Sản phẩm mới"}
          </h2>
          <div className="product-list">
            {loadingProducts ? (
              <div style={{ padding: 16, textAlign: "center" }}>
                <div>🔄 Đang tải sản phẩm…</div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: "#666" }}>
                {categoryId ? (
                  <div>
                    <div style={{ fontSize: 18, marginBottom: 8 }}>
                      📭 Không có sản phẩm nào
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      Không tìm thấy sản phẩm nào trong danh mục "
                      {CATEGORY_TRANSLATIONS[categoryName] || categoryName}"
                    </div>
                    <button
                      className="pbtn primary"
                      onClick={() => {
                        navigate("/");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      🏠 Về trang chủ
                    </button>
                  </div>
                ) : (
                  <div>📭 Chưa có sản phẩm nào</div>
                )}
              </div>
            ) : (
              filteredProducts.map((p) => {
                // === Lấy giá từ variants (fallback sizes) ===
                const { price: vPrice, compare: vCompare } = priceFromVariants(
                  p.variants
                );
                const sPrice = p?.sizes?.[0]?.price;
                const sCompare = p?.sizes?.[0]?.compareAtPrice;
                const price = Number.isFinite(vPrice) ? vPrice : sPrice;
                const compare = Number.isFinite(vCompare) ? vCompare : sCompare;

                const isFav = userReady && userId ? favorites.has(p.id) : false;

                const onPrimaryClick = (e) => {
                  e.stopPropagation();
                  const sellerId = String(p?.sellerId ?? p?.seller_id ?? "");
                  if (currentSellerId && String(currentSellerId) === sellerId) {
                    showToast({
                      title: "Không thể thực hiện",
                      text: "Bạn là chủ shop — không được phép mua sản phẩm của chính mình.",
                      type: "warning",
                    });
                    return;
                  }
                  openQuickView(p);
                };

                const isOwnerProduct =
                  currentSellerId &&
                  String(currentSellerId) ===
                    String(p?.sellerId ?? p?.seller_id ?? "");

                return (
                  <div
                    key={p.id}
                    className={`product-card ${
                      !(userReady && userId) ? "hide-fav" : ""
                    }`}
                    data-pid={p.id}
                    onClick={() => openDetail(p)}
                  >
                    {userReady && userId && (
                      <button
                        className={`fv-btn ${isFav ? "is-active" : ""} ${
                          isOwnerProduct ? "is-owner" : ""
                        }`}
                        disabled={favInflight.has(p.id) || isOwnerProduct}
                        onClick={(e) => {
                          e.stopPropagation();
                          onClickFavorite(p, e);
                        }}
                        aria-label="Yêu thích"
                        title={
                          isOwnerProduct
                            ? "Bạn là chủ shop — không thể yêu thích sản phẩm của mình."
                            : isFav
                            ? "Bỏ yêu thích"
                            : "Thêm vào yêu thích"
                        }
                        data-tour="card-fav"
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

                    <img src={pickCover(p)} alt={p.name} />
                    <h3 title={p.name}>{p.name}</h3>

                    <div className="price-line">
                      <span className="price">
                        {Number.isFinite(Number(price))
                          ? Number(price).toLocaleString()
                          : "-"}
                        ₫
                      </span>
                      {Number.isFinite(Number(compare)) &&
                        Number(compare) > 0 && (
                          <span className="compare">
                            {Number(compare).toLocaleString()}₫
                          </span>
                        )}
                    </div>

                    <div className="card-actions">
                      <button
                        className="pbtn primary"
                        onClick={onPrimaryClick}
                        data-tour="card-buy"
                      >
                        Mua ngay
                      </button>
                      <button
                        className="pbtn outline"
                        onClick={onPrimaryClick}
                        data-tour="card-add"
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
        <PersonalRecommendations
          userId={userId}
          onOpenQuick={openQuickView} // đã có sẵn trong Home
          onOpenDetail={openDetail} // tuỳ chọn
        />
      </div>

      {/* Quick View Modal */}
      <ProductQuickView
        product={quickItem}
        isOpen={openQuick}
        onClose={closeQuickView}
        // ✅ KHÔNG gọi API lần 2, KHÔNG show lỗi nữa
        onAddToCart={() => {
          closeQuickView();
        }}
        onBuyNow={() => {
          closeQuickView();
        }}
      />
    </div>
  );
}

export default Home;
