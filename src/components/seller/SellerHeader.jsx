// src/components/seller/SellerHeader.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCommentDots,
  faBell,
  faChevronDown,
  faUser,
  faRightFromBracket,
  faWallet,
  faHouse,
  faFilePdf,
  faTriangleExclamation,
  faCheck,
  faCircleExclamation,
  faTrashCan,
  faEye,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { API_CONFIG, apiUrl } from "../../config/api";
import {
  initSocket as initRealtime,
  getSocket,
  join,
} from "../../services/realtime";
import {
  // ✅ DÙNG LẠI API USER — chỉ truyền sellerId
  fetchNotificationsByUser,
  fetchUnreadCount,
  markNotificationRead,
  markAllAsRead,
} from "../../services/notificationService";
import "../../styles/SellerHeader.css";

/* ========== Helpers ========== */
const getToken = () =>
  localStorage.getItem("token") || localStorage.getItem("access_token") || "";

/* LocalStorage theo seller (thông báo chat đến seller) */
const STORAGE_KEY = (sid) => `seller_notif_messages_v1_${sid || "guest"}`;
const loadNotifs = (sid) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(sid));
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};
const saveNotifs = (sid, list) => {
  try {
    localStorage.setItem(STORAGE_KEY(sid), JSON.stringify(list || []));
  } catch {}
};

const previewText = (p = {}) => {
  const { message, emoji, files, fileUrls } = p;
  if (message && String(message).trim()) return String(message).trim();
  if (emoji) return `(${emoji})`;
  const f = files || fileUrls;
  if (Array.isArray(f) && f.length) return "[tệp]";
  return "Tin nhắn mới";
};

const formatTime = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const same =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    return same
      ? d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
  } catch {
    return "";
  }
};

async function fetchBuyerMeta(userId, token) {
  if (!userId) return { name: "Khách", avatar: "/img/default-user.png" };
  try {
    const res = await fetch(
      `http://localhost:8888/shopping/api/info/profiles/${encodeURIComponent(
        userId
      )}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token || getToken()}`,
        },
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.code !== 0) throw new Error();
    const r = data.result || {};
    const name = `${r.first_name || ""} ${r.last_name || ""}`.trim() || "Khách";
    const avatar = r.public_id || "/img/default-user.png";
    return { name, avatar };
  } catch {
    return { name: "Khách", avatar: "/img/default-user.png" };
  }
}

/* mini toast – góc trên-phải, ngay dưới header */
let safeToast = (msg) => {
  const ensureContainer = () => {
    const ID = "tk-mini-toast";
    let el = document.getElementById(ID);
    if (!el) {
      el = document.createElement("div");
      el.id = ID;
      el.style.position = "fixed";
      el.style.right = "16px";
      el.style.zIndex = "9999";
      el.style.maxWidth = "420px";
      el.style.pointerEvents = "none";
      document.body.appendChild(el);
    }
    const header =
      document.querySelector(".tk-header.tk-lg") ||
      document.querySelector("header");
    const banner = document.querySelector(".tos-snooze-banner");
    const baseY = header
      ? header.getBoundingClientRect().bottom + (banner ? 8 : 8)
      : 16;
    el.style.top = `${Math.max(8, baseY)}px`;
    return el;
  };

  const host = ensureContainer();
  const item = document.createElement("div");
  item.style.background = "#111827";
  item.style.color = "#fff";
  item.style.padding = "10px 12px";
  item.style.marginTop = "8px";
  item.style.borderRadius = "10px";
  item.style.boxShadow = "0 8px 30px rgba(0,0,0,.22)";
  item.style.fontSize = "14px";
  item.style.pointerEvents = "auto";
  item.style.transition = "transform .2s ease, opacity .2s ease";
  item.style.transform = "translateY(-6px)";
  item.style.opacity = "0";
  item.innerText = msg;

  host.appendChild(item);
  requestAnimationFrame(() => {
    item.style.transform = "translateY(0)";
    item.style.opacity = "1";
  });

  setTimeout(() => {
    item.style.transform = "translateY(-6px)";
    item.style.opacity = "0";
    setTimeout(() => {
      try {
        host.removeChild(item);
      } catch {}
    }, 200);
  }, 3200);
  return null;
};

