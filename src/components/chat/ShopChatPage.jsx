// src/pages/chat/ShopChatPage.jsx
"use client";

import { useEffect, useMemo, useRef, useState, useContext } from "react";
import { useLocation } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../config/api";
import "../../styles/chat-shop.css";
import {
  sendMediaMessage,
  fetchLastMessages,
  fetchMessagesBetween,
} from "../../services/chatShop";

/* ✅ ĐK web component emoji picker (bắt buộc) */
import "emoji-picker-element";

/** ✅ Realtime chuẩn */
import {
  initSocket as initRealtime,
  getSocket,
  onTyping,
  onStopTyping,
  onMessage,
  join,
  emitTyping,
  emitStopTyping,
} from "../../services/realtime";

// ✅ Lời chào tự động từ seller
const AUTO_GREETING =
  "Xin chào! b vui lòng chờ shop rep tin nhắn nếu shop có rep muộn thì mong bạn thông cảm, bên mình sẽ rep nhanh nhất trong ngày nhé ạ. vui lòng chờ trong lúc shop nghỉ trưa và tan làm chiều tối. Quy đinh của shopping cấm giao dịch ngoài nên Quý khách vui lòng không nhắn tin hỏi địa chỉ mua trực tiếp ở đây";

// ✅ Key tránh chèn lặp
const greetKey = (sellerId, userId) => `greeted:${sellerId}->${userId}`;

// Helper parse/encode product message
const PRODUCT_PREFIX = "[PRODUCT]";

function encodeProductMessage(product) {
  if (!product) return "";
  const id =
    product.id ||
    product.productId ||
    product._id ||
    product.slug ||
    product.code ||
    "";
  const name = product.name || product.productName || "";
  const priceText = product.priceText || product.price || "";
  const link = product.link || "";
  const image =
    product.image ||
    product.thumbnail ||
    product.imageUrl ||
    product.cover ||
    "";
  // đơn giản: tách bằng |||
  return `${PRODUCT_PREFIX} ${id}|||${name}|||${priceText}|||${link}|||${image}`;
}

function decodeProductMessage(message) {
  if (typeof message !== "string") return null;
  if (!message.startsWith(PRODUCT_PREFIX)) return null;
  try {
    const payload = message.slice(PRODUCT_PREFIX.length).trim();
    const [id, name, price, link, image] = payload.split("|||");
    return {
      id: id || null,
      name: name || "",
      price: price || "",
      link: link || "",
      image: image || "",
    };
  } catch {
    return null;
  }
}

