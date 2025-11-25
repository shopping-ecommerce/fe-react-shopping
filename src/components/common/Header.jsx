"use client";

import { Link, useNavigate } from "react-router-dom";
import { useContext, useEffect, useRef, useState, useCallback } from "react";
import { AuthContext } from "../../contexts/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faShoppingCart,
  faBell,
  faGlobe,
  faUser,
  faHeart,
  faTimesCircle,
  faCamera,
} from "@fortawesome/free-solid-svg-icons";
import { API_CONFIG, apiUrl } from "../../config/api";
import { initSocket as initRealtime, getSocket } from "../../services/realtime";
import { fetchUnreadCount } from "../../services/notificationService";
import ChatToaster from "./ChatToaster";

function guessDisplayName(user) {
  if (!user) return "Tài khoản";
  const direct =
    user.last_name ||
    user.lastName ||
    user.family_name ||
    user.familyName ||
    "";
  if (direct) return direct;
  const full = user.fullName || user.name || user.displayName || "";
  if (full) return full;
  if (user?.email) return user.email.split("@")[0];
  return "Tài khoản";
}

const safeJson = async (res) => {
  const t = await res.text();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return { message: t };
  }
};

const NOTIF_KEY = (uid) => `notif_messages_v1_${uid || "guest"}`;
const countUnreadChat = (uid) => {
  try {
    const raw = localStorage.getItem(NOTIF_KEY(uid));
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return 0;
    const map = new Map();
    for (const it of arr) {
      if (it.type !== "seller_message" || !it.sellerId) continue;
      if (!map.has(it.sellerId)) map.set(it.sellerId, it);
    }
    return Array.from(map.values()).filter((it) => !it.read).length;
  } catch {
    return 0;
  }
};

