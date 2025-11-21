// src/components/chat/ChatAIWidget.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { API_CONFIG, apiUrl } from "../../config/api";
import "../../styles/chat-ai.css";

const fmtVND = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    n ?? 0
  );

// ===== Helpers giá =====
const toNum = (v) => {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
};

const priceFromVariants = (variants = []) => {
  if (!Array.isArray(variants) || variants.length === 0)
    return { price: null, compare: null };
  const prices = variants.map((v) => toNum(v?.price)).filter((n) => n != null);
  const compares = variants
    .map((v) => toNum(v?.compareAtPrice))
    .filter((n) => n != null);
  if (!prices.length) return { price: null, compare: null };
  const price = Math.min(...prices);
  const cmp = compares.length ? Math.min(...compares) : null;
  return { price, compare: cmp != null && cmp > price ? cmp : null };
};

const priceFromSizes = (sizes = []) => {
  if (!Array.isArray(sizes) || sizes.length === 0)
    return { price: null, compare: null };
  const prices = sizes.map((s) => toNum(s?.price)).filter((n) => n != null);
  const compares = sizes
    .map((s) => toNum(s?.compareAtPrice))
    .filter((n) => n != null);
  if (!prices.length) return { price: null, compare: null };
  const price = Math.min(...prices);
  const cmp = compares.length ? Math.min(...compares) : null;
  return { price, compare: cmp != null && cmp > price ? cmp : null };
};

/** Lấy giá hiển thị từ product: ưu tiên variants -> sizes -> price trực tiếp */
const computeDisplayPrice = (prod = {}) => {
  if (Array.isArray(prod.variants) && prod.variants.length) {
    return priceFromVariants(prod.variants);
  }
  if (Array.isArray(prod.sizes) && prod.sizes.length) {
    return priceFromSizes(prod.sizes);
  }
  const price = toNum(prod.price);
  const compare = toNum(prod.compareAtPrice);
  return {
    price: price ?? null,
    compare:
      compare != null && price != null && compare > price ? compare : null,
  };
};

const pickImgUrl = (images) => {
  if (!Array.isArray(images) || !images.length) return null;
  const first = images[0];
  return typeof first === "string" ? first : first?.url || null;
};