export default function SellerHeader({
  onToggleSidebar,
  storeName = localStorage.getItem("seller_store_name") || "Store của tôi",
  userAvatar = "/store-avatar.png",
  notifications = 1,
  userFullName = "Nhà bán",
  userEmail = "mail@example.com",
  onAcademyClick = () => {},
}) {
  const [openStoreMenu, setOpenStoreMenu] = useState(false);
  const [openNotif, setOpenNotif] = useState(false);

  const [sellerInfo, setSellerInfo] = useState(null);
  const [profileInfo, setProfileInfo] = useState(null);
  const [loadingSeller, setLoadingSeller] = useState(false);
  const [sellerErr, setSellerErr] = useState("");

  const [policyStatus, setPolicyStatus] = useState(null);
  const [policyErr, setPolicyErr] = useState("");
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showTosBanner, setShowTosBanner] = useState(false);

  const [sellerUserId, setSellerUserId] = useState("");
  const [sellerId, setSellerId] = useState("");

  // CHAT (local)
  const [itemsChat, setItemsChat] = useState([]);
  const buyerMetaCacheRef = useRef(new Map());

  // ===== (MỚI) ORDER NOTIF (BE) dùng lại API user nhưng truyền sellerId =====
  const [itemsOrder, setItemsOrder] = useState([]);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [unreadOrder, setUnreadOrder] = useState(0);

  const latestPerBuyer = useMemo(() => {
    const map = new Map();
    for (const it of itemsChat) {
      if (it.type !== "buyer_message" || !it.buyerId) continue;
      if (!map.has(it.buyerId)) map.set(it.buyerId, it);
    }
    const arr = Array.from(map.values());
    return arr.sort((a, b) => {
      const ua = a.read ? 0 : 1;
      const ub = b.read ? 0 : 1;
      if (ub !== ua) return ub - ua;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [itemsChat]);
  const unreadChatCount = useMemo(
    () => latestPerBuyer.filter((x) => !x.read).length,
    [latestPerBuyer]
  );

  const storeBtnRef = useRef(null);
  const storeMenuRef = useRef(null);
  const navigate = useNavigate();

  // Fetch profile -> seller + init socket
  useEffect(() => {
    let cancelled = false;

    const token = getToken();
    if (!token) return;

    (async () => {
      try {
        setLoadingSeller(true);
        setSellerErr("");

        const r1 = await fetch(apiUrl(API_CONFIG.endpoints.getMyProfile), {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const j1 = await r1.json().catch(() => ({}));
        if (!r1.ok) throw new Error(j1?.message || `HTTP ${r1.status}`);
        const uid = (j1?.result ?? j1)?.id || (j1?.result ?? j1)?.userId || "";
        if (!uid) throw new Error("Không xác định được userId");
        if (cancelled) return;
        setProfileInfo(j1?.result ?? j1);
        setSellerUserId(uid);

        const r2 = await fetch(
          apiUrl(API_CONFIG.endpoints.searchSellerByUserId(uid)),
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const j2 = await r2.json().catch(() => ({}));
        if (!r2.ok) throw new Error(j2?.message || `HTTP ${r2.status}`);
        const seller = j2?.result || null;
        if (!seller)
          throw new Error("Tài khoản chưa là nhà bán hoặc thiếu dữ liệu");
        if (cancelled) return;
        setSellerInfo(seller);

        localStorage.setItem("seller_id", seller?.id || "");
        localStorage.setItem("seller_store_name", seller?.shop_name || "");

        initRealtime(uid, token);
        join(seller?.id);

        const loaded = loadNotifs(seller?.id).sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        setItemsChat(loaded);

        await checkPolicyStatusAndMaybePrompt(seller?.id, token, cancelled);
      } catch (e) {
        if (!cancelled) {
          setSellerErr(e?.message || "Không tải được thông tin shop");
          setSellerInfo(null);
        }
      } finally {
        if (!cancelled) setLoadingSeller(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sellerId && sellerInfo?.id) setSellerId(sellerInfo.id);
  }, [sellerInfo?.id, sellerId]);

  // Socket: nhận tin nhắn của buyer -> lưu local
  useEffect(() => {
    if (!sellerId) return;
    const sock = getSocket();

    const handleIncoming = async (payload) => {
      if (!payload?.from || payload?.to !== sellerId) return;
      const buyerId = payload.from;

      let meta = buyerMetaCacheRef.current.get(buyerId);
      if (!meta) {
        meta = await fetchBuyerMeta(buyerId);
        buyerMetaCacheRef.current.set(buyerId, meta);
      }

      const notif = {
        id: `${buyerId}-${payload.createdAt || Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        type: "buyer_message",
        buyerId,
        buyerName: meta?.name || "Khách",
        buyerAvatar: meta?.avatar || "/img/default-user.png",
        title: "Tin nhắn mới từ khách",
        text: previewText(payload),
        createdAt: payload.createdAt || new Date().toISOString(),
        read: false,
      };

      setItemsChat((prev) => {
        const next = [notif, ...prev].slice(0, 300);
        saveNotifs(sellerId, next);
        return next;
      });

      safeToast(
        `Bạn nhận được tin nhắn từ ${meta?.name || "Khách"}: ${previewText(
          payload
        )}`
      );
    };

    sock?.on("msg-receive", handleIncoming);
    sock?.on("message", handleIncoming);

    return () => {
      sock?.off("msg-receive", handleIncoming);
      sock?.off("message", handleIncoming);
    };
  }, [sellerId]);

  const checkPolicyStatusAndMaybePrompt = async (sid, token, cancelled) => {
    try {
      setPolicyErr("");
      const url = apiUrl(
        `/policy/policies/seller-tos/status/sellers/${encodeURIComponent(sid)}`
      );
      const r = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`);

      if (cancelled) return;

      const need = j?.needReconsent === true;
      setPolicyStatus(j || null);
      setShowPolicyModal(need);
      setShowTosBanner(need);
    } catch (e) {
      if (!cancelled) {
        setPolicyErr(e?.message || "Không kiểm tra được trạng thái chính sách");
        setPolicyStatus(null);
        setShowPolicyModal(false);
        setShowTosBanner(false);
      }
    }
  };

  const acceptPolicy = async () => {
    if (!sellerInfo?.id) return;
    const token = getToken();
    try {
      setAccepting(true);
      setPolicyErr("");
      const url = apiUrl(
        `/policy/policies/seller-tos/consents/sellers/${encodeURIComponent(
          sellerInfo.id
        )}/accept`
      );
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`);

      setShowPolicyModal(false);
      setShowTosBanner(false);
      setPolicyStatus((prev) =>
        prev ? { ...prev, needReconsent: false } : prev
      );
    } catch (e) {
      setPolicyErr(e?.message || "Không chấp nhận được chính sách lúc này");
    } finally {
      setAccepting(false);
    }
  };

  const deferPolicy = () => {
    setShowPolicyModal(false);
    setShowTosBanner(true);
  };

  useEffect(() => {
    const onClickOutside = (e) => {
      if (
        openStoreMenu &&
        storeMenuRef.current &&
        !storeMenuRef.current.contains(e.target) &&
        storeBtnRef.current &&
        !storeBtnRef.current.contains(e.target)
      ) {
        setOpenStoreMenu(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === "Escape") {
        setOpenStoreMenu(false);
        setOpenNotif(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [openStoreMenu]);

  const displayAvatar =
    sellerInfo?.avatar_link ||
    sellerInfo?.logo ||
    profileInfo?.avatar ||
    userAvatar;

  const displayStoreName = sellerInfo?.shop_name || storeName;
  const displayEmail = sellerInfo?.email || profileInfo?.email || userEmail;
  const displayFullname =
    sellerInfo?.shop_name || profileInfo?.fullName || userFullName;

  const currentPdf = policyStatus?.currentPdfUrl || "";
  const currentVer = policyStatus?.currentVersion || "";
  const currentStart = policyStatus?.currentStartDate || "";

  const markReadByBuyer = (buyerId) => {
    if (!sellerId) return;
    setItemsChat((prev) => {
      const next = prev.map((it) =>
        it.buyerId === buyerId ? { ...it, read: true } : it
      );
      saveNotifs(sellerId, next);
      return next;
    });
  };
  const removeByBuyer = (buyerId) => {
    if (!sellerId) return;
    setItemsChat((prev) => {
      const next = prev.filter((it) => it.buyerId !== buyerId);
      saveNotifs(sellerId, next);
      return next;
    });
  };
  const clearAllChat = () => {
    if (!sellerId) return;
    if (!window.confirm("Xoá tất cả thông báo tin nhắn?")) return;
    saveNotifs(sellerId, []);
    setItemsChat([]);
  };

  // ✅ Điều hướng tới /seller/chat-customers
  const goToChatWithBuyer = (buyerId, buyerName = "", buyerAvatar = "") => {
    const ts = Date.now();
    markReadByBuyer(buyerId);
    navigate(
      `/seller/chat-customers?sellerTarget=${encodeURIComponent(
        buyerId
      )}&t=${ts}`,
      {
        state: {
          targetUserId: buyerId,
          targetName: buyerName,
          targetAvatar: buyerAvatar,
          from: "seller-header-notif",
          forceReload: true,
          jumpToBottom: true,
          ts,
        },
      }
    );
    setOpenNotif(false);
  };

  const drawerItems = latestPerBuyer;

  // ===== (MỚI) NẠP ORDER NOTIF TỪ BE — dùng sellerId với API dành cho user =====
  useEffect(() => {
    if (!sellerId) return;
    let cancelled = false;

    const authFetchLike = (input, init) =>
      fetch(input, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          Accept: "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
      });

    (async () => {
      try {
        setLoadingOrder(true);

        // DÙNG LẠI API USER NHƯNG TRUYỀN sellerId
        const { items } = await fetchNotificationsByUser(
          authFetchLike,
          sellerId,
          {
            page: 0,
            size: 50,
          }
        );
        const sorted = [...(items || [])].sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );

        const c = await fetchUnreadCount(authFetchLike, sellerId);

        if (!cancelled) {
          setItemsOrder(sorted);
          setUnreadOrder(c);
        }
      } catch (e) {
        console.error("Load seller order notifications failed:", e);
      } finally {
        if (!cancelled) setLoadingOrder(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root"); // hoặc '#__next' nếu dùng Next
    // Container layout có thể là lớp cuộn chính:
    const guessScrollable = document.querySelector(
      ".seller-layout, .app, .tk-app, main, [data-scroll], [data-scroller]"
    );

    const add = () => {
      body.classList.add("tk-no-scroll");
      html.classList.add("tk-hide-scrollbars");
      body.classList.add("tk-hide-scrollbars");
      root && root.classList.add("tk-hide-scrollbars");
      guessScrollable && guessScrollable.classList.add("tk-hide-scrollbars");
    };
    const remove = () => {
      body.classList.remove("tk-no-scroll");
      html.classList.remove("tk-hide-scrollbars");
      body.classList.remove("tk-hide-scrollbars");
      root && root.classList.remove("tk-hide-scrollbars");
      guessScrollable && guessScrollable.classList.remove("tk-hide-scrollbars");
    };

    if (openNotif) add();
    else remove();
    return remove;
  }, [openNotif]);

  useLayoutEffect(() => {
    // đo chiều cao banner và header để offset đúng
    const doc = document.documentElement;

    const measure = () => {
      const banner = document.querySelector(".tos-snooze-banner");
      const header =
        document.querySelector(".tk-header.tk-lg") ||
        document.querySelector("header");

      const b = Math.ceil(
        (banner &&
          (banner.getBoundingClientRect?.().height || banner.offsetHeight)) ||
          0
      );
      const h = Math.ceil(
        (header &&
          (header.getBoundingClientRect?.().height || header.offsetHeight)) ||
          72
      );

      doc.style.setProperty("--tos-banner-h", `${b}px`);
      doc.style.setProperty("--header-only-h", `${h}px`);
      doc.style.setProperty("--header-h", `${b + h}px`); // tổng (banner + header)
    };

    // đo sau khi DOM layout xong
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(measure);
    });

    // re-measure khi resize / DOM thay đổi (banner ẩn/hiện, text đổi…)
    window.addEventListener("resize", measure);
    const mo = new MutationObserver(measure);
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      window.removeEventListener("resize", measure);
      mo.disconnect();
    };
  }, [showTosBanner, policyStatus?.needReconsent]);

  const onClickSellerOrderItem = async (it) => {
    try {
      if (it?.status !== "READ") {
        const authFetchLike = (input, init) =>
          fetch(input, {
            ...init,
            headers: {
              ...(init?.headers || {}),
              Accept: "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
          });

        await markNotificationRead(authFetchLike, it.id);
        setItemsOrder((prev) =>
          prev.map((x) => (x.id === it.id ? { ...x, status: "READ" } : x))
        );
        setUnreadOrder((c) => Math.max(0, c - 1));
      }
    } catch {}
    const link = it?.content?.link;
    navigate(typeof link === "string" && link ? link : "/seller/orders");
    setOpenNotif(false);
  };

  const markAllOrderSeller = async () => {
    if (!sellerId) return;
    try {
      const authFetchLike = (input, init) =>
        fetch(input, {
          ...init,
          headers: {
            ...(init?.headers || {}),
            Accept: "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
        });

      await markAllAsRead(authFetchLike, sellerId); // dùng lại API user
      setItemsOrder((prev) => prev.map((x) => ({ ...x, status: "READ" })));
      setUnreadOrder(0);
    } catch (e) {
      alert(e?.message || "Đánh dấu đã đọc hết thất bại");
    }
  };

  return (
    <>
      {showTosBanner && (
        <div className="tos-snooze-banner">
          <div className="tos-snooze-inner">
            <div className="tos-banner-left">
              <FontAwesomeIcon
                icon={faCircleExclamation}
                className="tos-banner-icon"
              />
              <div className="tos-marquee" aria-live="polite">
                <div className="tos-marquee-track">
                  Bạn đang <strong>chưa chấp thuận</strong> Chính sách Seller
                  TOS phiên bản <strong>{currentVer || "—"}</strong>. Trong{" "}
                  <strong>30 ngày</strong> nếu không chấp thuận, hệ thống sẽ{" "}
                  <strong>chấm dứt hợp tác</strong> và <strong>khóa</strong> các
                  tính năng liên quan.
                </div>
              </div>
            </div>

            <div className="tos-banner-actions">
              {currentPdf ? (
                <a
                  className="tos-banner-view"
                  href={currentPdf}
                  target="_blank"
                  rel="noreferrer"
                  title="Xem chính sách"
                >
                  Xem chính sách
                </a>
              ) : (
                <button
                  className="tos-banner-view"
                  onClick={() => navigate("/seller/policy")}
                  title="Xem chính sách"
                >
                  Xem chính sách
                </button>
              )}

              <button
                className="tos-banner-accept"
                onClick={acceptPolicy}
                title="Đồng ý ngay"
              >
                <FontAwesomeIcon icon={faCheck} className="me-1" />
                Đồng ý ngay
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="tk-header tk-lg">
        <div className="tk-left">
          <div className="tk-brand">
            <div className="tk-logo shopping tk-lgtext">
              <span className="shop-blue">S</span>
              <span className="shop-blue">h</span>
              <span className="shop-blue">o</span>
              <span className="shop-blue">p</span>
              <span className="shop-blue">p</span>
              <span className="shop-blue">i</span>
              <span className="shop-yellow">n</span>
              <span className="shop-blue">g</span>
            </div>
            <span className="tk-divider" />
            <span className="tk-seller-center tk-lgtext">SELLER CENTER</span>
          </div>
        </div>

        <div className="tk-right">
          {/* Tin nhắn */}
          <button
            className="tk-icon-btn tk-lg"
            title="Tin nhắn"
            onClick={() => navigate("/seller/chat-customers")}
          >
            <FontAwesomeIcon icon={faCommentDots} />
          </button>

          <div className="tk-icon-wrap" title="Thông báo">
            <button
              className={`tk-icon-btn tk-lg has-badge`}
              onClick={() => setOpenNotif(true)}
              aria-haspopup="dialog"
              aria-expanded={openNotif}
            >
              <FontAwesomeIcon icon={faBell} />
              {/* Badge gộp: chat + order (có thể tách nếu muốn) */}
              {unreadChatCount + unreadOrder > 0 && (
                <span className="tk-badge">
                  {unreadChatCount + unreadOrder}
                </span>
              )}
            </button>
          </div>

          <button
            className="tk-icon-btn tk-lg tk-wallet-btn"
            title="Ví nhà bán"
            onClick={() => navigate("/seller/wallet")}
          >
            <FontAwesomeIcon icon={faWallet} />
          </button>

          <button
            ref={storeBtnRef}
            className={`tk-store-switch tk-lg ${openStoreMenu ? "active" : ""}`}
            onClick={() => setOpenStoreMenu((s) => !s)}
            title={
              sellerErr
                ? sellerErr
                : loadingSeller
                ? "Đang tải..."
                : displayStoreName
            }
          >
            <img className="tk-avatar" src={displayAvatar} alt="store avatar" />
            <span className="tk-store-name">{displayStoreName}</span>
            <FontAwesomeIcon icon={faChevronDown} className="tk-caret" />
          </button>

          {openStoreMenu && (
            <div ref={storeMenuRef} className="tk-dropdown tk-store-menu">
              <div className="tk-menu-head">
                <img
                  className="tk-avatar lg"
                  src={displayAvatar}
                  alt="avatar"
                />
                <div className="tk-user-info">
                  <div className="tk-fullname">{displayFullname}</div>
                  <div className="tk-email">{displayEmail}</div>
                </div>
              </div>

              <button
                className="tk-menu-item"
                type="button"
                onClick={() => {
                  setOpenStoreMenu(false);
                  navigate("/seller/profile");
                }}
              >
                <FontAwesomeIcon icon={faUser} />
                <span>Hồ sơ nhà bán</span>
              </button>

              <button
                className="tk-menu-item"
                type="button"
                onClick={() => {
                  setOpenStoreMenu(false);
                  navigate("/");
                }}
              >
                <FontAwesomeIcon icon={faHouse} />
                <span>Quay về mua sắm</span>
              </button>

              <div className="tk-sep" />

              <button
                className="tk-menu-item danger"
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("access_token");
                  navigate("/login");
                }}
              >
                <FontAwesomeIcon icon={faRightFromBracket} />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {openNotif && (
        <div className="tk-overlay" onClick={() => setOpenNotif(false)} />
      )}

      <aside
        className={`tk-drawer ${openNotif ? "open" : ""}`}
        role="dialog"
        aria-label="Cập nhật nhà bán"
      >
        <div className="tk-drawer-head">
          <div className="tk-drawer-title">Cập nhật nhà bán</div>
          <button
            className="tk-icon-btn"
            onClick={() => setOpenNotif(false)}
            aria-label="Đóng"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="tk-drawer-actions">
          {/* “Xem tất cả” dẫn tới trang chat-customers */}
          <button
            className="link"
            onClick={() => {
              setOpenNotif(false);
              navigate("/seller/chat-customers");
            }}
          >
            Xem tất cả
          </button>
          <button className="link" onClick={clearAllChat}>
            Đã đọc tất cả (Chat)
          </button>
        </div>

        <div className="tk-drawer-list">
          {/* ===== CHAT từ khách ===== */}
          {drawerItems.length === 0 ? (
            <div className="tk-empty">Không có thông báo chat</div>
          ) : (
            <ul className="tk-list">
              {drawerItems.map((it) => (
                <li
                  key={it.buyerId}
                  className={`tk-item ${!it.read ? "is-unread" : ""}`}
                >
                  <div className="tk-item-left">
                    <img
                      className="tk-avatar sm"
                      src={it.buyerAvatar || "/img/default-user.png"}
                      alt={it.buyerName || it.buyerId}
                    />
                  </div>
                  <div className="tk-item-main">
                    <div className="tk-item-title">
                      {it.title || "Tin nhắn mới từ khách"}
                    </div>
                    <div className="tk-item-text">{it.text}</div>
                    <div className="tk-item-meta">
                      {formatTime(it.createdAt)}
                      <span className="muted">
                        {" "}
                        • Khách: {it.buyerName || it.buyerId}
                      </span>
                      {!it.read && (
                        <span className="unread-dot"> • Chưa đọc</span>
                      )}
                    </div>
                    <div className="tk-item-actions">
                      <button
                        className="btn btn--primary"
                        title="Xem"
                        onClick={() =>
                          goToChatWithBuyer(
                            it.buyerId,
                            it.buyerName,
                            it.buyerAvatar
                          )
                        }
                      >
                        <FontAwesomeIcon icon={faEye} className="me-1" />
                        Xem
                      </button>
                      <button
                        className="btn btn--ghost"
                        title="Xoá"
                        onClick={() => removeByBuyer(it.buyerId)}
                      >
                        <FontAwesomeIcon icon={faTrashCan} className="me-1" />
                        Xoá
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* ===== (MỚI) ORDER NOTIF từ BE (sellerId) ===== */}
          <div className="tk-drawer-subhead">
            <div className="tk-drawer-subtitle">
              Thông báo đơn hàng
              {unreadOrder ? (
                <span className="tk-badge-muted">
                  {" "}
                  • {unreadOrder} chưa đọc
                </span>
              ) : (
                ""
              )}
            </div>
            <div className="tk-drawer-subactions">
              <button
                className="link"
                onClick={markAllOrderSeller}
                disabled={!itemsOrder.length}
              >
                Đã đọc hết
              </button>
            </div>
          </div>

          {loadingOrder ? (
            <div className="tk-empty">Đang tải…</div>
          ) : itemsOrder.length === 0 ? (
            <div className="tk-empty">Không có thông báo đơn hàng</div>
          ) : (
            <ul className="tk-list">
              {itemsOrder.map((it) => (
                <li
                  key={it.id}
                  className={`tk-item tk-order-item ${
                    it.status !== "READ" ? "is-unread" : ""
                  }`}
                  onClick={() => onClickSellerOrderItem(it)}
                  title="Mở chi tiết"
                  style={{ cursor: "pointer" }}
                >
                  <div className="tk-item-main">
                    <div className="tk-item-title">
                      {it.type === "MESSAGE"
                        ? "Thông báo đơn hàng"
                        : it.type || "Thông báo"}
                    </div>
                    <div className="tk-item-text">
                      {it?.content?.text || "Bạn có thông báo mới"}
                    </div>
                    <div className="tk-item-meta">
                      {formatTime(it.createdAt)}
                      {it?.content?.orderId && (
                        <span className="muted">
                          {" "}
                          • Mã đơn:{" "}
                          {String(it.content.orderId).slice(-8).toUpperCase()}
                        </span>
                      )}
                      {/* ✅ Chưa đọc: chỉ hiện chấm đỏ, không có nút “Đã đọc” */}
                      {it.status !== "READ" && (
                        <span
                          className="unread-dot only-dot"
                          aria-label="Chưa đọc"
                          title="Chưa đọc"
                        />
                      )}
                    </div>
                  </div>

                  {/* ❌ BỎ hành động “Đã đọc” đối với ORDER */}
                  {/* Không render khối tk-item-actions ở đây */}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {showPolicyModal && (
        <>
          <div className="tos-modal-backdrop" />
          <div
            className="tos-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tos-modal-title"
          >
            <div className="tos-modal-head">
              <div className="tos-modal-title" id="tos-modal-title">
                <FontAwesomeIcon
                  icon={faTriangleExclamation}
                  className="me-2 text-warning"
                />
                Cập nhật Chính sách dành cho Người bán
              </div>
            </div>

            <div className="tos-modal-body">
              {policyErr && (
                <div className="tos-modal-alert error">{policyErr}</div>
              )}

              <div className="tos-meta">
                <div>
                  <strong>Phiên bản hiện tại:</strong>{" "}
                  <span className="badge">{currentVer || "—"}</span>
                </div>
                <div>
                  <strong>Hiệu lực từ:</strong>{" "}
                  <span>{currentStart || "—"}</span>
                </div>
              </div>

              <div className="tos-desc">
                Bạn cần <strong>chấp thuận</strong> Chính sách mới trước khi
                tiếp tục sử dụng Seller Center. Nếu chọn <strong>Để sau</strong>
                , hệ thống sẽ nhắc lại khi bạn vào lại trang hoặc khi có phiên
                bản mới. Sau <strong>30 ngày</strong> nếu vẫn chưa chấp thuận,
                nền tảng có thể <strong>chấm dứt hợp tác</strong>.
              </div>

              <div className="tos-links">
                {currentPdf ? (
                  <a
                    href={currentPdf}
                    target="_blank"
                    rel="noreferrer"
                    className="tos-link-btn"
                  >
                    <FontAwesomeIcon icon={faFilePdf} className="me-2" />
                    Xem PDF Chính sách
                  </a>
                ) : (
                  <span className="tos-link-muted">Chưa có PDF</span>
                )}
                <button
                  className="tos-link-btn outline"
                  onClick={() => navigate("/seller/policy")}
                >
                  Xem bản Markdown
                </button>
              </div>
            </div>

            <div className="tos-modal-actions">
              <button
                className="tos-btn defer"
                onClick={deferPolicy}
                disabled={accepting}
                title="Đóng thông báo tạm thời"
              >
                Để sau
              </button>
              <button
                className="tos-btn accept"
                onClick={acceptPolicy}
                disabled={accepting}
                aria-busy={accepting}
              >
                <FontAwesomeIcon icon={faCheck} className="me-2" />
                {accepting ? "Đang xác nhận..." : "Tôi đồng ý"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
