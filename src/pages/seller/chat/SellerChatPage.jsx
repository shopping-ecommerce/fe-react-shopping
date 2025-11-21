// src/pages/seller/chat/SellerChatPage.jsx
"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "../../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../../config/api";
import "../../../styles/chat-shop.css";
import {
  sendMediaMessage,
  fetchLastMessages,
  fetchMessagesBetween,
} from "../../../services/chatShop";

import {
  initSocket as initRealtime,
  getSocket,
} from "../../../services/realtime";

// ====== Product helper (giống bên user) ======
const PRODUCT_PREFIX = "[PRODUCT]";

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

export default function SellerChatPage() {
  // Emoji
  const [showEmoji, setShowEmoji] = useState(false);
  const pickerRef = useRef(null);
  const textareaRef = useRef(null);

  const { authFetch } = useContext(AuthContext) || {};

  // Lưu cả userId đăng nhập của seller để initRealtime
  const [sellerUserId, setSellerUserId] = useState("");
  const [sellerId, setSellerId] = useState("");

  const [conversations, setConversations] = useState([]);
  const [activeCid, setActiveCid] = useState("");
  const activeConv = conversations.find((c) => c.id === activeCid) || null;

  const [msgs, setMsgs] = useState({});
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState("");
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);

  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  const bodyRef = useRef(null);

  const getToken = () =>
    localStorage.getItem("token") || localStorage.getItem("access_token") || "";

  const userMetaCacheRef = useRef(new Map());

  async function fetchUserMeta(userId) {
    if (!userId) return { name: "Khách", avatar: "/img/default-user.png" };
    if (userMetaCacheRef.current.has(userId)) {
      return userMetaCacheRef.current.get(userId);
    }
    try {
      const res = await fetch(
        `http://localhost:8888/shopping/api/info/profiles/${encodeURIComponent(
          userId
        )}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.code !== 0) throw new Error();

      const r = data.result || {};
      const name =
        `${r.first_name || ""} ${r.last_name || ""}`.trim() || "Khách";
      const avatar = r.public_id || "/img/default-user.png";

      const meta = { name, avatar };
      userMetaCacheRef.current.set(userId, meta);
      return meta;
    } catch {
      const fallback = { name: "Khách", avatar: "/img/default-user.png" };
      userMetaCacheRef.current.set(userId, fallback);
      return fallback;
    }
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

  // 1) Lấy sellerUserId + sellerId
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
        if (!cancelled) setSellerUserId(uid);

        const rs = await authFetch(
          apiUrl(API_CONFIG.endpoints.searchSellerByUserId(uid)),
          {
            method: "GET",
            headers: { Accept: "application/json" },
          }
        );
        const ds = await rs.json().catch(() => ({}));
        if (!rs.ok) throw new Error(ds?.message || `HTTP ${rs.status}`);
        const sid = ds?.result?.id;
        if (!sid) throw new Error("Tài khoản không có sellerId");
        if (!cancelled) setSellerId(sid);
      } catch (e) {
        console.error("Load sellerId failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // 2) Socket: mở theo sellerUserId
  useEffect(() => {
    if (!sellerUserId) return;
    initRealtime(sellerUserId); // emit add-user(sellerUserId)
  }, [sellerUserId]);

  // 2b) Khi đã có sellerId, emit add-user cho sellerId + listeners (chặn self)
  useEffect(() => {
    if (!sellerId) return;
    const socket = getSocket();
    socket?.emit("add-user", sellerId);

    const handleTyping = ({ from, to }) => {
      if (to === sellerId && from === activeConv?.targetId) {
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      }
    };

    const handleStopTyping = ({ from, to }) => {
      if (to === sellerId && from === activeConv?.targetId) {
        setIsTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      }
    };

    const handleMsgReceive = (payload) => {
      const {
        from,
        to,
        message,
        emoji,
        fileUrls,
        files: rawFiles,
        createdAt,
      } = payload || {};
      if (to !== sellerId) return;
      // ❌ Không nhận tin nhắn tự chat (seller → userId của chính mình)
      if (from === sellerId || activeConv?.targetId === sellerUserId) return;

      const cid = `c-${from}`;

      const filesArr =
        (Array.isArray(fileUrls) && fileUrls.length > 0
          ? fileUrls
          : Array.isArray(rawFiles)
          ? rawFiles
          : []) || [];

      const hasFiles = filesArr.length > 0;
      const product = decodeProductMessage(message);

      const text = product
        ? `Sản phẩm: ${product.name || "?"}`
        : (message && String(message)) ||
          (emoji ? `(${emoji})` : "") ||
          (hasFiles ? "[tệp]" : "");

      setMsgs((prev) => ({
        ...prev,
        [cid]: [
          ...(prev[cid] || []),
          {
            role: "them",
            text,
            product,
            files: filesArr,
            createdAt: createdAt || new Date().toISOString(),
          },
        ],
      }));

      setConversations((prev) =>
        prev
          .map((c) =>
            c.id === cid
              ? {
                  ...c,
                  last: product
                    ? `Sản phẩm: ${product.name || "?"}`
                    : text,
                  time: formatTime(createdAt || new Date()),
                }
              : c
          )
          .sort((a, b) => (a.id === cid ? -1 : b.id === cid ? 1 : 0))
      );
    };

    socket?.on("typing", handleTyping);
    socket?.on("stop-typing", handleStopTyping);
    socket?.on("msg-receive", handleMsgReceive);
    socket?.on("message", handleMsgReceive);

    return () => {
      socket?.off("typing", handleTyping);
      socket?.off("stop-typing", handleStopTyping);
      socket?.off("msg-receive", handleMsgReceive);
      socket?.off("message", handleMsgReceive);
    };
  }, [sellerId, sellerUserId, activeConv?.targetId]);

  // 3) Load danh sách hội thoại (lọc self)
  useEffect(() => {
    if (!sellerId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingList(true);
        const token = getToken();
        const list = await fetchLastMessages({ token, actorId: sellerId });

        let otherIds = Array.from(
          new Set(
            (list || [])
              .map((row) => (row.users || []).find((u) => u !== sellerId))
              .filter(Boolean)
          )
        );
        // ❌ loại bỏ self (userId === sellerUserId)
        otherIds = otherIds.filter((uid) => uid && uid !== sellerUserId);

        const metaMapEntries = await Promise.all(
          otherIds.map(async (uid) => [uid, await fetchUserMeta(uid)])
        );
        const metaMap = new Map(metaMapEntries);

        const formatted = (list || [])
          .map((row) => {
            const uid = (row.users || []).find((u) => u !== sellerId) || "";
            if (!uid || uid === sellerUserId) return null; // ẩn self
            const meta = metaMap.get(uid) || { name: "Khách", avatar: "" };

            const hasFiles =
              Array.isArray(row.fileUrls) && row.fileUrls.length > 0;
            const product = decodeProductMessage(row.message);

            const lastText = product
              ? `Sản phẩm: ${product.name || "?"}`
              : (row.message && String(row.message).trim()) ||
                (row.emoji ? row.emoji : hasFiles ? "[tệp]" : "—");

            return {
              id: `c-${uid}`,
              type: "user",
              targetId: uid,
              name: meta.name,
              avatar: meta.avatar,
              last: lastText,
              time: formatTime(row.createdAt),
            };
          })
          .filter(Boolean);

        if (!cancelled) {
          setConversations(formatted);
          setActiveCid((prev) =>
            formatted.some((c) => c.id === prev) ? prev : formatted[0]?.id || ""
          );
        }
      } catch (e) {
        if (!cancelled) setConversations([]);
        console.error("fetchLastMessages failed:", e);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sellerId, sellerUserId]);

  // 4) Load messages khi đổi hội thoại
  useEffect(() => {
    if (!sellerId || !activeCid) return;

    const conv = conversations.find((c) => c.id === activeCid);
    if (!conv) return;
    if (msgs[activeCid]?.length) return;
    // ❌ Không load nếu self
    if (conv.targetId === sellerUserId) return;

    let cancelled = false;
    (async () => {
      try {
        setLoadingMsgs(true);
        const token = getToken();

        const data = await fetchMessagesBetween({
          token,
          from: sellerId,
          to: conv.targetId,
        });

        const mapped = (data || []).map((m) => {
          const hasFiles = Array.isArray(m.fileUrls) && m.fileUrls.length > 0;
          const product = decodeProductMessage(m.message);

          const baseText = product
            ? `Sản phẩm: ${product.name || "?"}`
            : (m.message && String(m.message)) ||
              (m.emoji ? `(${m.emoji})` : "") ||
              (hasFiles ? "[tệp]" : "");

          return {
            role: m.fromSelf ? "me" : "them",
            text: baseText,
            product,
            files: hasFiles ? m.fileUrls : product?.image ? [product.image] : [],
            createdAt: m.createdAt,
          };
        });

        if (!cancelled) {
          setMsgs((prev) => ({ ...prev, [activeCid]: mapped }));
        }
      } catch (e) {
        if (!cancelled) {
          console.error("fetchMessagesBetween failed:", e);
          setMsgs((prev) => ({ ...prev, [activeCid]: [] }));
        }
      } finally {
        if (!cancelled) setLoadingMsgs(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sellerId, sellerUserId, activeCid, conversations]);

  // 4b) Khi rời hội thoại hiện tại, gửi stop-typing cho cuộc cũ
  useEffect(() => {
    const s = getSocket();
    return () => {
      if (s && sellerId && activeConv?.targetId) {
        s.emit("stop-typing", { from: sellerId, to: activeConv.targetId });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCid]);

  // 5) Auto scroll
  useEffect(() => {
    if (bodyRef.current)
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [activeCid, msgs, isTyping]);

  const handlePickFiles = (e) => {
    const f = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...f]);
  };

  const removeFile = (i) =>
    setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const emitTypingFromSeller = () => {
    const socket = getSocket();
    if (!socket || !activeConv || !sellerId) return;
    socket.emit("typing", { from: sellerId, to: activeConv.targetId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop-typing", { from: sellerId, to: activeConv.targetId });
    }, 1500);
  };

  const fromTo = useMemo(() => {
    if (!activeConv || !sellerId) return { from: "", to: "" };
    // ❌ cấm tự chat
    if (activeConv.targetId === sellerUserId) return { from: "", to: "" };
    return { from: sellerId, to: activeConv.targetId };
  }, [sellerId, sellerUserId, activeConv]);

  const doSend = async () => {
    const t = text.trim();
    if (!fromTo.from || !fromTo.to) return;
    if (!t && files.length === 0 && !emoji.trim()) return;

    // ❌ chặn gửi tới chính userId của mình
    if (fromTo.to === sellerUserId) {
      alert("Không thể nhắn tin với tài khoản của chính bạn.");
      return;
    }

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

      const timeStr = new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const newText =
        t ||
        (emoji ? `(${emoji})` : "") ||
        ((uploadedUrls || previewUrls).length ? "[tệp]" : "");

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeCid ? { ...c, last: newText, time: timeStr } : c
        )
      );

      setMsgs((prev) => ({
        ...prev,
        [activeCid]: [
          ...(prev[activeCid] || []),
          {
            role: "me",
            text: newText,
            product: null,
            files: uploadedUrls || previewUrls,
            createdAt: resp?.message?.createdAt || new Date().toISOString(),
          },
        ],
      }));

      setText("");
      setEmoji("");
      setFiles([]);

      const socket = getSocket();
      socket?.emit("stop-typing", { from: fromTo.from, to: fromTo.to });
    } catch (e) {
      console.error("Send failed:", e);
      alert(e?.message || "Gửi tin thất bại");
    } finally {
      setSending(false);
    }
  };

  const renderFiles = (m) => {
    // Nếu là product message thì đã có ảnh trong card => không cần render files nữa
    if (!m.files?.length || m.product) return null;
    const arr = Array.isArray(m.files) ? m.files : [m.files];
    return (
      <div className="files" style={{ marginTop: 8 }}>
        {arr.map((file, i) => {
          const s = String(file || "");
          const looksImage =
            /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(s) ||
            s.startsWith("http") ||
            s.startsWith("blob:");
          return looksImage ? (
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
              }}
            />
          ) : (
            <div key={i}>Tệp: {s}</div>
          );
        })}
      </div>
    );
  };

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
      if (
        showEmoji &&
        pickerRef.current &&
        !pickerRef.current.contains(e.target) &&
        !e.target.closest?.(".cs-emoji-toggle")
      ) {
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

  return (
    <div className="cs-root">
      <aside className="cs-sidebar">
        <div className="cs-search" style={{ display: "flex", gap: 8 }}>
          <input placeholder="Tìm theo tên / ID" />
        </div>

        <div className="cs-conv-list">
          {loadingList && <div style={{ padding: 12 }}>Đang tải…</div>}
          {!loadingList && conversations.length === 0 && (
            <div style={{ padding: 12, color: "#6b7280" }}>
              Chưa có hội thoại.
            </div>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              className={`cs-conv-item ${activeCid === c.id ? "active" : ""}`}
              onClick={() => setActiveCid(c.id)}
              title={c.name}
            >
              <div className="cs-avatar">
                {c.avatar ? (
                  <img src={c.avatar} alt={c.name} className="cs-avatar-img" />
                ) : (
                  <span>{(c.name || "U")[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="cs-conv-main">
                <div className="cs-conv-top">
                  <span className="cs-name">{c.name}</span>
                  <span className="cs-time">{c.time}</span>
                </div>
                <div className="cs-last">{c.last}</div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="cs-chat">
        <div className="cs-header">
          <div className="cs-prod">
            {activeConv?.avatar ? (
              <img
                className="thumb"
                src={activeConv.avatar}
                alt={activeConv.name}
              />
            ) : (
              <div className="thumb" />
            )}
            <div className="meta">
              <div className="title">{activeConv?.name || "Khách hàng"}</div>
              <div className="price" style={{ color: "#6b7280" }}>
                User ID: {activeConv?.targetId || "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="cs-body" ref={bodyRef}>
          {loadingMsgs && !(msgs[activeCid]?.length > 0) ? (
            <div style={{ padding: 12 }}>Đang tải tin nhắn…</div>
          ) : (msgs[activeCid] || []).length === 0 ? (
            <div style={{ padding: 12, color: "#6b7280" }}>
              Chưa có tin nhắn.
            </div>
          ) : (
            (msgs[activeCid] || []).map((m, idx) => (
              <div
                key={idx}
                className={`cs-bubble ${m.role === "me" ? "me" : "them"}`}
              >
                <div className="bubble">
                  {/* Card sản phẩm nếu có */}
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
                          Sản phẩm khách đang hỏi
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

                  {m.text && (
                    <div className="cs-message-text">{m.text}</div>
                  )}

                  {renderFiles(m)}
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

          <textarea
            ref={textareaRef}
            className="cs-textarea"
            placeholder="Nhập nội dung tin nhắn"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              emitTypingFromSeller();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                doSend();
              } else {
                emitTypingFromSeller();
              }
            }}
            onBlur={() => {
              const s = getSocket();
              if (s && activeConv && sellerId) {
                s.emit("stop-typing", {
                  from: sellerId,
                  to: activeConv.targetId,
                });
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