// 🔑 Hàm tạo conversationId mới, mỗi lần gửi là một ID khác
const buildConversationId = (convProp) => {
  // Nếu bên ngoài truyền convProp thì vẫn ưu tiên dùng
  if (convProp) return convProp;

  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Fallback: vẫn gần như không trùng
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

// 🧠 Gợi ý câu hỏi nhanh
const QUICK_SUGGESTIONS = [
  { id: "policy-cancel", text: "Chính sách hủy đơn hàng" },
  { id: "find-jeans", text: "Tìm quần jean nam dưới 500k" },
  { id: "find-keyboard", text: "Tìm bàn phím cơ cho lập trình" },
];

export default function ChatAIWidget({
  open,
  onClose,
  conversationId: convProp,
}) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      type: "text",
      content: "Chào bạn! Mình là Shopping AI assistant. Bạn cần gì nè?",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // file đính kèm (chỉ đính kèm, không auto gửi)
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState(null);

  const bodyRef = useRef(null);
  const fileInputRef = useRef(null);

  // 🔥 Chỉ hiện gợi ý lúc đầu
  const [showSuggestions, setShowSuggestions] = useState(true);

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, open, sending]);

  // Endpoint text chat (qua gateway 8888)
  const chatUrl = useMemo(() => {
    const path = API_CONFIG?.endpoints?.chat || "/chat";
    return apiUrl(path);
  }, []);

  // ✅ Endpoint image chat (qua gateway 8888) & method POST
  const chatWithImageUrl =
    "http://localhost:8888/shopping/api/chat-ai/chat-with-image";

  const toProductHref = (item) => {
    if (!item) return "#";
    if (item.url && /^\/product\//.test(item.url)) {
      const id = item.id || item.url.split("/").pop();
      return `/products/${id}`;
    }
    if (item.url && /^\/products\//.test(item.url)) return item.url;
    return item.id ? `/products/${item.id}` : "#";
  };

  const pushAssistantText = (text) => {
    setMessages((prev) => [
      ...prev,
      { role: "assistant", type: "text", content: text },
    ]);
  };

  const clearAttachment = (uiOnly = false) => {
    setSelectedFile(null);
    if (
      !uiOnly &&
      selectedFilePreview &&
      selectedFilePreview.startsWith("blob:")
    ) {
      URL.revokeObjectURL(selectedFilePreview);
    }
    setSelectedFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chỉ chọn file ảnh");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("File ảnh quá lớn. Vui lòng chọn file nhỏ hơn 5MB");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Chỉ đính kèm, KHÔNG thêm bubble, KHÔNG gửi
    setSelectedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setSelectedFilePreview(previewUrl);
  };

  const sendMessage = async (text) => {
    if (sending) return; // tránh spam khi đang gửi

    const content = (text ?? input).trim();
    // Cho phép gửi nếu có text hoặc có file đính kèm
    if (!content && !selectedFile) return;

    // 🔥 Ẩn gợi ý ngay khi user có hành động gửi (gõ hoặc bấm gợi ý)
    if (showSuggestions) setShowSuggestions(false);

    // 🔑 Mỗi lần gửi -> tạo conversationId khác nhau
    const conversationId = buildConversationId(convProp);

    // Chụp lại file & preview để hiển thị bubble và gửi API
    const fileToSend = selectedFile || null;
    const previewToShow = selectedFilePreview || null;
    const fileNameToShow = selectedFile?.name;

    // Hiển thị tin nhắn người dùng NGAY: ảnh (nếu có) + text (nếu có)
    setMessages((prev) => {
      const next = [...prev];
      if (previewToShow) {
        next.push({
          role: "user",
          type: "image",
          content: previewToShow,
          fileName: fileNameToShow,
        });
      }
      if (content) {
        next.push({ role: "user", type: "text", content });
      }
      return next;
    });

    // Ẩn thanh attach ngay, nhưng KHÔNG revoke blob để bubble ảnh vẫn hiển thị
    clearAttachment(true);

    setInput("");
    setSending(true);

    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("access_token");

      const useImageApi = Boolean(fileToSend);
      const url = useImageApi ? chatWithImageUrl : chatUrl;

      let body;
      const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      if (useImageApi) {
        const formData = new FormData();
        formData.append("file", fileToSend);
        formData.append("message", content || "");
        formData.append("conversationId", conversationId); // ✅ mỗi lần khác
        body = formData;
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify({ message: content, conversationId }); // ✅ mỗi lần khác
      }

      const res = await fetch(url, { method: "POST", headers, body });
      const txt = await res.text();

      try {
        const data = JSON.parse(txt);
        if (data && data.type === "product_list" && Array.isArray(data.items)) {
          const header = data.message || "Sản phẩm gợi ý cho bạn:";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", type: "text", content: header },
            {
              role: "assistant",
              type: "product_list",
              items: data.items.map((it) => {
                const raw = it.product || it || {};
                const { price, compare } = computeDisplayPrice(raw);
                const img =
                  it.imageUrl || pickImgUrl(raw.images) || "/placeholder.svg";

                const discount =
                  it.discount != null
                    ? it.discount
                    : compare && price
                    ? Math.round((1 - price / compare) * 100)
                    : null;

                return {
                  id: it.id || raw.id || raw._id,
                  name: it.name || raw.name || "Sản phẩm",
                  price: price != null ? price : toNum(it.price) ?? 0,
                  compare,
                  discount,
                  imageUrl: img,
                  href: toProductHref(it),
                };
              }),
            },
          ]);
          return;
        }

        if (data && typeof data.message === "string") {
          pushAssistantText(data.message);
          return;
        }
      } catch {
        // plain text
      }

      pushAssistantText(
        txt || "Xin lỗi, hiện mình chưa nhận được nội dung phản hồi."
      );
    } catch (e) {
      pushAssistantText(
        "Có lỗi khi kết nối Chat AI. Vui lòng thử lại sau nhé."
      );
    } finally {
      setSending(false);
      // KHÔNG gọi clearAttachment() nữa (đã ẩn UI ở trên)
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!open) return null;

  return (
    <div className="chat-ai-wrap" role="dialog" aria-label="Shopping AI Chat">
      <div className="chat-ai-card">
        <div className="chat-ai-header">
          <div className="chat-ai-title">
            <strong>Chat AI</strong>
            <span className="chat-ai-sub">Tôi có thể giúp gì cho bạn?</span>
          </div>
          <button className="chat-ai-close" onClick={onClose} aria-label="Đóng">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M18.3 5.7 12 12m0 0-6.3 6.3M12 12l6.3 6.3M12 12 5.7 5.7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        </div>

        <div className="chat-ai-body" ref={bodyRef}>
          {messages.map((m, i) => {
            if (m.type === "image") {
              return (
                <div key={`img-${i}`} className="chat-ai-bubble user">
                  <div
                    className="bubble"
                    style={{ padding: "4px", maxWidth: "70%" }}
                  >
                    <img
                      src={m.content || "/placeholder.svg"}
                      alt={m.fileName || "Uploaded image"}
                      onLoad={() => {
                        try {
                          if (m.content && m.content.startsWith("blob:")) {
                            URL.revokeObjectURL(m.content);
                          }
                        } catch {}
                      }}
                      style={{
                        width: "100%",
                        borderRadius: "8px",
                        display: "block",
                      }}
                    />

                    {m.fileName && (
                      <div
                        style={{
                          fontSize: "11px",
                          marginTop: "4px",
                          opacity: 0.8,
                        }}
                      >
                        {m.fileName}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (m.type === "product_list") {
              return (
                <div key={`pl-${i}`} className="chat-ai-bubble assistant">
                  <div
                    className="bubble"
                    style={{
                      border: "none",
                      padding: 0,
                      background: "transparent",
                    }}
                  >
                    <div className="chat-ai-products">
                      {m.items.map((p) => (
                        <a
                          key={p.id || p.href}
                          className="chat-ai-product"
                          href={p.href}
                          title={p.name}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <div className="thumb">
                            <img
                              src={p.imageUrl || "/placeholder.svg"}
                              alt={p.name}
                              loading="lazy"
                            />
                          </div>
                          <div className="info">
                            <div className="name">{p.name}</div>
                            <div className="price">
                              {fmtVND(p.price)}
                              {p.compare ? (
                                <span
                                  className="discount"
                                  style={{
                                    marginLeft: 6,
                                    textDecoration: "line-through",
                                    opacity: 0.75,
                                  }}
                                >
                                  {fmtVND(p.compare)}
                                </span>
                              ) : null}
                              {p.discount ? (
                                <span
                                  className="discount"
                                  style={{ marginLeft: 6 }}
                                >
                                  −{Math.round(p.discount)}%
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={i} className={`chat-ai-bubble ${m.role}`}>
                <div className="bubble">{m.content}</div>
              </div>
            );
          })}

          {sending && (
            <div className="chat-ai-bubble assistant">
              <div className="bubble typing">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}
        </div>

        {/* 🔎 Gợi ý câu hỏi nhanh – chỉ hiện lúc đầu */}
        {showSuggestions && QUICK_SUGGESTIONS.length > 0 && (
          <div className="chat-ai-suggestions">
            {QUICK_SUGGESTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="chat-ai-suggest-chip"
                onClick={() => sendMessage(s.text)}
                disabled={sending}
              >
                {s.text}
              </button>
            ))}
          </div>
        )}

        {/* Ô nhập + attach bar nằm TRONG chat-ai-input */}
        <div className={`chat-ai-input ${selectedFile ? "has-attach" : ""}`}>
          {selectedFile && (
            <div className="chat-ai-attachbar in-input">
              <div className="attach-left">
                {selectedFilePreview && (
                  <img
                    src={selectedFilePreview}
                    alt={selectedFile.name}
                    className="attach-thumb"
                    style={{
                      width: 30,
                      height: 30,
                      objectFit: "cover",
                      borderRadius: 6,
                      border: "1px solid #eee",
                      flexShrink: 0,
                    }}
                  />
                )}

                <div className="attach-meta">
                  <div className="attach-name" title={selectedFile.name}>
                    {selectedFile.name}
                  </div>
                  <div className="attach-size">
                    {(selectedFile.size / 1024).toFixed(0)} KB
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="attach-remove"
                onClick={clearAttachment}
                aria-label="Xoá ảnh đính kèm"
                title="Xoá ảnh đính kèm"
              >
                ×
              </button>
            </div>
          )}

          {/* Nút chọn ảnh */}
          <label className="file-btn" title="Chọn ảnh">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              aria-label="Chọn file ảnh"
            />
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </label>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Nhập tin nhắn… (Enter để gửi, Shift+Enter để xuống dòng)"
          />
          <button
            className="send-btn"
            onClick={() => sendMessage()}
            disabled={sending || (!input.trim() && !selectedFile)}
            aria-label="Gửi"
            title="Gửi"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M2 21l20-9L2 3v7l14 2-14 2v7z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
