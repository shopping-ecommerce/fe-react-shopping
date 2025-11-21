// src/pages/account/AccountNotifications.jsx
"use client";

import React, { useEffect, useMemo, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../../config/api";
import { initSocket as initRealtime, getSocket } from "../../../services/realtime";
import {
  fetchNotificationsByUser,
  fetchUnreadCount,
  markNotificationRead,
  markAllAsRead,
} from "../../../services/notificationService";
import "../../../styles/Notifications.css";

/* LocalStorage theo user (chat) */
const STORAGE_KEY = (uid) => `notif_messages_v1_${uid || "guest"}`;
const loadNotifs = (uid) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(uid));
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};
const saveNotifs = (uid, list) => {
  try {
    localStorage.setItem(STORAGE_KEY(uid), JSON.stringify(list || []));
    // kích hoạt header badge cập nhật (cross-tab listener)
    window.dispatchEvent(
      new StorageEvent("storage", { key: STORAGE_KEY(uid) })
    );
  } catch {}
};

/* helpers (ui) */
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

/* lấy meta shop */
async function fetchSellerMeta(sellerId) {
  if (!sellerId) return { name: "Shop", avatar: "/img/default-shop.png" };
  try {
    const res = await fetch(
      apiUrl(API_CONFIG.endpoints.searchSellerBySellerId(sellerId)),
      {
        headers: { Accept: "application/json" },
      }
    );
    const data = await res.json().catch(() => ({}));
    const shop = data?.result || {};
    return {
      name: shop.shop_name || "Shop",
      avatar: shop.avatar_link || "/img/default-shop.png",
    };
  } catch {
    return { name: "Shop", avatar: "/img/default-shop.png" };
  }
}

