// src/pages/seller/marketing/VoucherManagementPage.jsx
"use client";

import React, { useState, useEffect, useMemo, useContext } from "react";
import { Plus, Tag, Info } from "lucide-react";
import { AuthContext } from "../../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../../config/api";
import Modal from "../../../pages/seller/marketing/Modal.jsx";
import "../../../styles/VoucherManagement.css";
import "../../../styles/Modal.css";
import { showToast } from "../../../components/common/ChatToaster";

/* ===== Helpers ===== */
const pad2 = (n) => String(n).padStart(2, "0");
const toLocalDTValue = (date) => {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
};
const addMinutes = (date, mins) => new Date(date.getTime() + mins * 60000);

const nfPlain = new Intl.NumberFormat("en-US");
const toDigits = (s) => String(s ?? "").replace(/[^\d]/g, "");
const formatVNDInput = (s) => {
  const d = toDigits(s);
  return d ? nfPlain.format(Number(d)) : "";
};
const parseVNDInput = (s) => {
  const d = toDigits(s);
  return d ? Number(d) : 0;
};
const formatCurrency = (amount) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount || 0);
const formatDate = (dateString) =>
  dateString ? new Date(dateString).toLocaleString("vi-VN", { hour12: false }) : "N/A";
const formatDateTimeForAPI = (s) => (s ? s.replace("T", " ") + ":00" : "");
const formatDateTimeFromAPI = (s) => (s ? s.slice(0, 16).replace(" ", "T") : "");

