// src/components/address/AddressPickerModal.jsx
"use client";

import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../../config/api";
import "../../../styles/address-picker-modal.css";

/**
 * Modal chọn địa chỉ giao hàng (đen - trắng)
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onPicked: (addressObj) => void
 */
export default function AddressPickerModal({ open, onClose, onPicked }) {
  const { authFetch } = useContext(AuthContext);
  const [addresses, setAddresses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [profileId, setProfileId] = useState(null);
  const [settingId, setSettingId] = useState(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile));
        const data = await res.json().catch(() => ({}));
        const result = data?.result ?? data ?? {};
        if (result?.id) setProfileId(result.id);
        const list = Array.isArray(result.addresses) ? result.addresses : [];
        const withUiId = list.map((a, i) => ({ id: `addr-${i}`, ...a }));
        setAddresses(withUiId);

        // pick mặc định nếu có, không thì lấy dòng đầu
        const def = withUiId.find((a) => a.is_default) || withUiId[0] || null;
        setSelectedId(def?.id || null);
      } catch (e) {
        console.error(e);
        setErr("Không thể tải danh sách địa chỉ");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, authFetch]);

  const handleUse = () => {
    const pick = addresses.find((a) => a.id === selectedId);
    if (!pick) return;
    onPicked?.(pick);
    onClose?.();
  };

  const setDefault = async (addr) => {
    if (!profileId || !addr?.address) return;
    try {
      setSettingId(addr.id);
      const res = await authFetch(apiUrl(API_CONFIG.endpoints.setDefaultAddress), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: profileId, address: addr.address }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      // reload
      const refetch = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile));
      const data = await refetch.json().catch(() => ({}));
      const result = data?.result ?? data ?? {};
      const list = Array.isArray(result.addresses) ? result.addresses : [];
      const withUiId = list.map((a, i) => ({ id: `addr-${i}`, ...a }));
      setAddresses(withUiId);
    } catch (e) {
      alert(e.message || "Thiết lập mặc định thất bại");
    } finally {
      setSettingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="apm-overlay" onClick={onClose}>
      <div className="apm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="apm-header">
          <h3>Chọn địa chỉ giao hàng</h3>
        </div>

        <div className="apm-body">
          {loading ? (
            <div className="apm-loading">Đang tải...</div>
          ) : addresses.length === 0 ? (
            <div className="apm-empty">
              Bạn chưa có địa chỉ. Vui lòng thêm địa chỉ ở trang “Địa chỉ của tôi”.
            </div>
          ) : (
            <ul className="apm-list">
              {addresses.map((a) => (
                <li key={a.id} className="apm-item">
                  <label className="apm-row">
                    <input
                      type="radio"
                      name="apm_addr"
                      checked={selectedId === a.id}
                      onChange={() => setSelectedId(a.id)}
                    />
                    <div className="apm-info">
                      <div className="apm-line">{a.address}</div>
                      <div className="apm-tags">
                        {a.is_default && <span className="apm-tag">Mặc định</span>}
                      </div>
                    </div>
                  </label>
                  <div className="apm-actions">
                    <button
                      className="apm-btn-outline"
                      onClick={() => setDefault(a)}
                      disabled={a.is_default || settingId === a.id}
                    >
                      {settingId === a.id ? "Đang thiết lập..." : "Đặt làm mặc định"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {err && <div className="apm-error">{err}</div>}
        </div>

        <div className="apm-footer">
          <button className="apm-btn-outline" onClick={onClose}>Trở lại</button>
          <button className="apm-btn-primary" onClick={handleUse} disabled={!selectedId || loading}>
            Dùng địa chỉ này
          </button>
        </div>
      </div>
    </div>
  );
}