export default function AccountNotifications() {
  const { authFetch } = useContext(AuthContext) || {};
  const navigate = useNavigate();

  const [userId, setUserId] = useState("");
  const [mySellerId, setMySellerId] = useState("");

  // Chat (local)
  const [itemsChat, setItemsChat] = useState([]);
  const [loadingChat, setLoadingChat] = useState(true);

  // Order (BE)
  const [itemsOrder, setItemsOrder] = useState([]);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [unreadOrder, setUnreadOrder] = useState(0);

  // 🔹 Phân trang cho thông báo đơn hàng
  const [pageOrder, setPageOrder] = useState(0);   // 0-based
  const [sizeOrder, setSizeOrder] = useState(10);  // số item mỗi trang

  // B1: lấy userId & mySellerId
  useEffect(() => {
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
        if (!uid) throw new Error("Không lấy được userId");
        if (cancelled) return;

        setUserId(uid);

        // Lấy sellerId của chính user (nếu có)
        try {
          const rs = await authFetch(
            apiUrl(API_CONFIG.endpoints.searchSellerByUserId(uid)),
            {
              method: "GET",
              headers: { Accept: "application/json" },
            }
          );
          const ds = await rs.json().catch(() => ({}));
          if (rs.ok && ds?.result?.id) setMySellerId(ds.result.id);
        } catch {}
      } catch (e) {
        console.error("Load userId failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // B2: nạp dữ liệu (chat local & order BE) — có mySellerId để lọc self
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        // CHAT (local)
        setLoadingChat(true);
        let loaded = loadNotifs(userId).sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        // ❌ Lọc bỏ thông báo chat tự gửi (sellerId === mySellerId)
        if (mySellerId) loaded = loaded.filter((x) => x.sellerId !== mySellerId);
        if (!cancelled) {
          setItemsChat(loaded);
          setLoadingChat(false);
        }

        // ORDER (BE) — hiện tại vẫn lấy 1 mẻ rồi phân trang ở FE
        setLoadingOrder(true);
        const { items } = await fetchNotificationsByUser(authFetch, userId, {
          page: 0,
          size: 50,
        });
        const sorted = [...(items || [])].sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        const c = await fetchUnreadCount(authFetch, userId);
        if (!cancelled) {
          setItemsOrder(sorted);
          setUnreadOrder(c);
          setLoadingOrder(false);
          setPageOrder(0); // reset về trang 1 mỗi lần load mới
        }
      } catch (e) {
        console.error("Load notifications failed:", e);
        if (!cancelled) {
          setLoadingChat(false);
          setLoadingOrder(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, mySellerId, authFetch]);

  // Socket: chat (dùng realtime.js) — bỏ qua self
  useEffect(() => {
    if (!userId) return;

    // mở/kích hoạt socket cho userId
    initRealtime(userId);

    const sock = getSocket();

    const handleIncoming = async (payload) => {
      if (!payload?.from || payload?.to !== userId) return;
      const sellerId = payload.from;
      // ❌ Bỏ qua nếu sellerId = shop của chính user
      if (mySellerId && sellerId === mySellerId) return;

      const meta = await fetchSellerMeta(sellerId);

      const notif = {
        id: `${sellerId}-${payload.createdAt || Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        type: "seller_message",
        sellerId,
        sellerName: meta?.name || "Shop",
        sellerAvatar: meta?.avatar || "/img/default-shop.png",
        title: "Tin nhắn mới từ shop",
        text: previewText(payload),
        createdAt: payload.createdAt || new Date().toISOString(),
        read: false,
      };

      setItemsChat((prev) => {
        const next = [notif, ...prev].slice(0, 300);
        saveNotifs(userId, next);
        return next;
      });
    };

    sock?.on("msg-receive", handleIncoming);
    sock?.on("message", handleIncoming);
    return () => {
      sock?.off("msg-receive", handleIncoming);
      sock?.off("message", handleIncoming);
    };
  }, [userId, mySellerId]);

  // CHAT: lấy bản mới nhất mỗi seller, rồi sắp xếp Unread → Date desc
  const latestPerSeller = useMemo(() => {
    const map = new Map();
    for (const it of itemsChat) {
      if (it.type !== "seller_message" || !it.sellerId) continue;
      if (mySellerId && it.sellerId === mySellerId) continue; // ❌ bỏ self
      if (!map.has(it.sellerId)) map.set(it.sellerId, it); // itemsChat đang mới → cũ
    }
    const arr = Array.from(map.values());
    return arr.sort((a, b) => {
      const ua = a.read ? 0 : 1;
      const ub = b.read ? 0 : 1;
      if (ub !== ua) return ub - ua; // unread trước
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [itemsChat, mySellerId]);
  const unreadChat = useMemo(
    () => latestPerSeller.filter((x) => !x.read).length,
    [latestPerSeller]
  );

  // ORDER: sắp xếp Unread → Date desc (trước khi render)
  const itemsOrderSorted = useMemo(() => {
    return [...itemsOrder].sort((a, b) => {
      const ua = a.status !== "READ" ? 1 : 0;
      const ub = b.status !== "READ" ? 1 : 0;
      if (ub !== ua) return ub - ua; // unread trước
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [itemsOrder]);

  // 🔹 Tính tổng số trang và slice item theo trang cho ORDER
  const totalPagesOrder = useMemo(() => {
    if (!itemsOrderSorted.length) return 0;
    return Math.max(1, Math.ceil(itemsOrderSorted.length / sizeOrder));
  }, [itemsOrderSorted.length, sizeOrder]);

  // nếu đổi size / dữ liệu ít lại thì đảm bảo pageOrder không vượt quá totalPagesOrder
  useEffect(() => {
    if (!totalPagesOrder) {
      setPageOrder(0);
      return;
    }
    setPageOrder((prev) => Math.min(prev, totalPagesOrder - 1));
  }, [totalPagesOrder]);

  const pagedOrderItems = useMemo(() => {
    if (!itemsOrderSorted.length) return [];
    const start = pageOrder * sizeOrder;
    return itemsOrderSorted.slice(start, start + sizeOrder);
  }, [itemsOrderSorted, pageOrder, sizeOrder]);

  const handleJumpOrderPage = (val) => {
    const total = totalPagesOrder || 1;
    const n = Math.max(1, Math.min(total, Number(val) || 1));
    setPageOrder(n - 1);
  };

  // Actions: chat
  const markReadBySeller = (sellerId) => {
    setItemsChat((prev) => {
      const next = prev.map((it) =>
        it.sellerId === sellerId ? { ...it, read: true } : it
      );
      saveNotifs(userId, next);
      return next;
    });
  };
  const markAllReadChat = () => {
    setItemsChat((prev) => {
      const next = prev.map((it) => ({ ...it, read: true }));
      saveNotifs(userId, next);
      return next;
    });
  };
  const removeBySeller = (sellerId) => {
    setItemsChat((prev) => {
      const next = prev.filter((it) => it.sellerId !== sellerId);
      saveNotifs(userId, next);
      return next;
    });
  };
  const clearAllChat = () => {
    if (!window.confirm("Xoá tất cả thông báo tin nhắn?")) return;
    saveNotifs(userId, []);
    setItemsChat([]);
  };
  const goToChat = (sellerId, sellerName = "", sellerAvatar = "") => {
    if (!sellerId) return;
    const ts = Date.now();
    navigate(`/chat-shop?sellerId=${encodeURIComponent(sellerId)}&t=${ts}`, {
      state: {
        sellerName,
        sellerAvatar,
        forceReload: true,
        jumpToBottom: true,
        from: "notif",
        ts,
      },
    });
  };

  // Actions: order
  const onClickOrderItem = async (it) => {
    try {
      if (it?.status !== "READ") {
        await markNotificationRead(authFetch, it.id);
        setItemsOrder((prev) =>
          prev.map((x) => (x.id === it.id ? { ...x, status: "READ" } : x))
        );
        setUnreadOrder((c) => Math.max(0, c - 1));
      }
    } catch {}
    const link = it?.content?.link;
    navigate(typeof link === "string" && link ? link : "/orders");
  };
  const markAllOrder = async () => {
    try {
      await markAllAsRead(authFetch, userId);
      setItemsOrder((prev) => prev.map((x) => ({ ...x, status: "READ" })));
      setUnreadOrder(0);
    } catch (e) {
      alert(e?.message || "Đánh dấu đã đọc hết thất bại");
    }
  };

  return (
    <div className="account-notif-page">
      <div className="card">
        {/* ===== CHAT (header + toolbar đứng yên) ===== */}
        <h3 style={{ margin: "12px 0 0" }}>
          Tin nhắn từ shop
          {unreadChat ? (
            <span className="unread-red"> • {unreadChat} chưa đọc</span>
          ) : (
            ""
          )}
        </h3>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            className="btn btn--primary"
            onClick={markAllReadChat}
            disabled={!latestPerSeller.length}
            title="Đánh dấu đã đọc hết (chat)"
          >
            Đã đọc hết (Chat)
          </button>
          <button
            className="btn btn--danger"
            onClick={clearAllChat}
            disabled={!latestPerSeller.length}
            title="Xoá tất cả thông báo tin nhắn"
          >
            Xoá tất cả (Chat)
          </button>
        </div>

        {/* ===== VÙNG CUỘN DUY NHẤT ===== */}
        <div className="notif-scroll">
          {/* Danh sách CHAT */}
          {loadingChat ? (
            <p>Đang tải…</p>
          ) : latestPerSeller.length === 0 ? (
            <p>Không có thông báo tin nhắn.</p>
          ) : (
            <ul
              className="notif-list"
              style={{
                listStyle: "none",
                padding: 0,
                margin: "12px 0 0",
                display: "grid",
                gap: 12,
              }}
            >
              {latestPerSeller.map((it) => (
                <li
                  key={it.sellerId}
                  className={`notif-item notif--msg ${
                    !it.read ? "is-unread" : ""
                  }`}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 12,
                    background: it.read ? "#fff" : "#f9fafb",
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      {it.title || "Tin nhắn mới từ shop"}
                    </div>
                    <div style={{ color: "#374151", marginBottom: 6 }}>
                      {it.text}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {formatTime(it.createdAt)}
                      <span style={{ marginLeft: 8, color: "#9CA3AF" }}>
                        • Shop: {it.sellerName || it.sellerId}
                      </span>
                      {!it.read && (
                        <span style={{ marginLeft: 8, color: "#ef4444" }}>
                          • Chưa đọc
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn--primary"
                      onClick={() => {
                        markReadBySeller(it.sellerId);
                        goToChat(it.sellerId, it.sellerName, it.sellerAvatar);
                      }}
                      title="Xem chat"
                    >
                      Xem chat
                    </button>
                    {!it.read && (
                      <button
                        className="btn btn--light"
                        onClick={() => markReadBySeller(it.sellerId)}
                      >
                        Đã đọc
                      </button>
                    )}
                    <button
                      className="btn btn--ghost"
                      onClick={() => removeBySeller(it.sellerId)}
                    >
                      Xoá
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* ===== ORDER ===== */}
          <h3 style={{ margin: "16px 0 8px" }}>
            Thông báo đơn hàng
            {unreadOrder ? (
              <span className="unread-red"> • {unreadOrder} chưa đọc</span>
            ) : (
              ""
            )}
          </h3>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 8,
              justifyContent: "flex-end",
            }}
          >
            <button
              className="btn btn--primary"
              onClick={markAllOrder}
              disabled={!itemsOrderSorted.length}
              title="Đánh dấu đã đọc hết (đơn hàng)"
            >
              Đã đọc hết (Đơn hàng)
            </button>
          </div>

          {loadingOrder ? (
            <p>Đang tải…</p>
          ) : itemsOrderSorted.length === 0 ? (
            <p>Không có thông báo hệ thống.</p>
          ) : (
            <>
              <ul
                className="notif-list"
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "12px 0 0",
                  display: "grid",
                  gap: 12,
                }}
              >
                {pagedOrderItems.map((it) => (
                  <li
                    key={it.id}
                    className={`notif-item notif--system ${
                      it.status !== "READ" ? "is-unread" : ""
                    }`}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: 12,
                      background: it.status !== "READ" ? "#f9fafb" : "#fff",
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 8,
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                    onClick={() => onClickOrderItem(it)}
                    title="Mở chi tiết đơn"
                  >
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        {it.type === "MESSAGE" ? "Thông báo đơn hàng" : it.type}
                      </div>
                      <div style={{ color: "#374151", marginBottom: 6 }}>
                        {it?.content?.text || "Bạn có thông báo mới"}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {formatTime(it.createdAt)}
                        {it?.content?.orderId && (
                          <span style={{ marginLeft: 8, color: "#9CA3AF" }}>
                            • Mã đơn:{" "}
                            {String(it.content.orderId)
                              .slice(-8)
                              .toUpperCase()}
                          </span>
                        )}
                        {it.status !== "READ" && (
                          <span style={{ marginLeft: 8, color: "#ef4444" }}>
                            • Chưa đọc
                          </span>
                        )}
                      </div>
                    </div>

                    {it.status !== "READ" && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="btn btn--light"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await markNotificationRead(authFetch, it.id);
                              setItemsOrder((prev) =>
                                prev.map((x) =>
                                  x.id === it.id ? { ...x, status: "READ" } : x
                                )
                              );
                              setUnreadOrder((c) => Math.max(0, c - 1));
                            } catch (er) {
                              alert(
                                er?.message || "Đánh dấu đã đọc thất bại"
                              );
                            }
                          }}
                        >
                          Đã đọc
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {/* 🔹 Pager ORDER */}
              <div className="notif-pager">
                <div className="notif-pg-group">
                  <button
                    className="notif-pg-btn"
                    disabled={pageOrder <= 0}
                    onClick={() =>
                      setPageOrder((p) => Math.max(0, p - 1))
                    }
                  >
                    ← Trước
                  </button>
                  <div className="notif-pg-status">
                    <span>Trang</span>
                    <input
                      className="notif-page-input"
                      type="number"
                      min={1}
                      max={totalPagesOrder || 1}
                      value={totalPagesOrder === 0 ? 0 : pageOrder + 1}
                      onChange={(e) => handleJumpOrderPage(e.target.value)}
                    />
                    <span>/ {totalPagesOrder || 1}</span>
                  </div>
                  <button
                    className="notif-pg-btn"
                    disabled={
                      totalPagesOrder === 0 ||
                      pageOrder >= totalPagesOrder - 1
                    }
                    onClick={() =>
                      setPageOrder((p) =>
                        totalPagesOrder
                          ? Math.min(totalPagesOrder - 1, p + 1)
                          : p
                      )
                    }
                  >
                    Sau →
                  </button>
                </div>

                <div className="notif-size">
                  <span className="notif-size-label">Trang</span>
                  <select
                    className="notif-size-select"
                    value={sizeOrder}
                    onChange={(e) => {
                      setPageOrder(0);
                      setSizeOrder(Number(e.target.value) || 10);
                    }}
                  >
                    {[5, 10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>
        {/* /notif-scroll */}
      </div>
    </div>
  );
}