export default function ShopChatPage({ initialSellerId }) {
  // Emoji & textarea
  const [showEmoji, setShowEmoji] = useState(false);
  const pickerRef = useRef(null);
  const textareaRef = useRef(null);

  const { authFetch } = useContext(AuthContext) || {};
  const location = useLocation();
  const locationState = location.state || {};
  const initialProduct = locationState.initialProduct || null;

  const sellerIdFromQuery =
    new URLSearchParams(location.search).get("sellerId") || "";
  const sellerIdFromState = locationState.sellerId || "";
  let bootstrapSellerId =
    sellerIdFromQuery || sellerIdFromState || initialSellerId || "";

  const stateName = locationState.sellerName || "";
  const stateAvatar = locationState.sellerAvatar || "";

  const [userId, setUserId] = useState("");
  const [mySellerId, setMySellerId] = useState("");

  const metaCacheRef = useRef(new Map());
  const sentProductRef = useRef(null); // ✅ chặn gửi 2 lần cùng 1 sản phẩm

  const [conversations, setConversations] = useState([]);
  const [activeCid, setActiveCid] = useState("");
  const activeConv = conversations.find((c) => c.id === activeCid) || null;

  const [msgs, setMsgs] = useState({});
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  const bodyRef = useRef(null);

  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState("");
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);

  const getToken = () =>
    localStorage.getItem("token") || localStorage.getItem("access_token") || "";

  const fetchSellerMeta = async (sellerId) => {
    if (!sellerId) return { name: "Shop", avatar: "/img/default-shop.png" };
    if (metaCacheRef.current.has(sellerId)) {
      return metaCacheRef.current.get(sellerId);
    }
    try {
      const res = await fetch(
        apiUrl(API_CONFIG.endpoints.searchSellerBySellerId(sellerId)),
        {
          headers: { Accept: "application/json" },
        }
      );
      const data = await res.json().catch(() => ({}));
      const shop = data?.result || {};
      const meta = {
        name: shop.shop_name || "Shop",
        avatar: shop.avatar_link || "/img/default-shop.png",
      };
      metaCacheRef.current.set(sellerId, meta);
      return meta;
    } catch {
      const fallback = { name: "Shop", avatar: "/img/default-shop.png" };
      metaCacheRef.current.set(sellerId, fallback);
      return fallback;
    }
  };

  // 1) Lấy userId (+ mySellerId nếu có)
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (!authFetch) return;

        const resP = await authFetch(
          apiUrl(API_CONFIG.endpoints.getMyProfile),
          {
            method: "GET",
            headers: { Accept: "application/json" },
          }
        );
        const dataP = await resP.json().catch(() => ({}));
        if (!resP.ok) throw new Error(dataP?.message || `HTTP ${resP.status}`);
        const uid = dataP?.result?.id;
        if (!uid) throw new Error("Không lấy được userId.");
        if (!cancel) setUserId(uid);

        const resS = await authFetch(
          apiUrl(API_CONFIG.endpoints.searchSellerByUserId(uid)),
          {
            method: "GET",
            headers: { Accept: "application/json" },
          }
        );
        const dataS = await resS.json().catch(() => ({}));
        if (resS.ok && dataS?.result?.id && !cancel) {
          setMySellerId(dataS.result.id);
        }
      } catch (e) {
        console.error("Load userId failed:", e);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [authFetch]);

  /** 2) Socket init – đăng ký userId trước */
  useEffect(() => {
    if (!userId) return;
    const token = getToken();
    initRealtime(userId, token); // auth.userId
  }, [userId]);

  /** 2b) Đăng ký thêm sellerId (của chính mình) nhưng chặn bootstrap self */
  useEffect(() => {
    if (!mySellerId) return;
    join(mySellerId);
    if (bootstrapSellerId === mySellerId) {
      bootstrapSellerId = "";
    }
  }, [mySellerId]);

  const fromTo = useMemo(() => {
    if (!activeConv) return { from: "", to: "" };
    if (activeConv.type === "seller") {
      if (activeConv.targetId === mySellerId) return { from: "", to: "" };
      return { from: userId, to: activeConv.targetId };
    }
    return { from: "", to: "" };
  }, [activeConv, userId, mySellerId]);

  /** Lắng nghe socket events (bỏ qua self) */
  useEffect(() => {
    if (!userId) return;

    const iAmAny = (id) => [userId, mySellerId].filter(Boolean).includes(id);

    const handleTyping = ({ from, to }) => {
      if (iAmAny(to) && from === activeConv?.targetId) {
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      }
    };

    const handleStopTyping = ({ from, to }) => {
      if (iAmAny(to) && from === activeConv?.targetId) {
        setIsTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      }
    };

    const handleIncoming = (payload) => {
      const senderId = payload?.from;
      if (!senderId || !iAmAny(payload?.to)) return;
      // ❌ Không nhận tự chat (seller của chính mình)
      if (senderId === mySellerId) return;

      const cid = `c-${senderId}`;

      const filesArr =
        (Array.isArray(payload.fileUrls) && payload.fileUrls.length > 0
          ? payload.fileUrls
          : Array.isArray(payload.files)
          ? payload.files
          : []) || [];

      const product = decodeProductMessage(payload.message);
      const lastText = product
        ? `Sản phẩm: ${product.name || "?"}`
        : (payload.message && String(payload.message)) ||
          (payload.emoji ? `(${payload.emoji})` : "") ||
          (filesArr.length ? "[tệp]" : "—");

      setMsgs((prev) => ({
        ...prev,
        [cid]: [
          ...(prev[cid] || []),
          {
            role: "them",
            text: lastText,
            product,
            files: filesArr,
            createdAt: payload.createdAt || new Date().toISOString(),
          },
        ],
      }));

      const timeStr = new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });

      setConversations((prev) => {
        const exists = prev.find((c) => c.id === cid);
        if (exists) {
          return prev.map((c) =>
            c.id === cid
              ? {
                  ...c,
                  last: product ? `Sản phẩm: ${product.name}` : lastText,
                  time: timeStr,
                }
              : c
          );
        }
        return [
          {
            id: cid,
            type: "seller",
            targetId: senderId,
            name: senderId,
            avatar: "/img/default-shop.png",
            last: product ? `Sản phẩm: ${product.name}` : lastText,
            time: timeStr,
          },
          ...prev,
        ];
      });
    };

    onTyping(handleTyping);
    onStopTyping(handleStopTyping);
    onMessage(handleIncoming);

    return () => {
      const sock = getSocket();
      sock?.off("typing", handleTyping);
      sock?.off("stop-typing", handleStopTyping);
      sock?.off("msg-receive", handleIncoming);
      sock?.off("message", handleIncoming);
    };
  }, [userId, mySellerId, activeConv?.targetId]);

  // 3) Load danh sách hội thoại (lọc self)
  useEffect(() => {
    if (!userId) return;
    let ignore = false;
    (async () => {
      try {
        const token = getToken();
        const raw = await fetchLastMessages({ token, actorId: userId });

        const mapped = await Promise.all(
          raw
            .map((it) => {
              const otherId = (it.users || []).find((u) => u !== userId) || "";
              return otherId && otherId !== mySellerId ? it : null; // ❌ lọc self
            })
            .filter(Boolean)
            .map(async (it) => {
              const otherId = (it.users || []).find((u) => u !== userId) || "";
              const meta = await fetchSellerMeta(otherId);
              const hasFiles =
                Array.isArray(it.fileUrls) && it.fileUrls.length > 0;

              const product = decodeProductMessage(it.message);
              const lastText = product
                ? `Sản phẩm: ${product.name || "?"}`
                : it.message && String(it.message).trim()
                ? it.message
                : hasFiles
                ? "[tệp]"
                : it.emoji
                ? it.emoji
                : "—";

              return {
                id: `c-${otherId}`,
                type: "seller",
                targetId: otherId,
                name: meta.name,
                avatar: meta.avatar,
                last: lastText,
                time: formatTime(it.createdAt),
              };
            })
        );

        const ensureBootstrap = async (list) => {
          if (!bootstrapSellerId || bootstrapSellerId === mySellerId) return list; // ❌ không bootstrap self
          const existed = list.find((c) => c.targetId === bootstrapSellerId);
          const cached = metaCacheRef.current.get(bootstrapSellerId);
          const fetched = cached || (await fetchSellerMeta(bootstrapSellerId));
          const initMeta = {
            name: stateName || fetched.name,
            avatar: stateAvatar || fetched.avatar,
          };
          if (existed) {
            existed.name = existed.name || initMeta.name;
            existed.avatar = existed.avatar || initMeta.avatar;
            return [existed, ...list.filter((c) => c !== existed)];
          }
          const newC = {
            id: `c-${bootstrapSellerId}`,
            type: "seller",
            targetId: bootstrapSellerId,
            name: initMeta.name,
            avatar: initMeta.avatar,
            last: "—",
            time: "",
          };
          return [newC, ...list];
        };

        const finalList = await ensureBootstrap(mapped);

        if (!ignore) {
          setConversations(finalList);
          setActiveCid(
            (prev) =>
              prev ||
              (bootstrapSellerId
                ? `c-${bootstrapSellerId}`
                : finalList[0]?.id) ||
              ""
          );
        }
      } catch (e) {
        console.error("Load conversations failed:", e);
        if (bootstrapSellerId && bootstrapSellerId !== mySellerId) {
          const meta = await fetchSellerMeta(bootstrapSellerId);
          const fallback = [
            {
              id: `c-${bootstrapSellerId}`,
              type: "seller",
              targetId: bootstrapSellerId,
              name: stateName || meta.name,
              avatar: stateAvatar || meta.avatar,
              last: "—",
              time: "",
            },
          ];
          if (!ignore) {
            setConversations(fallback);
            setActiveCid(fallback[0].id);
          }
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [userId, mySellerId, bootstrapSellerId, stateName, stateAvatar]);

  // 4) Load messages khi đổi hội thoại
  useEffect(() => {
    if (!activeConv || !userId) return;
    const cid = activeConv.id;
    if (msgs[cid]?.length) return;

    // ❌ không load nếu self
    if (activeConv.targetId === mySellerId) return;

    let ignore = false;
    (async () => {
      try {
        setLoadingMsgs(true);
        const token = getToken();
        const list = await fetchMessagesBetween({
          token,
          from: userId,
          to: activeConv.targetId,
        });
        const formatted = list.map((m) => {
          const hasFiles = Array.isArray(m.fileUrls) && m.fileUrls.length > 0;
          const product = decodeProductMessage(m.message);

          const baseText = product
            ? `Sản phẩm: ${product.name || "?"}`
            : (m.message && String(m.message)) ||
              (m.emoji ? `(${m.emoji})` : "") ||
              (hasFiles ? "[tệp]" : "");

          return {
            role: m.fromSelf ? "user" : "them",
            text: baseText,
            product,
            files: hasFiles ? m.fileUrls : product?.image ? [product.image] : [],
            createdAt: m.createdAt,
          };
        });
        if (!ignore) {
          setMsgs((prev) => ({ ...prev, [cid]: formatted }));
        }
      } catch (e) {
        console.error("Load messages failed:", e);
        if (!ignore) setMsgs((prev) => ({ ...prev, [cid]: [] }));
      } finally {
        if (!ignore) setLoadingMsgs(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [activeCid, activeConv, userId, mySellerId]);

  // 4b) Chèn auto greeting (không greet self)
  useEffect(() => {
    if (!userId || !bootstrapSellerId || !activeConv) return;
    if (!locationState.autoGreet) return;
    if (bootstrapSellerId === mySellerId) return;

    const cid = activeConv.id;
    const already = sessionStorage.getItem(greetKey(bootstrapSellerId, userId));
    const isEmpty = !Array.isArray(msgs[cid]) || msgs[cid].length === 0;
    if (already || !isEmpty) return;

    const nowIso = new Date().toISOString();
    const nowTime = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const greetingMsg = {
      role: "them",
      text: AUTO_GREETING,
      files: [],
      createdAt: nowIso,
    };

    setMsgs((prev) => ({
      ...prev,
      [cid]: [...(prev[cid] || []), greetingMsg],
    }));

    setConversations((prev) =>
      prev.map((c) =>
        c.id === cid ? { ...c, last: AUTO_GREETING, time: nowTime } : c
      )
    );

    sessionStorage.setItem(greetKey(bootstrapSellerId, userId), "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    userId,
    bootstrapSellerId,
    activeConv,
    activeCid,
    msgs,
    mySellerId,
    locationState.autoGreet,
  ]);

  // 4c) Auto gửi thông tin sản phẩm từ trang chi tiết (chỉ 1 lần / sản phẩm)
  useEffect(() => {
    if (!initialProduct) return;
    if (!activeConv || !fromTo.from || !fromTo.to) return;

    const productId =
      initialProduct.id ||
      initialProduct.productId ||
      initialProduct._id ||
      initialProduct.slug ||
      initialProduct.code ||
      null;

    // đã gửi product này rồi thì thôi
    if (productId && sentProductRef.current === productId) return;

    // đánh dấu đã gửi
    if (productId) {
      sentProductRef.current = productId;
    } else {
      // fallback nếu không có id
      sentProductRef.current = "__SENT__";
    }

    const name = initialProduct.name || initialProduct.productName || "";
    const priceValue =
      initialProduct.priceText || initialProduct.price || initialProduct.displayPrice || "";
    const priceText =
      typeof priceValue === "number"
        ? priceValue.toLocaleString("vi-VN") + "₫"
        : priceValue || "";

    const link =
      initialProduct.link ||
      `${window.location.origin}/product/${
        initialProduct.slug || initialProduct.id || ""
      }`;

    const image =
      initialProduct.image ||
      initialProduct.thumbnail ||
      initialProduct.imageUrl ||
      initialProduct.cover ||
      "";

    const productPayload = {
      id: productId,
      name,
      priceText,
      link,
      image,
    };

    const encoded = encodeProductMessage(productPayload);

    (async () => {
      try {
        const token = getToken();

        const resp = await sendMediaMessage({
          token,
          from: fromTo.from,
          to: fromTo.to,
          text: encoded,
          emoji: "",
          files: [],
        });

        const createdAt =
          resp?.message?.createdAt || new Date().toISOString();

        const newMsg = {
          role: "user",
          text: `Sản phẩm: ${name}`,
          product: productPayload,
          files: image ? [image] : [],
          createdAt,
        };

        const timeStr = new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        });

        setMsgs((prev) => ({
          ...prev,
          [activeConv.id]: [...(prev[activeConv.id] || []), newMsg],
        }));

        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConv.id
              ? {
                  ...c,
                  last: `Sản phẩm: ${name}`,
                  time: timeStr,
                }
              : c
          )
        );
      } catch (e) {
        console.error("Auto send product failed:", e);
      }
    })();
  }, [initialProduct, activeConv, fromTo.from, fromTo.to]);

  // 5) Auto scroll
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [activeCid, msgs, isTyping]);

  // --- Typing helpers ---
  const emitTypingSafe = () => {
    const socket = getSocket();
    if (!socket || !fromTo.from || !fromTo.to) return;
    emitTyping({ from: fromTo.from, to: fromTo.to });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitStopTyping({ from: fromTo.from, to: fromTo.to });
    }, 1500);
  };

  const handleChangeText = (e) => {
    const val = e.target.value;
    setText(val);
    emitTypingSafe();
  };

  const doSend = async () => {
    const t = text.trim();
    if (!activeConv || !fromTo.from || !fromTo.to) return;
    if (!t && files.length === 0 && !emoji.trim()) return;
    if (fromTo.to === mySellerId) {
      alert("Bạn không thể nhắn tin với shop của chính bạn.");
      return;
    }

    // Tạo blob preview hiển thị ngay (nếu có ảnh)
    const previewUrls = files.map((f) => URL.createObjectURL(f));

    try {
      setSending(true);
      const token = getToken();

      const resp = await sendMediaMessage({
        token,
        from: fromTo.from,
        to: fromTo.to,
        text: t,
        emoji,
        files,
      });

      const uploadedUrls =
        resp?.message?.fileUrls && Array.isArray(resp.message.fileUrls)
          ? resp.message.fileUrls
          : null;

      const socket = getSocket();
      if (socket) {
        emitStopTyping({ from: fromTo.from, to: fromTo.to });
      }

      const newMsg = {
        role: "user",
        text:
          t ||
          (emoji ? `(${emoji})` : "") ||
          ((uploadedUrls || previewUrls).length ? "[tệp]" : ""),
        product: null,
        files: uploadedUrls || previewUrls,
        createdAt: resp?.message?.createdAt || new Date().toISOString(),
      };

      const timeStr = new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeCid
            ? { ...c, last: newMsg.text || "[tệp]", time: timeStr }
            : c
        )
      );
      setMsgs((prev) => ({
        ...prev,
        [activeCid]: [...(prev[activeCid] || []), newMsg],
      }));
      setText("");
      setEmoji("");
      setFiles([]);
    } catch (e) {
      console.error("Send message failed:", e);
      alert(e?.message || "Gửi tin thất bại");
    } finally {
      setSending(false);
    }
  };

  const handlePickFiles = (e) => {
    const f = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...f]);
  };

  const removeFile = (i) =>
    setFiles((prev) => prev.filter((_, idx) => idx !== i));

  // ✅ Emoji insert tại con trỏ + fix close popover với Shadow DOM
  const insertAtCursor = (emojiStr) => {
    const el = textareaRef.current;
    if (!el) {
      setText((prev) => prev + emojiStr);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = text.slice(0, start) + emojiStr + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emojiStr.length;
      el.setSelectionRange(pos, pos);
    });
  };

  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;

    const onEmojiClick = (e) => {
      const emojiStr = e.detail?.unicode || e.detail?.emoji?.unicode || "";
      if (emojiStr) insertAtCursor(emojiStr);
    };
    picker.addEventListener("emoji-click", onEmojiClick);

    const onDocClick = (e) => {
      if (!showEmoji) return;
      const path = e.composedPath ? e.composedPath() : [];
      const clickedInsidePicker =
        pickerRef.current && path.includes(pickerRef.current);
      const clickedToggle =
        e.target.closest && e.target.closest(".cs-emoji-toggle");
      if (!clickedInsidePicker && !clickedToggle) {
        setShowEmoji(false);
      }
    };
    const onEsc = (e) => e.key === "Escape" && setShowEmoji(false);

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);

    return () => {
      picker.removeEventListener("emoji-click", onEmojiClick);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [showEmoji, text]);

  // Gửi stop-typing khi đổi hội thoại
  useEffect(() => {
    const s = getSocket();
    return () => {
      if (s && fromTo.from && fromTo.to) {
        emitStopTyping({ from: fromTo.from, to: fromTo.to });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCid]);

  return (
    <div className="cs-root">
      <aside className="cs-sidebar">
        <div className="cs-search">
          <input placeholder="Tìm theo tên" />
        </div>
        <div className="cs-filter">
          <select defaultValue="all">
            <option value="all">Tất cả</option>
            <option value="unread">Chưa đọc</option>
          </select>
        </div>

        <div className="cs-conv-list">
          {conversations.map((c) => (
            <button
              key={c.id}
              className={`cs-conv-item ${activeCid === c.id ? "active" : ""}`}
              onClick={() => setActiveCid(c.id)}
              title={c.name || "Shop"}
            >
              <div className="cs-avatar">
                {c.avatar ? (
                  <img
                    src={c.avatar}
                    alt={c.name || "Shop"}
                    className="cs-avatar-img"
                  />
                ) : (
                  <span>{(c.name || "S")[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="cs-conv-main">
                <div className="cs-conv-top">
                  <span className="cs-name">{c.name || "Shop"}</span>
                  <span className="cs-time">{c.time}</span>
                </div>
                <div className="cs-last">{c.last}</div>
              </div>
            </button>
          ))}
          {conversations.length === 0 && (
            <div style={{ padding: 12, color: "#6b7280" }}>
              Chưa có cuộc trò chuyện.
            </div>
          )}
        </div>
      </aside>

      <section className="cs-chat">
        <div className="cs-header">
          <div className="cs-prod">
            {activeConv?.avatar ? (
              <img
                className="thumb"
                src={activeConv.avatar}
                alt={activeConv.name || "Shop"}
              />
            ) : (
              <div className="thumb" />
            )}
            <div className="meta">
              <div className="title">{activeConv?.name || "Shop"}</div>
              <div className="price" style={{ color: "#6b7280" }}>
                ID: {activeConv?.targetId || "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="cs-body" ref={bodyRef}>
          {loadingMsgs && !(msgs[activeCid]?.length > 0) ? (
            <div style={{ color: "#6b7280", padding: 8 }}>Đang tải…</div>
          ) : (msgs[activeCid] || []).length === 0 ? (
            <div style={{ color: "#6b7280", padding: 8 }}>
              Chưa có tin nhắn.
            </div>
          ) : (
            (msgs[activeCid] || []).map((m, idx) => (
              <div
                key={idx}
                className={`cs-bubble ${m.role === "user" ? "me" : "them"}`}
              >
                <div className="bubble">
                  {/* ✅ Card sản phẩm nếu có */}
                  {m.product && (
                    <div className="cs-product-card">
                      <div className="cs-product-thumb-wrap">
                        {m.product.image ? (
                          <img
                            src={m.product.image}
                            alt={m.product.name || "Sản phẩm"}
                            className="cs-product-thumb"
                          />
                        ) : (
                          <div className="cs-product-thumb placeholder" />
                        )}
                      </div>
                      <div className="cs-product-meta">
                        <div className="cs-product-tag">
                          Sản phẩm bạn đang hỏi
                        </div>
                        <div className="cs-product-name">
                          {m.product.name || "Sản phẩm"}
                        </div>
                        {m.product.price && (
                          <div className="cs-product-price">
                            {m.product.price}
                          </div>
                        )}
                        {m.product.link && (
                          <a
                            href={m.product.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cs-product-link"
                          >
                            Xem chi tiết sản phẩm
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Text chính */}
                  {m.text && (
                    <div className="cs-message-text">{m.text}</div>
                  )}

                  {/* File/ảnh đính kèm – bỏ qua nếu đã hiển thị trong card sản phẩm */}
                  {m.files?.length && !m.product ? (
                    <div className="files">
                      {(Array.isArray(m.files) ? m.files : [m.files]).map(
                        (file, i) => {
                          const s = String(file || "");
                          const isImage =
                            /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(s) ||
                            s.startsWith("http") ||
                            s.startsWith("blob:");

                          return isImage ? (
                            <img
                              key={i}
                              src={s}
                              alt="Ảnh"
                              style={{
                                maxWidth: "200px",
                                maxHeight: "200px",
                                borderRadius: "8px",
                                marginTop: "8px",
                                display: "block",
                              }}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                e.currentTarget.insertAdjacentHTML(
                                  "afterend",
                                  `<div>Tệp: ${s}</div>`
                                );
                              }}
                            />
                          ) : (
                            <div key={i}>Tệp: {s}</div>
                          );
                        }
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}

          {isTyping && activeConv && (
            <div className="cs-bubble them">
              <div className="bubble">
                <span className="typing-dots">● ● ●</span>
              </div>
            </div>
          )}
        </div>

        {/* ✅ đảm bảo container tương đối để popover định vị chuẩn */}
        <div className="cs-input">
          <div className="cs-icons">
            <label className="ico" title="Hình ảnh">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePickFiles}
              />
              <svg viewBox="0 0 24 24">
                <path
                  d="M4 5h16v14H4V5zm2 2v10h12V7H6zm3 2l2 3 3-4 4 6H7l2-5z"
                  fill="currentColor"
                />
              </svg>
            </label>
            <button
              className="ico cs-emoji-toggle"
              type="button"
              title="Emoji"
              aria-label="Chọn emoji"
              onClick={() => setShowEmoji((v) => !v)}
            >
              <span className="emoji-face" aria-hidden="true">
                😀
              </span>
            </button>

            {showEmoji && (
              <div className="cs-emoji-popover">
                <emoji-picker
                  ref={pickerRef}
                  locale="vi"
                  class="cs-emoji-picker"
                />
              </div>
            )}
          </div>

          {/* nhập + typing */}
          <textarea
            ref={textareaRef}
            className="cs-textarea"
            placeholder="Nhập nội dung tin nhắn"
            value={text}
            onChange={handleChangeText}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                doSend();
              } else {
                emitTypingSafe();
              }
            }}
            onBlur={() => {
              const s = getSocket();
              if (s && fromTo.from && fromTo.to) {
                emitStopTyping({ from: fromTo.from, to: fromTo.to });
              }
            }}
          />

          <button
            className="cs-send"
            onClick={doSend}
            disabled={sending || (!text.trim() && !files.length && !emoji)}
            title={sending ? "Đang gửi..." : "Gửi"}
          >
            <svg viewBox="0 0 24 24">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="#fff" />
            </svg>
          </button>
        </div>

        {files.length > 0 && (
          <div className="cs-attachments">
            {files.map((f, i) => (
              <span key={i} className="chip">
                {f.name}
                <button onClick={() => removeFile(i)} title="Xóa">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    return sameDay
      ? d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("vi-VN");
  } catch {
    return "";
  }
}