/* ===== Page ===== */
export default function VoucherManagementPage() {
  const { authFetch } = useContext(AuthContext);
  const [vouchers, setVouchers] = useState([]);
  const [activeTab, setActiveTab] = useState("ongoing");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null); // giữ để reuse title/disable code khi cần

  // Seller
  const [sellerId, setSellerId] = useState("");
  const [sellerLoading, setSellerLoading] = useState(false);
  const [sellerErr, setSellerErr] = useState("");

  // Form
  const initialForm = {
    code: "",
    name: "",
    description: "",
    type: "PERCENTAGE",
    discountValue: "10",
    maxDiscountAmount: "50,000",
    minOrderAmount: "0",
    totalQuantity: "1",
    startDate: "",
    endDate: "",
  };
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");
  const setFormField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  /* Lấy sellerId từ profile */
  useEffect(() => {
    if (!authFetch) return;
    let cancelled = false;
    (async () => {
      try {
        setSellerLoading(true);
        setSellerErr("");
        const resProf = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile), {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const dataProf = await resProf.json().catch(() => ({}));
        if (!resProf.ok) throw new Error(dataProf?.message || `HTTP ${resProf.status}`);
        const userId = dataProf?.result?.id;
        if (!userId) throw new Error("Không lấy được userId từ profile.");

        const resSeller = await authFetch(
          apiUrl(API_CONFIG.endpoints.searchSellerByUserId(userId)),
          { method: "GET", headers: { Accept: "application/json" } }
        );
        const dataSeller = await resSeller.json().catch(() => ({}));
        if (!resSeller.ok) throw new Error(dataSeller?.message || `HTTP ${resSeller.status}`);
        const seller = dataSeller?.result;
        if (!seller?.id) throw new Error("Tài khoản chưa có sellerId.");
        if (!cancelled) setSellerId(seller.id);
      } catch (e) {
        if (!cancelled) setSellerErr(e?.message || "Không xác định được sellerId.");
      } finally {
        if (!cancelled) setSellerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  /* Fetch danh sách voucher của seller (trả all) */
  const fetchVouchers = async () => {
    if (!sellerId) return;
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(
        apiUrl(API_CONFIG.endpoints.vouchersBySellerAll(sellerId)),
        { method: "GET", headers: { Accept: "application/json" } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Lỗi khi tải voucher");
      setVouchers(Array.isArray(data.result) ? data.result : []);
    } catch (err) {
      setError(err.message);
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (sellerId) fetchVouchers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId]);

  const getVoucherStatus = (v) => {
    const now = new Date(),
      start = new Date(v.startDate),
      end = new Date(v.endDate);
    if (now < start) return "upcoming";
    if (now > end) return "ended";
    if (v.status && v.status !== "ACTIVE") return "ended";
    return "ongoing";
  };
  const filteredVouchers = useMemo(
    () => vouchers.filter((v) => (activeTab === "all" ? true : getVoucherStatus(v) === activeTab)),
    [vouchers, activeTab]
  );

  /* Mở modal tạo: start = NOW, end = NOW + 24h */
  const openCreate = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const now = new Date();
    const startVal = toLocalDTValue(now); // ✅ bắt đầu từ hiện tại
    const endVal = toLocalDTValue(addMinutes(now, 24 * 60));
    setEditingVoucher(null);
    setForm({ ...initialForm, startDate: startVal, endDate: endVal });
    setFormErr("");
    setTimeout(() => setIsModalOpen(true), 10);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setEditingVoucher(null);
      setForm(initialForm);
      setFormErr("");
    }, 250);
  };

  /* Validation */
  const validate = () => {
    if (!form.code.trim()) return "Vui lòng nhập mã voucher (code).";
    if (!form.name.trim()) return "Vui lòng nhập tên voucher.";
    if (!form.startDate || !form.endDate) return "Vui lòng chọn thời gian hiệu lực.";

    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const now = new Date();
    const minEnd = addMinutes(start, 15);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "Thời gian không hợp lệ.";
    // ✅ BẮT BUỘC từ hiện tại trở đi
    if (start < now) return "Bắt đầu phải từ thời điểm hiện tại trở đi.";
    if (end < minEnd) return "Thời gian kết thúc phải sau thời gian bắt đầu ít nhất 15 phút.";
    if (Number(form.totalQuantity) <= 0) return "Tổng số lượng phải > 0.";

    if (form.type === "PERCENTAGE") {
      const dv = Number(form.discountValue);
      if (!dv || dv <= 0 || dv > 100) return "Giá trị % giảm phải trong khoảng 1–100.";
      if (parseVNDInput(form.maxDiscountAmount) <= 0) return "Vui lòng nhập mức giảm tối đa > 0.";
    }
    if (form.type === "FIXED_AMOUNT" && parseVNDInput(form.discountValue) <= 0)
      return "Mức giảm cố định phải > 0.";
    if (parseVNDInput(form.minOrderAmount) < 0) return "Đơn tối thiểu không được âm.";

    return "";
  };

  /* Tạo voucher */
  const handleSaveVoucher = async () => {
    const v = validate();
    if (v) {
      setFormErr(v);
      return;
    }
    if (!sellerId) {
      setFormErr("Không xác định được sellerId. Vui lòng tải lại trang.");
      return;
    }

    setSubmitting(true);
    try {
      const isEditing = !!editingVoucher?.id; // hiện không dùng sửa
      const endpoint = isEditing
        ? API_CONFIG.endpoints.updateVoucher(editingVoucher.id)
        : API_CONFIG.endpoints.createVoucher;
      const method = isEditing ? "PUT" : "POST";

      const isPercentage = form.type === "PERCENTAGE";
      const isFixed = form.type === "FIXED_AMOUNT";
      const isFreeShip = form.type === "FREE_SHIPPING";

      const discountValueNumber =
        isFreeShip ? 0
        : isPercentage ? Number(form.discountValue) || 0
        : parseVNDInput(form.discountValue);

      const payloadBase = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description?.trim() || "",
        type: form.type,
        discountValue: discountValueNumber,
        minOrderAmount: parseVNDInput(form.minOrderAmount),
        totalQuantity: Number(form.totalQuantity) || 0,
        startDate: formatDateTimeForAPI(form.startDate),
        endDate: formatDateTimeForAPI(form.endDate),
        createdBy: sellerId,
        applicableTo: "ALL",
        applicableIds: [],
      };

      const payload = { ...payloadBase };
      if (isPercentage) {
        payload.maxDiscountAmount = parseVNDInput(form.maxDiscountAmount);
      }

      const res = await authFetch(apiUrl(endpoint), {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      showToast({
        title: data.message || "Tạo voucher thành công",
        type: "success",
        duration: 2500,
      });

      closeModal();
      fetchVouchers();
    } catch (e) {
      showToast({
        title: "Lỗi",
        text: e.message || "Có lỗi xảy ra",
        type: "error",
        duration: 3000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTypeChange = (nextType) => {
    setForm((prev) => {
      if (nextType === "FREE_SHIPPING") {
        return { ...prev, type: nextType, discountValue: "", maxDiscountAmount: "" };
      }
      if (nextType === "FIXED_AMOUNT") {
        return {
          ...prev,
          type: nextType,
          discountValue: prev.discountValue ? formatVNDInput(prev.discountValue) : "50,000",
          maxDiscountAmount: "",
        };
      }
      // PERCENTAGE
      return {
        ...prev,
        type: nextType,
        discountValue:
          prev.discountValue && !isNaN(Number(prev.discountValue)) ? String(prev.discountValue) : "10",
        maxDiscountAmount: prev.maxDiscountAmount ? formatVNDInput(prev.maxDiscountAmount) : "50,000",
      };
    });
  };

  return (
    <div className="vm-page">
      <div className="vm-header">
        <h1>Mã giảm giá của tôi</h1>
        <button
          className="vm-btn-primary"
          onClick={openCreate}
          disabled={!sellerId || sellerLoading}
          type="button"
        >
          <Plus size={16} /> Tạo mã giảm giá mới
        </button>
      </div>

      {sellerLoading ? (
        <div className="vm-info-box">
          <Info size={16} /> Đang kiểm tra quyền seller...
        </div>
      ) : sellerErr ? (
        <div className="vm-info-box error">
          ⚠️ {sellerErr}
          {sellerErr.includes("chưa có sellerId") && (
            <div style={{ marginTop: 8 }}>
              <button
                className="vm-btn-secondary"
                onClick={() => showToast({ title: "Chức năng đăng ký Seller sẽ được triển khai sau.", type: "info" })}
              >
                Đăng ký làm Seller
              </button>
            </div>
          )}
        </div>
      ) : null}

      <div className="vm-tabs">
        {[
          { key: "ongoing", label: "Đang diễn ra" },
          { key: "upcoming", label: "Sắp diễn ra" },
          { key: "ended", label: "Đã kết thúc" },
          { key: "all", label: "Tất cả" },
        ].map((t) => (
          <button
            key={t.key}
            className={`vm-tab-btn ${activeTab === t.key ? "active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="vm-table-container">
        <table className="vm-table">
          <thead>
            <tr>
              <th>Mã giảm giá</th>
              <th>Chi tiết</th>
              <th>Lượt sử dụng</th>
              <th>Thời gian hiệu lực</th>
              <th>Trạng thái</th>
              {/* Bỏ cột Thao tác */}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="vm-loading">Đang tải dữ liệu...</td>
              </tr>
            ) : filteredVouchers.length === 0 ? (
              <tr>
                <td colSpan="5" className="vm-empty">Không có mã giảm giá nào.</td>
              </tr>
            ) : (
              filteredVouchers.map((v) => {
                const status = getVoucherStatus(v);
                return (
                  <tr key={v.id}>
                    <td>
                      <div className="vm-voucher-code">
                        <Tag size={14} /> {v.code}
                      </div>
                      <div className="vm-voucher-name">{v.name}</div>
                    </td>
                    <td>
                      {v.type === "PERCENTAGE"
                        ? `Giảm ${v.discountValue}%` +
                          (v.maxDiscountAmount ? ` (tối đa ${formatCurrency(v.maxDiscountAmount)})` : "")
                        : v.type === "FREE_SHIPPING"
                        ? "Miễn phí vận chuyển"
                        : `Giảm ${formatCurrency(v.discountValue)}`}
                      <br />
                      <small>Đơn tối thiểu: {formatCurrency(v.minOrderAmount)}</small>
                    </td>
                    <td>{v.claimedQuantity || 0} / {v.totalQuantity}</td>
                    <td>
                      {formatDate(v.startDate)}<br />{formatDate(v.endDate)}
                    </td>
                    <td>
                      <span className={`vm-status-badge status-${status}`}>
                        {status === "ongoing" ? "Đang diễn ra" : status === "upcoming" ? "Sắp diễn ra" : "Đã kết thúc"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingVoucher ? "Chỉnh sửa mã giảm giá" : "Tạo mã giảm giá mới"}
        width={720}
        footer={
          <>
            <button className="m-btn m-btn-outline" onClick={closeModal} type="button">
              Hủy
            </button>
            <button
              className="m-btn m-btn-primary"
              onClick={handleSaveVoucher}
              disabled={submitting}
              type="button"
            >
              {submitting ? "Đang lưu..." : editingVoucher ? "Lưu thay đổi" : "Tạo voucher"}
            </button>
          </>
        }
      >
        {formErr && <div className="m-alert m-alert-error">⚠️ {formErr}</div>}

        <div className="vm-form-grid">
          <div className="vm-form-group">
            <label className="vm-form-label">Mã voucher *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setFormField("code", e.target.value.toUpperCase())}
              className="vm-form-input"
              placeholder="VD: SUMMER2027"
              disabled={!!editingVoucher?.id}
              autoFocus
            />
          </div>

          <div className="vm-form-group">
            <label className="vm-form-label">Tên hiển thị *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setFormField("name", e.target.value)}
              className="vm-form-input"
              placeholder="VD: Giảm giá mùa hè 2027"
            />
          </div>

          <div className="vm-form-group vm-full">
            <label className="vm-form-label">Mô tả</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setFormField("description", e.target.value)}
              className="vm-form-textarea"
              placeholder="VD: Giảm 10% tối đa 50.000đ cho đơn từ 200.000đ"
            />
          </div>

          <div className="vm-form-group">
            <label className="vm-form-label">Loại giảm giá *</label>
            <select
              value={form.type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="vm-form-select"
            >
              <option value="PERCENTAGE">Phần trăm (%)</option>
              <option value="FIXED_AMOUNT">Số tiền cố định</option>
              <option value="FREE_SHIPPING">Miễn phí vận chuyển</option>
            </select>
          </div>

          {form.type === "PERCENTAGE" && (
            <>
              <div className="vm-form-group">
                <label className="vm-form-label">Giá trị (%) *</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.discountValue}
                  onChange={(e) => setFormField("discountValue", e.target.value)}
                  className="vm-form-input"
                  placeholder="VD: 10"
                />
              </div>

              <div className="vm-form-group">
                <label className="vm-form-label">Giảm tối đa (VND)</label>
                <input
                  type="text"
                  value={form.maxDiscountAmount}
                  onChange={(e) => setFormField("maxDiscountAmount", formatVNDInput(e.target.value))}
                  className="vm-form-input"
                  placeholder="VD: 50,000"
                  inputMode="numeric"
                />
              </div>
            </>
          )}

          {form.type === "FIXED_AMOUNT" && (
            <div className="vm-form-group">
              <label className="vm-form-label">Giá trị giảm (VND) *</label>
              <input
                type="text"
                value={form.discountValue}
                onChange={(e) => setFormField("discountValue", formatVNDInput(e.target.value))}
                className="vm-form-input"
                placeholder="VD: 50,000"
                inputMode="numeric"
              />
            </div>
          )}

          {form.type === "FREE_SHIPPING" && (
            <div className="vm-form-group vm-full">
              <div className="vm-info-box" style={{ background: "#f9fafb" }}>
                Miễn phí vận chuyển <b>(30,000đ do BE quy định mặc định)</b>.
              </div>
            </div>
          )}

          <div className="vm-form-group">
            <label className="vm-form-label">Đơn tối thiểu (VND)</label>
            <input
              type="text"
              value={form.minOrderAmount}
              onChange={(e) => setFormField("minOrderAmount", formatVNDInput(e.target.value))}
              className="vm-form-input"
              placeholder="VD: 200,000"
              inputMode="numeric"
            />
          </div>

          <div className="vm-form-group">
            <label className="vm-form-label">Tổng số lượng *</label>
            <input
              type="number"
              min={1}
              value={form.totalQuantity}
              onChange={(e) => setFormField("totalQuantity", e.target.value)}
              className="vm-form-input"
              placeholder="VD: 100"
            />
          </div>

          {/* ==== Thời gian: BẮT ĐẦU từ HIỆN TẠI trở đi ==== */}
          <div className="vm-form-group">
            <label className="vm-form-label">Bắt đầu *</label>
            {(() => {
              const nowMin = toLocalDTValue(new Date()); // ✅ min là thời điểm hiện tại
              const onChangeStart = (e) => {
                const picked = e.target.value;
                const fixed = picked && picked < nowMin ? nowMin : picked; // ép >= now
                setFormField("startDate", fixed);
                const minEnd = toLocalDTValue(addMinutes(new Date(fixed || nowMin), 15));
                if (!form.endDate || form.endDate < minEnd) {
                  setFormField("endDate", minEnd);
                }
              };
              return (
                <input
                  type="datetime-local"
                  value={form.startDate}
                  min={nowMin}
                  onChange={onChangeStart}
                  className="vm-form-input vm-form-input--date"
                />
              );
            })()}
            <div className="vm-hint">Thời gian bắt đầu phải từ hiện tại trở đi.</div>
          </div>

          <div className="vm-form-group">
            <label className="vm-form-label">Kết thúc *</label>
            {(() => {
              const startRef = form.startDate ? new Date(form.startDate) : new Date();
              const minEnd = toLocalDTValue(addMinutes(startRef, 15));
              const onChangeEnd = (e) => {
                const picked = e.target.value;
                const fixed = picked && picked < minEnd ? minEnd : picked; // ép >= start + 15'
                setFormField("endDate", fixed);
              };
              return (
                <input
                  type="datetime-local"
                  value={form.endDate}
                  min={minEnd}
                  onChange={onChangeEnd}
                  className="vm-form-input vm-form-input--date"
                />
              );
            })()}
            <div className="vm-hint">Phải muộn hơn thời gian bắt đầu ít nhất 15 phút.</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
