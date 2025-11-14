import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/floating-assistant.css";
import ChatAIWidget from "../chat/ChatAIWidget";

function useCSSPx(varName, fallback) {
  return useMemo(() => {
    try {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();
      const m = v.match(/([\d.]+)/);
      return m ? parseFloat(m[1]) : fallback;
    } catch {
      return fallback;
    }
  }, [varName, fallback]);
}

export default function FloatingAssistant({ chatSellerId }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [hiddenByFooter, setHiddenByFooter] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const wrapRef = useRef(null);

  const mainSize = useCSSPx("--fab-main", 60);
  const itemSize = useCSSPx("--fab-item", 64);
  const gap = useCSSPx("--fab-gap", 10);

  // giữ nguyên bố cục/ khoảng cách
  const R = mainSize / 2 + gap + itemSize / 2;
  const angles = [110, 180, 270]; // 0 = Chat AI, 1 = Hướng dẫn, 2 = Chat shop
  const radiuses = [R + 20, R - 15, R - 15];

  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;

    const checkOverlap = () => {
      if (!wrapRef.current) return;
      const fabRect = wrapRef.current.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const overlap = fabRect.bottom >= footerRect.top - 8;
      setHiddenByFooter(overlap);
      if (overlap) setOpen(false);
    };

    let ticking = false;
    const onScrollOrResize = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        checkOverlap();
      });
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    checkOverlap();
    const mo = new MutationObserver(checkOverlap);
    mo.observe(footer, { attributes: true, childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      mo.disconnect();
    };
  }, []);

  const handleMainButtonClick = () => {
    if (chatOpen && !open) {
      setChatOpen(false);
      return;
    }
    setOpen((o) => !o);
  };

  return (
    <>
      <ChatAIWidget open={chatOpen} onClose={() => setChatOpen(false)} />

      <div
        className={`fab-wrap ${hiddenByFooter ? "fab-hidden" : ""}`}
        ref={wrapRef}
      >
        <div className={`fab-arc ${open ? "open" : ""}`}>
          {[0, 1, 2].map((idx) => {
            const deg = angles[idx];
            const radius = radiuses[idx];
            return (
              <a
                key={idx}
                className="fab-item"
                style={{
                  "--angle": `${deg}deg`,
                  "--i": idx,
                  "--radius": `${radius}px`,
                }}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (idx === 0) {
                    // Chat AI
                    setChatOpen((p) => !p);
                    setOpen(false);
                  }
                  if (idx === 1) {
                    // Hướng dẫn (Driver.js tour)
                    setOpen(false);
                    try {
                      window.__homeDrv?.destroy?.();
                    } catch {}
                    try {
                      if (typeof window.__runHomeTour === "function") {
                        setTimeout(() => window.__runHomeTour(), 140);
                      } else {
                        window.dispatchEvent(new Event("RUN_HOME_TOUR"));
                      }
                    } catch {}
                  }
                  if (idx === 2) {
                    // Chat Shop
                    const qs = chatSellerId
                      ? `?sellerId=${encodeURIComponent(chatSellerId)}`
                      : "";
                    navigate(`/chat-shop${qs}`);
                    setOpen(false);
                  }
                }}
                aria-label={
                  idx === 0
                    ? chatOpen
                      ? "Đóng Chat AI"
                      : "Mở Chat AI"
                    : idx === 1
                    ? "Hướng dẫn"
                    : "Chat Shop"
                }
                title={
                  idx === 1
                    ? "Hướng dẫn"
                    : idx === 0
                    ? chatOpen
                      ? "Đóng Chat AI"
                      : "Mở Chat AI"
                    : "Chat Shop"
                }
              >
                {/* === ICONS === */}
                {idx === 0 && (
                  // Robot + bubble "HI!" (có màu), icon to hơn chút
                  <svg
                    viewBox="0 0 64 64"
                    width="26"
                    height="26"
                    className="no-colorize"
                    aria-hidden="true"
                  >
                    <circle cx="32" cy="32" r="28" fill="#0B1840" />
                    <g transform="translate(38,10)">
                      <path
                        d="M0 0h18a6 6 0 016 6v4a6 6 0 01-6 6h-7.3l-4.2 3.8a1 1 0 01-1.7-.74V16H6a6 6 0 01-6-6V0z"
                        fill="#22E1F5"
                      />
                      <text
                        x="9"
                        y="9.5"
                        textAnchor="middle"
                        fontFamily="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial"
                        fontSize="7.2"
                        fontWeight="800"
                        fill="#0B1840"
                      >
                        HI!
                      </text>
                    </g>
                    <g transform="translate(10,16)">
                      <rect x="21" y="-3" width="2" height="6" rx="1" fill="#FFFFFF" />
                      <circle cx="22" cy="-5" r="2" fill="#FFFFFF" />
                      <rect x="6" y="6" width="32" height="20" rx="10" fill="#FFFFFF" />
                      <rect x="11" y="11" width="22" height="10" rx="5" fill="#0B1840" />
                      <circle cx="16" cy="16" r="2" fill="#22E1F5" />
                      <circle cx="28" cy="16" r="2" fill="#22E1F5" />
                      <rect x="4" y="26" width="36" height="14" rx="7" fill="#FFFFFF" />
                    </g>
                  </svg>
                )}

                {idx === 1 && (
                  // Nút hướng dẫn: hình tròn + dấu ?
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path
                      d="M9.8 9.2a2.2 2.2 0 112.9 2.1c-.9.3-1.4.9-1.4 1.7v.3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle cx="12" cy="17.2" r="1.2" fill="currentColor" />
                  </svg>
                )}

                {idx === 2 && (
                  // Chat shop (bong bóng chat)
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                    <path
                      d="M4 5h16v9H8l-4 4V5z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    <path d="M7 8h10M7 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </a>
            );
          })}
        </div>

        <button
          type="button"
          className={`fab ${open ? "active" : ""}`}
          onClick={handleMainButtonClick}
          aria-label={open ? "Đóng menu" : chatOpen ? "Đóng chat" : "Mở menu"}
          title={open ? "Đóng" : chatOpen ? "Đóng chat" : "Shopping"}
        >
          {open ? (
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path
                d="M18.3 5.7L12 12 5.7 5.7M12 12l6.3 6.3M12 12L5.7 18.3"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          ) : (
            <span>{chatOpen ? "Chat AI" : "shopping"}</span>
          )}
        </button>
      </div>
    </>
  );
}
