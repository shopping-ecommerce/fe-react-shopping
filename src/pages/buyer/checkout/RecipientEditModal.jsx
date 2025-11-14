// src/components/address/RecipientEditModal.jsx
"use client";

import { useEffect, useState } from "react";
import "../../../styles/recipient-edit-modal.css";

/**
 * Modal đen-trắng để chỉnh Tên & SĐT người nhận
 * Props:
 *  - open: boolean
 *  - defaultName: string
 *  - defaultPhone: string
 *  - onClose: () => void
 *  - onSave: ({ name, phone }) => void
 */
export default function RecipientEditModal({
  open,
  defaultName = "",
  defaultPhone = "",
  onClose,
  onSave,
}) {
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(defaultName || "");
    setPhone(defaultPhone || "");
    setErr("");
  }, [open, defaultName, defaultPhone]);

  if (!open) return null;

  const handleSave = () => {
    if (!name.trim()) return setErr("Vui lòng nhập tên người nhận.");
    if (!phone.trim()) return setErr("Vui lòng nhập số điện thoại.");
    onSave?.({ name: name.trim(), phone: phone.trim() });
    onClose?.();
  };

  return (
    <div className="rem-overlay" onClick={onClose}>
      <div className="rem-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rem-header">
          <h3>Sửa người nhận</h3>
        </div>
        <div className="rem-body">
          <div className="rem-field">
            <label>Họ và tên</label>
            <input
              type="text"
              className="rem-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập họ và tên người nhận"
            />
          </div>
          <div className="rem-field">
            <label>Số điện thoại</label>
            <input
              type="text"
              className="rem-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Nhập số điện thoại"
            />
          </div>
          {err && <div className="rem-error">{err}</div>}
        </div>
        <div className="rem-footer">
          <button className="rem-btn rem-btn-outline" onClick={onClose}>
            Huỷ
          </button>
          <button className="rem-btn rem-btn-primary" onClick={handleSave}>
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}
