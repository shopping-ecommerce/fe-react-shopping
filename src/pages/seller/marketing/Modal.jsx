// src/components/Modal.jsx
"use client";

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import "../../../styles/Modal.css";

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer = null,
  width = 720,
  closeOnBackdrop = true,
  showClose = true,
}) {
  const [closing, setClosing] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let root = document.getElementById("modal-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "modal-root";
      document.body.appendChild(root);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setClosing(false);
      setCanClose(false);
      const t = setTimeout(() => setCanClose(true), 180);
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(t);
        document.body.style.overflow = prev;
      };
    } else {
      setMounted(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && handleClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose?.();
    }, 230);
  };

  const overlayMouseDown = (e) => {
    if (!closeOnBackdrop) return;
    if (!canClose) return;
    if (e.target === e.currentTarget) handleClose();
  };

  const stop = (e) => e.stopPropagation();

  if (!mounted && !closing) return null;

  const modalEl = (
    <div
      className={`m-overlay ${isOpen && !closing ? "m-open" : "m-closing"}`}
      onMouseDown={overlayMouseDown}
      onClick={overlayMouseDown}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`m-content ${closing ? "m-animate-out" : "m-animate-in"}`}
        style={{ width: `min(${width}px, 100%)` }}
        onMouseDown={stop}
        onClick={stop}
      >
        <div className="m-header">
          <h3 className="m-title">{title}</h3>
          {showClose && (
            <button className="m-icon-btn m-close" onClick={handleClose} aria-label="Đóng">
              ✕
            </button>
          )}
        </div>

        <div className="m-body">{children}</div>

        <div className="m-footer">
          {footer ?? (
            <>
              <button className="m-btn m-btn-outline" onClick={handleClose}>
                Đóng
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const root = document.getElementById("modal-root");
  return root ? ReactDOM.createPortal(modalEl, root) : modalEl;
}