function Header({ alwaysVisible = false }) {
  const { user, authFetch } = useContext(AuthContext);
  const isLoggedIn = !!user;
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("Tài khoản");
  useEffect(() => {
    setDisplayName(guessDisplayName(user));
  }, [user]);

  // seller status + id
  const [sellerStatus, setSellerStatus] = useState(null);
  const [mySellerId, setMySellerId] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!user) {
          setSellerStatus(null);
          setMySellerId("");
          return;
        }
        const r1 = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile), {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const j1 = await safeJson(r1);
        const userId = (j1.result ?? j1)?.id;
        if (!userId) {
          if (!cancelled) {
            setSellerStatus(null);
            setMySellerId("");
          }
          return;
        }

        const r2 = await authFetch(
          apiUrl(API_CONFIG.endpoints.searchSellerByUserId(userId)),
          {
            method: "GET",
            headers: { Accept: "application/json" },
          }
        );
        if (!r2.ok) {
          if (!cancelled) {
            setSellerStatus(null);
            setMySellerId("");
          }
          return;
        }
        const j2 = await safeJson(r2);
        const status = (j2.result?.status || "").toString().toUpperCase();
        const sid = j2.result?.id || "";
        if (!cancelled) {
          setSellerStatus(status || null);
          setMySellerId(sid || "");
        }
      } catch {
        if (!cancelled) {
          setSellerStatus(null);
          setMySellerId("");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authFetch]);

  // ✅ CHANGED: cho phép vào Kênh người bán nếu APPROVED **hoặc** SUSPENDED
  const isApproved = sellerStatus === "APPROVED";
  const isSuspended = sellerStatus === "SUSPENDED";
  const showSellerChannel = !!user && (isApproved || isSuspended);

  // unread badges
  const [userId, setUserId] = useState("");
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadOrder, setUnreadOrder] = useState(0);
  const unreadTotal = Math.max(0, Number(unreadChat) + Number(unreadOrder));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!authFetch || !isLoggedIn) {
          setUserId("");
          setUnreadChat(0);
          setUnreadOrder(0);
          return;
        }
        const r = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile), {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const j = await safeJson(r);
        if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`);
        const uid = (j.result ?? j)?.id;
        if (!uid) throw new Error("no userId");
        if (cancelled) return;

        setUserId(uid);
        setUnreadChat(countUnreadChat(uid));

        try {
          const c = await fetchUnreadCount(authFetch, uid);
          setUnreadOrder(c);
        } catch {
          setUnreadOrder(0);
        }

        initRealtime(uid);
      } catch {
        if (!cancelled) {
          setUserId("");
          setUnreadChat(0);
          setUnreadOrder(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, isLoggedIn]);

  useEffect(() => {
    if (!mySellerId) return;
    const s = getSocket();
    s?.emit("add-user", mySellerId);
  }, [mySellerId]);

  useEffect(() => {
    if (!userId) return;
    const s = getSocket();
    if (!s) return;

    const iAmAny = (id) => [userId, mySellerId].filter(Boolean).includes(id);
    const onIncoming = async (payload) => {
      if (!iAmAny(payload?.to)) return;
      setUnreadChat((x) => x + 1);
    };

    s.on("msg-receive", onIncoming);
    s.on("message", onIncoming);
    return () => {
      s.off("msg-receive", onIncoming);
      s.off("message", onIncoming);
    };
  }, [userId, mySellerId]);

  useEffect(() => {
    if (!userId) return;
    const handler = (e) => {
      if (e.key === NOTIF_KEY(userId)) {
        setUnreadChat(countUnreadChat(userId));
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const t = setInterval(async () => {
      try {
        const c = await fetchUnreadCount(authFetch, userId);
        setUnreadOrder(c);
      } catch {}
    }, 30000);
    return () => clearInterval(t);
  }, [userId, authFetch]);

  // SEARCH + SUGGEST
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [q, setQ] = useState("");
  const [suggests, setSuggests] = useState([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [errorSuggest, setErrorSuggest] = useState(null);

  const [activeIdx, setActiveIdx] = useState(-1);
  const itemRefs = useRef([]);
  const searchRef = useRef(null);
  const searchBtnRef = useRef(null);
  const debounceRef = useRef();
  const MIN_PREFIX = 1;

  const SEMANTIC_TOP_K = 10;
  const SEM_K = (q) => `semantic_results_v1_${(q || "").toLowerCase()}`;

  async function runSemanticThenNavigate(term, navigate, setIsSearching) {
    const query = (term || "").trim();
    if (!query) return;

    try {
      const url = apiUrl(API_CONFIG.endpoints.semanticSearchGemini);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, top_k: SEMANTIC_TOP_K }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { message: text };
      }
      if (res.ok && Array.isArray(json?.results)) {
        const payload = {
          query,
          results: json.results,
          total_results: json.total_results ?? json.results.length,
          success: json.success ?? true,
        };
        sessionStorage.setItem(SEM_K(query), JSON.stringify(payload));
        setIsSearching?.(false);
        navigate(`/search?q=${encodeURIComponent(query)}&semantic=1`, {
          state: { semantic: payload },
          replace: false,
        });
        return;
      }
    } catch {}
    setIsSearching?.(false);
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  useEffect(() => {
    function onDocClick(e) {
      if (!isSearching) return;
      const box = searchRef.current;
      const btn = searchBtnRef.current;
      if (box && box.contains(e.target)) return;
      if (btn && btn.contains(e.target)) return;

      setIsSearching(false);
      setShowSuggest(false);
      setSuggests([]);
      setActiveIdx(-1);

      if (isImgOpen) closeImagePopover(true);
    }
    function onKeyDoc(e) {
      if (e.key === "Escape") {
        setIsSearching(false);
        setShowSuggest(false);
        setSuggests([]);
        setActiveIdx(-1);
        if (isImgOpen) closeImagePopover(true);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDoc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDoc);
    };
  }, [isSearching]); // eslint-disable-line

  useEffect(() => {
    if (isSearching && searchRef.current) {
      const input = searchRef.current.querySelector("input");
      if (input) input.focus();
    }
  }, [isSearching]);

  useEffect(() => {
    setActiveIdx(suggests.length ? 0 : -1);
    itemRefs.current = itemRefs.current.slice(0, suggests.length);
  }, [suggests]);

  const fetchSuggest = async (term) => {
    const prefix = term.trim();
    if (prefix.length < MIN_PREFIX) {
      setSuggests([]);
      setErrorSuggest(null);
      return;
    }
    setLoadingSuggest(true);
    setErrorSuggest(null);
    try {
      const url = apiUrl(API_CONFIG.endpoints.searchSuggest(prefix));
      const res = await authFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
      const list = Array.isArray(json?.result) ? json.result : [];
      setSuggests(list);
    } catch (e) {
      setErrorSuggest(e.message || "Suggest failed");
      setSuggests([]);
    } finally {
      setLoadingSuggest(false);
    }
  };

  const onChangeQ = (e) => {
    const term = e.target.value;
    setQ(term);
    setShowSuggest(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggest(term), 250);
  };

  const onKeyDownInput = (e) => {
    if (!showSuggest) {
      if (e.key === "ArrowDown" && suggests.length > 0) {
        setShowSuggest(true);
        setActiveIdx((idx) => (idx >= 0 ? idx : 0));
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      if (suggests.length) {
        setActiveIdx((idx) => {
          const next = idx < suggests.length - 1 ? idx + 1 : 0;
          const el = itemRefs.current[next];
          if (el) el.scrollIntoView({ block: "nearest" });
          return next;
        });
        e.preventDefault();
      }
    } else if (e.key === "ArrowUp") {
      if (suggests.length) {
        setActiveIdx((idx) => {
          const next = idx > 0 ? idx - 1 : suggests.length - 1;
          const el = itemRefs.current[next];
          if (el) el.scrollIntoView({ block: "nearest" });
          return next;
        });
        e.preventDefault();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < suggests.length) {
        const name = suggests[activeIdx];
        setQ(name);
        navigate(`/search?q=${encodeURIComponent(name)}`);
        setShowSuggest(false);
        setSuggests([]);
      } else {
        submitSearch(e);
      }
    } else if (e.key === "Escape") {
      setShowSuggest(false);
      setActiveIdx(-1);
      if (isImgOpen) closeImagePopover(true);
    }
  };

  const submitSearch = (e) => {
    e.preventDefault();
    const term = (q || "").trim();
    if (!term) return;
    setShowSuggest(false);
    setSuggests([]);
    setActiveIdx(-1);
    runSemanticThenNavigate(term, navigate, setIsSearching);
  };

  const onClickSuggest = (name) => {
    setQ(name);
    setShowSuggest(false);
    setSuggests([]);
    setActiveIdx(-1);
    runSemanticThenNavigate(name, navigate, setIsSearching);
  };

  const handleBecomeSeller = (e) => {
    e.preventDefault();
    if (!isLoggedIn) navigate("/login");
    else navigate("/seller/signup");
  };

  // Đảm bảo seller có ví trước khi vào Seller Center
  const ensureSellerWallet = useCallback(async () => {
    if (!authFetch || !mySellerId) return;
    try {
      const balUrl = apiUrl(API_CONFIG.endpoints.walletBalance(mySellerId));
      const balRes = await authFetch(balUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (balRes.ok) return;

      const createUrl = apiUrl(API_CONFIG.endpoints.walletCreate(mySellerId));
      const createRes = await authFetch(createUrl, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      if (!createRes.ok) {
        const t = await createRes.text();
        throw new Error(t || `HTTP ${createRes.status}`);
      }
      console.log("✅ Tạo ví seller thành công");
    } catch (e) {
      console.warn("⚠ Không thể tạo ví tự động:", e?.message || e);
    }
  }, [authFetch, mySellerId]);

  const onClickSellerChannel = async (e) => {
    e.preventDefault();
    if (!mySellerId) return;
    const s = getSocket() || initRealtime(userId || mySellerId);
    s?.emit("add-user", mySellerId);

    await ensureSellerWallet();
    navigate("/seller");
  };

  // IMAGE SEARCH
  const [isImgOpen, setIsImgOpen] = useState(false);
  const [isImgClosing, setIsImgClosing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imgErr, setImgErr] = useState("");
  const fileInputRef = useRef(null);

  const IMG_MAX_MB = 8;
  const IMG_ALLOWED = ["image/jpeg", "image/png", "image/webp"];
  const IMG_STORE_KEY = "image_search_payload_v1";

  const openImagePopover = () => {
    setIsSearching(true);
    setIsImgClosing(false);
    setIsImgOpen(true);
    setImgErr("");
  };

  const closeImagePopover = (withAnim = true) => {
    if (!withAnim) {
      setIsImgOpen(false);
      setIsImgClosing(false);
      setIsDragOver(false);
      setImgErr("");
      return;
    }
    setIsImgClosing(true);
    setTimeout(() => {
      setIsImgOpen(false);
      setIsImgClosing(false);
      setIsDragOver(false);
      setImgErr("");
    }, 300);
  };

  const toggleImagePopover = () => {
    if (isImgOpen && !isImgClosing) {
      closeImagePopover(true);
    } else {
      openImagePopover();
    }
  };

  const onPickFile = () => fileInputRef.current?.click();

  const _validateFile = (file) => {
    if (!file) return "không có file";
    if (!IMG_ALLOWED.includes(file.type)) return "chỉ hỗ trợ jpg, png, webp";
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > IMG_MAX_MB) return `file quá lớn (> ${IMG_MAX_MB}MB)`;
    return "";
  };

  const _fileToDataURL = (file) =>
    new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });

  const _proceedNavigateWithImage = async (file) => {
    const dataUrl = await _fileToDataURL(file);
    const payload = {
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl,
      ts: Date.now(),
      source: "header",
    };
    sessionStorage.setItem(IMG_STORE_KEY, JSON.stringify(payload));
    closeImagePopover(true);
    setIsSearching(false);
    navigate(`/search?image=1&source=header&v=${payload.ts}`, {
      replace: true,
    });
  };

  const handleFiles = async (files) => {
    try {
      const file = files?.[0];
      const err = _validateFile(file);
      if (err) {
        setImgErr(err);
        return;
      }
      setImgErr("");
      await _proceedNavigateWithImage(file);
    } catch {
      setImgErr("xử lý ảnh thất bại, thử lại nhé");
    }
  };

  const onDragOverDropzone = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };
  const onDragLeaveDropzone = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };
  const onDropOnDropzone = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer?.files;
    if (!files || !files.length) return;
    await handleFiles(files);
  };

  const onChangeFileInput = async (e) => {
    await handleFiles(e.target.files);
    e.target.value = "";
  };

  const accountLink = isLoggedIn ? "/account" : "/login";

  return (
    <header
      className={`header header--compact ${alwaysVisible ? "is-locked" : ""} ${
        isSearching ? "is-searching" : ""
      }`}
    >
      <div className="header-row">
        {/* Logo */}
        <Link to="/" className="h-logo" aria-label="Trang chủ">
          <img src="/img/iconwweb.png" alt="T2Store" />
        </Link>

        {/* Nav */}
        <nav className="h-nav">
          <Link to="/" className="h-link">
            Trang chủ
          </Link>

          {showSellerChannel ? (
            <Link
              to="/seller"
              className="h-link"
              onClick={onClickSellerChannel}
              title={
                isSuspended
                  ? "Tài khoản đang bị tạm ngưng — một số chức năng sẽ bị khoá"
                  : undefined
              }
            >
              Kênh người bán{isSuspended}
            </Link>
          ) : (
            <a
              href="/seller/signup"
              className="h-link"
              onClick={handleBecomeSeller}
              role="button"
            >
              Trở thành người bán
            </a>
          )}

          <Link
            to="/account/notifications"
            className="h-link h-link--notif"
            data-tour="notif"
          >
            <span className="h-link-ico-wrap">
              <FontAwesomeIcon icon={faBell} className="h-link-ico" />
              {unreadTotal > 0 && (
                <span
                  className="notif-badge"
                  aria-label={`${unreadTotal} thông báo mới`}
                >
                  {unreadTotal > 99 ? "99+" : unreadTotal}
                </span>
              )}
            </span>
            Thông báo
          </Link>

          <div
            className="h-lang"
            role="button"
            tabIndex={0}
            title="Chính sách"
            onClick={() => navigate("/account/policies")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate("/account/policies");
              }
            }}
          >
            <FontAwesomeIcon icon={faGlobe} className="h-link-ico" />
            Chính sách
          </div>

          <button
            className="h-icon h-search"
            aria-label="Mở tìm kiếm"
            title="Tìm kiếm"
            onClick={() => setIsSearching(true)}
            data-tour="search"
            ref={searchBtnRef}
          >
            <FontAwesomeIcon icon={faSearch} />
          </button>
        </nav>

        {/* Searchbox */}
        <form
          className="h-searchbox"
          ref={searchRef}
          onSubmit={submitSearch}
          role="search"
        >
          <input
            type="text"
            placeholder="Tìm kiếm sản phẩm…"
            value={q}
            onChange={onChangeQ}
            onKeyDown={onKeyDownInput}
            onFocus={() => {
              setIsSearching(true);
              if (q.trim()) setShowSuggest(true);
            }}
            aria-label="Tìm kiếm"
            aria-expanded={showSuggest}
            aria-controls="suggest-listbox"
            role="combobox"
            aria-autocomplete="list"
          />

          {q && (
            <button
              type="button"
              className="h-search-clear"
              onClick={() => {
                setQ("");
                setSuggests([]);
                setShowSuggest(false);
                setActiveIdx(-1);
              }}
              aria-label="Xoá"
            >
              <FontAwesomeIcon icon={faTimesCircle} />
            </button>
          )}

          {/* Nút máy ảnh - toggle popover */}
          <button
            type="button"
            className="h-search-camera"
            aria-label="Tìm bằng hình ảnh"
            title="Tìm bằng hình ảnh"
            onClick={toggleImagePopover}
          >
            <FontAwesomeIcon icon={faCamera} />
          </button>

          <button
            type="submit"
            className="h-search-submit"
            aria-label="Tìm kiếm"
          >
            <FontAwesomeIcon icon={faSearch} />
          </button>

          {/* Gợi ý */}
          {isSearching && showSuggest && (
            <div
              id="suggest-listbox"
              className="h-suggest"
              role="listbox"
              aria-label="Gợi ý tìm kiếm"
            >
              {loadingSuggest && <div className="sg-item muted">Đang tải…</div>}
              {!loadingSuggest && errorSuggest && (
                <div className="sg-item error">Lỗi: {errorSuggest}</div>
              )}
              {!loadingSuggest &&
                !errorSuggest &&
                suggests.length === 0 &&
                q.trim() && <div className="sg-item muted">Không có gợi ý</div>}
              {!loadingSuggest &&
                suggests.map((s, i) => (
                  <div
                    key={`${s}-${i}`}
                    className={`sg-item ${i === activeIdx ? "is-active" : ""}`}
                    onClick={() => onClickSuggest(s)}
                    role="option"
                    aria-selected={i === activeIdx}
                    tabIndex={-1}
                    ref={(el) => (itemRefs.current[i] = el)}
                    title={s}
                  >
                    <FontAwesomeIcon icon={faSearch} className="sg-ico" />
                    <span className="sg-text">{s}</span>
                  </div>
                ))}
            </div>
          )}

          {/* Popover tìm bằng hình ảnh */}
          {isImgOpen && (
            <div
              className={`img-popover ${
                isImgClosing ? "is-closing" : "is-open"
              }`}
              role="dialog"
              aria-modal="true"
              aria-label="Tìm bằng hình ảnh"
            >
              <div
                className={`img-dropzone ${isDragOver ? "is-drag" : ""}`}
                onDragOver={onDragOverDropzone}
                onDragLeave={onDragLeaveDropzone}
                onDrop={onDropOnDropzone}
                onClick={onPickFile}
                tabIndex={0}
              >
                <div className="img-dropzone-ico">
                  <FontAwesomeIcon icon={faCamera} />
                </div>
                <div className="img-dropzone-text">
                  <strong>Kéo & thả ảnh vào đây</strong>
                  <span>hoặc bấm để chọn ảnh từ máy</span>
                  <em>(hỗ trợ jpg, png, webp · tối đa 8MB)</em>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={onChangeFileInput}
                />
              </div>

              {imgErr && <div className="img-error">⚠ {imgErr}</div>}

              <div className="img-actions">
                <button
                  type="button"
                  className="img-btn secondary"
                  onClick={() => closeImagePopover(true)}
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Right cluster */}
        <div className="h-right">
          <Link
            to="/account/favorites"
            className="h-icon h-heart"
            aria-label="Yêu thích"
            title="Yêu thích"
            data-tour="favorites"
          >
            <FontAwesomeIcon icon={faHeart} />
          </Link>
          <Link
            to="/cart"
            className="h-icon h-cart"
            aria-label="Giỏ hàng"
            title="Giỏ hàng"
            data-tour="cart"
          >
            <FontAwesomeIcon icon={faShoppingCart} />
          </Link>
          <Link
            to={isLoggedIn ? "/account" : "/login"}
            className="account-pill"
            title={displayName || "Tài khoản"}
            data-tour="account"
          >
            <span className="acc-ico">
              <FontAwesomeIcon icon={faUser} />
            </span>
            <span className="acc-name">{displayName || "Tài khoản"}</span>
          </Link>
        </div>
      </div>
      <ChatToaster />
    </header>
  );
}

export default Header;
