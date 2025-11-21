// src/components/common/ChatToaster.jsx
import React, { useEffect, useRef, useState, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../config/api";
// ❌ bỏ: import { initSocket } from "../../services/chatShop";
// ✅ dùng realtime socket:
import { initSocket as initRealtime, getSocket } from "../../services/realtime";

/** Lấy meta shop (tên + avatar) */
async function fetchSellerMeta(sellerId) {
  if (!sellerId) return { name: "Shop", avatar: "/img/default-shop.png" };
  try {
    const res = await fetch(
      apiUrl(API_CONFIG.endpoints.searchSellerBySellerId(sellerId)),
      { headers: { Accept: "application/json" } }
    );
    const data = await res.json().catch(() => ({}));
    const shop = data?.result || {};
    return {
      name: shop.shop_name || shop.shopName || "Shop",
      avatar: shop.avatar_link || "/img/default-shop.png",
    };
  } catch {
    return { name: "Shop", avatar: "/img/default-shop.png" };
  }
}

/** Rút gọn text xem trước */
function previewText(payload) {
  const { message, emoji, files, fileUrls } = payload || {};
  if (message && String(message).trim()) return String(message).trim();
  if (emoji) return `(${emoji})`;
  const f = files || fileUrls;
  if (Array.isArray(f) && f.length) return "[tệp]";
  return "Tin nhắn mới";
}

/* ========== styles nhỏ gọn ========== */
function toastStyle(type = "info") {
  const bg =
    type === "success"
      ? "#065f46"
      : type === "error"
      ? "#991b1b"
      : type === "warning"
      ? "#92400e"
      : "#111827";
  return {
    position: "relative",
    background: bg,
    color: "#fff",
    borderRadius: 10,
    padding: "8px 36px 8px 10px",
    minWidth: 260,
    maxWidth: 340,
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 10px 24px rgba(0,0,0,.25)",
    pointerEvents: "auto",
    cursor: "default",
    fontSize: 13,
    lineHeight: 1.35,
  };
}

const closeBtnStyle = {
  position: "absolute",
  top: 6,
  right: 6,
  width: 22,
  height: 22,
  borderRadius: 11,
  border: "none",
  background: "rgba(255,255,255,.18)",
  color: "#fff",
  fontSize: 16,
  lineHeight: "22px",
  cursor: "pointer",
};
const btnStylePrimary = {
  background: "#fff",
  color: "#111827",
  border: "none",
  borderRadius: 8,
  padding: "6px 10px",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13,
};
const btnStyleGhost = {
  background: "transparent",
  color: "#fff",
  border: "1px solid rgba(255,255,255,.45)",
  borderRadius: 8,
  padding: "6px 10px",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
};

export default function ChatToaster() {
  const { authFetch } = useContext(AuthContext) || {};
  const [userId, setUserId] = useState("");
  const [toasts, setToasts] = useState([]); // {id, kind, ...}
  const timers = useRef({});
  const navigate = useNavigate();
  const location = useLocation();

  // Singleton flag để tránh mount 2 lần
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.__TOAST_DEDUP_IDS) window.__TOAST_DEDUP_IDS = new Set();
    if (!window.__CHAT_TOASTER_MOUNTED) {
      window.__CHAT_TOASTER_MOUNTED = true;
      setEnabled(true);
      return () => {
        if (window.__CHAT_TOASTER_MOUNTED) {
          window.__CHAT_TOASTER_MOUNTED = false;
        }
      };
    } else {
      setEnabled(false);
    }
  }, []);

  /** Lấy userId */
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        if (!authFetch) return;
        const rp = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile), {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const dp = await rp.json().catch(() => ({}));
        if (!rp.ok) throw new Error(dp?.message || `HTTP ${rp.status}`);
        const uid = dp?.result?.id;
        if (!cancelled) setUserId(uid || "");
      } catch {
        if (!cancelled) setUserId("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, authFetch]);

  /** Socket: nhận tin nhắn người bán → tạo toast chat */
  useEffect(() => {
    if (!enabled || !userId) return;

    // ✅ mở socket cho userId bằng realtime.js
    const sock = initRealtime(userId) || getSocket();

    const onIncoming = async (payload) => {
      if (!payload?.from || payload?.to !== userId) return;
      const sellerId = payload.from;
      const meta = await fetchSellerMeta(sellerId);

      const id = `chat-${sellerId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;

      if (window.__TOAST_DEDUP_IDS?.has(id)) return;
      window.__TOAST_DEDUP_IDS?.add(id);

      setToasts((prev) => [
        ...prev,
        {
          id,
          kind: "chat",
          sellerId,
          sellerName: meta.name,
          avatar: meta.avatar,
          text: previewText(payload),
          createdAt: payload.createdAt || new Date().toISOString(),
        },
      ]);

      try {
        window.dispatchEvent(
          new CustomEvent("notif-unread", {
            detail: { sellerId, at: Date.now() },
          })
        );
      } catch {}

      timers.current[id] = setTimeout(() => {
        window.__TOAST_DEDUP_IDS?.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    };

    sock?.on("msg-receive", onIncoming);
    sock?.on("message", onIncoming);
    return () => {
      sock?.off("msg-receive", onIncoming);
      sock?.off("message", onIncoming);
    };
  }, [enabled, userId]);

  /** Generic app toasts */
  useEffect(() => {
    if (!enabled) return;

    const onAppToast = (e) => {
      const d = e?.detail || {};
      const id =
        d.id || `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      if (window.__TOAST_DEDUP_IDS?.has(id)) return;
      window.__TOAST_DEDUP_IDS?.add(id);

      setToasts((prev) => [
        ...prev,
        {
          id,
          kind: "generic",
          title: d.title || "Thông báo",
          text: d.text || "",
          type: d.type || "info",
          duration: Math.max(800, Number(d.duration) || 2500),
        },
      ]);
      timers.current[id] = setTimeout(() => {
        window.__TOAST_DEDUP_IDS?.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, Math.max(800, Number(d.duration) || 2500));
    };

    const onDismiss = (e) => {
      const id = e?.detail?.id;
      if (!id) return;
      clearTimeout(timers.current[id]);
      delete timers.current[id];
      window.__TOAST_DEDUP_IDS?.delete(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    window.addEventListener("app-toast", onAppToast);
    window.addEventListener("app-toast-dismiss", onDismiss);
    return () => {
      window.removeEventListener("app-toast", onAppToast);
      window.removeEventListener("app-toast-dismiss", onDismiss);
    };
  }, [enabled]);

  /** Confirm toasts (2 nút) */
  useEffect(() => {
    if (!enabled) return;
    const onConfirm = (e) => {
      const d = e?.detail || {};
      const id =
        d.id ||
        `confirm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      if (window.__TOAST_DEDUP_IDS?.has(id)) return;
      window.__TOAST_DEDUP_IDS?.add(id);

      setToasts((prev) => [
        ...prev,
        {
          id,
          kind: "confirm",
          title: d.title || "Xác nhận",
          text: d.text || "",
          confirmText: d.confirmText || "Đồng ý",
          cancelText: d.cancelText || "Hủy",
          type: d.type || "warning",
        },
      ]);
    };
    window.addEventListener("app-confirm", onConfirm);
    return () => window.removeEventListener("app-confirm", onConfirm);
  }, [enabled]);

  /** Dọn timer khi unmount */
  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach((tmr) => clearTimeout(tmr));
      timers.current = {};
    };
  }, []);

  const closeToast = (id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    window.__TOAST_DEDUP_IDS?.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const openChat = (t) => {
    if (!t?.sellerId) return;
    closeToast(t.id);
    const url = `/chat-shop?sellerId=${encodeURIComponent(
      t.sellerId
    )}&t=${Date.now()}`;
    navigate(url, {
      state: {
        sellerName: t.sellerName,
        sellerAvatar: t.avatar,
        from: "toast",
        jumpToBottom: true,
      },
    });
  };

  const sendConfirmAnswer = (id, ok) => {
    window.dispatchEvent(
      new CustomEvent("app-confirm-answer", { detail: { id, ok } })
    );
    closeToast(id);
  };

  const isOnChatPage = location.pathname === "/chat-shop";

  if (!enabled) return null;

  return (
    <div
      className="ct-toasts"
      style={{
        position: "fixed",
        top: 78,
        right: 14,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => {
        if (t.kind === "confirm") {
          return (
            <div
              key={t.id}
              className="ct-toast ct-toast--confirm"
              style={toastStyle(t.type)}
              onMouseEnter={() => clearTimeout(timers.current[t.id])}
            >
              <div style={{ display: "grid", gap: 6, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.title}</div>
                {t.text ? <div>{t.text}</div> : null}
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button
                    style={btnStylePrimary}
                    onClick={() => sendConfirmAnswer(t.id, true)}
                  >
                    {t.confirmText || "Đồng ý"}
                  </button>
                  <button
                    style={btnStyleGhost}
                    onClick={() => sendConfirmAnswer(t.id, false)}
                  >
                    {t.cancelText || "Hủy"}
                  </button>
                </div>
              </div>
              <button
                onClick={() => closeToast(t.id)}
                aria-label="Đóng"
                style={closeBtnStyle}
              >
                ×
              </button>
            </div>
          );
        }

        if (t.kind === "generic") {
          return (
            <div
              key={t.id}
              className={`ct-toast ct-toast--${t.type || "info"}`}
              style={toastStyle(t.type)}
              onMouseEnter={() => clearTimeout(timers.current[t.id])}
              onMouseLeave={() => {
                timers.current[t.id] = setTimeout(() => closeToast(t.id), 1200);
              }}
            >
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                  {t.title || "Thông báo"}
                </div>
                {t.text ? <div>{t.text}</div> : null}
              </div>
              <button
                onClick={() => closeToast(t.id)}
                aria-label="Đóng"
                style={closeBtnStyle}
              >
                ×
              </button>
            </div>
          );
        }

        // kind === "chat"
        if (isOnChatPage) return null;
        return (
          <div
            key={t.id}
            className="ct-toast"
            style={toastStyle("info")}
            onClick={() => openChat(t)}
            onMouseEnter={() => clearTimeout(timers.current[t.id])}
            onMouseLeave={() => {
              timers.current[t.id] = setTimeout(() => closeToast(t.id), 1200);
            }}
          >
            <img
              src={t.avatar || "/img/default-shop.png"}
              alt={t.sellerName || "Shop"}
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                objectFit: "cover",
                marginRight: 8,
                flex: "0 0 auto",
              }}
            />
            <div style={{ display: "grid", gap: 2, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                Bạn có tin nhắn của <span>{t.sellerName || "Shop"}</span>
              </div>
              <div style={{ opacity: 0.9 }}>{t.text}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeToast(t.id);
              }}
              aria-label="Đóng"
              style={closeBtnStyle}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ===================== App toast bus (show/hide/confirm) ===================== */
const W = typeof window !== "undefined" ? window : globalThis;

if (!W.__appToastBus) {
  W.__appToastBus = {
    show({ title, text = "", type = "info", id, duration = 2500 }) {
      const toastId =
        id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      W.dispatchEvent(
        new CustomEvent("app-toast", {
          detail: { id: toastId, title, text, type, duration },
        })
      );
      return toastId;
    },

    hide(id) {
      if (!id) return;
      W.dispatchEvent(new CustomEvent("app-toast-dismiss", { detail: { id } }));
    },

    confirm({
      title = "Xác nhận",
      text = "",
      confirmText = "Đồng ý",
      cancelText = "Hủy",
      type = "warning",
    }) {
      return new Promise((resolve) => {
        const id = `confirm-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        const onAnswer = (e) => {
          if (e?.detail?.id !== id) return;
          W.removeEventListener("app-confirm-answer", onAnswer);
          resolve(!!e?.detail?.ok);
        };
        W.addEventListener("app-confirm-answer", onAnswer);
        W.dispatchEvent(
          new CustomEvent("app-confirm", {
            detail: { id, title, text, confirmText, cancelText, type },
          })
        );
      });
    },
  };
}

export const showToast = (opts) => W.__appToastBus.show(opts);
export const hideToast = (id) => W.__appToastBus.hide(id);
export const confirmToast = (opts) => W.__appToastBus.confirm(opts);
