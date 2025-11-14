import React, { useEffect, useState } from "react";

/**
 * Modal báo cáo sản phẩm
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - productId: string
 * - productName: string
 * - userId: string
 * - authFetch: (url, init) => Promise<Response>   // lấy từ AuthContext
 * - onSuccess?: (result) => void
 * - showToast?: (opts) => void
 */
export default function ReportProductModal({
  isOpen,
  onClose,
  productId,
  productName,
  userId,
  authFetch,
  onSuccess,
  showToast,
}) {
  const [reason, setReason] = useState("Nhạy cảm");
  const [otherText, setOtherText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason("Nhạy cảm");
      setOtherText("");
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const finalReason = reason === "Khác" ? (otherText || "").trim() : reason;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!productId || !userId) {
      showToast?.({
        title: "Thiếu dữ liệu",
        text: "Không xác định được sản phẩm hoặc người dùng.",
        type: "error",
      });
      return;
    }
    if (!finalReason) {
      showToast?.({
        title: "Thiếu lý do",
        text: "Vui lòng nhập lý do báo cáo.",
        type: "warning",
      });
      return;
    }

    try {
      setSubmitting(true);

      const REPORT_URL = "http://localhost:8888/shopping/api/feedback/report/create";
      const body = { productId, userId, reason: finalReason };

      const res = await authFetch(REPORT_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.code !== 200) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      showToast?.({
        title: "Đã gửi báo cáo",
        text: data?.message || "Report created successfully",
        type: "success",
      });

      onSuccess?.(data?.result);
      onClose();
    } catch (err) {
      showToast?.({
        title: "Gửi báo cáo thất bại",
        text: err.message || "Có lỗi xảy ra.",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rp-modal-mask" onClick={onClose}>
      <div
        className="rp-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rp-title"
      >
        <div className="rp-header">
          <h3 id="rp-title">Báo cáo sản phẩm</h3>
          <button className="rp-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>

        <form className="rp-body" onSubmit={handleSubmit}>
          <div className="rp-field">
            <label>Sản phẩm</label>
            <div className="rp-readonly">
              <div style={{ fontWeight: 600 }}>{productName || "—"}</div>
              {productId && (
                <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                  ID: {productId}
                </div>
              )}
            </div>
          </div>

          <div className="rp-field">
            <label>Lý do báo cáo</label>
            <div className="rp-reasons">
              {["Nhạy cảm", "Giả mạo", "Hàng cấm", "Khác"].map((r) => (
                <label
                  key={r}
                  className={`rp-chip ${reason === r ? "active" : ""}`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>

          {reason === "Khác" && (
            <div className="rp-field">
              <label>Mô tả lý do</label>
              <textarea
                className="rp-textarea"
                rows={4}
                placeholder="Nhập lý do cụ thể…"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
              />
            </div>
          )}

          <div className="rp-footer">
            <button
              type="button"
              className="rp-btn outline"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rp-btn primary"
              disabled={submitting}
              title={submitting ? "Đang gửi…" : "Gửi báo cáo"}
            >
              {submitting ? "Đang gửi…" : "Gửi báo cáo"}
            </button>
          </div>
        </form>
      </div>

      {/* Styles tối giản; có thể dời sang CSS riêng */}
      <style>{`
        .rp-modal-mask {
          position: fixed; inset: 0; background: rgba(0,0,0,.45);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        .rp-modal {
          width: 520px; max-width: calc(100vw - 24px);
          background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.2);
          overflow: hidden;
        }
        .rp-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; border-bottom: 1px solid #eee;
        }
        .rp-close {
          background: transparent; border: none; font-size: 22px; cursor: pointer; line-height: 1;
        }
        .rp-body { padding: 16px; }
        .rp-field { margin-bottom: 14px; }
        .rp-field label { display:block; font-weight: 600; margin-bottom: 6px; }
        .rp-readonly {
          background: #f6f7f8; border: 1px solid #eee; border-radius: 8px; padding: 8px 10px; font-size: 13px;
          color: #333; word-break: break-all;
        }
        .rp-reasons { display: flex; flex-wrap: wrap; gap: 8px; }
        .rp-chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 10px; border-radius: 999px; border: 1px solid #ccc; cursor: pointer; user-select: none;
          font-size: 14px; background: #fff;
        }
        .rp-chip input { display: none; }
        .rp-chip.active { border-color: #111; background: #111; color: #fff; }
        .rp-textarea {
          width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid #ddd; outline: none;
        }
        .rp-textarea:focus { border-color: #111; }
        .rp-footer {
          display: flex; justify-content: flex-end; gap: 10px; padding-top: 8px;
        }
        .rp-btn {
          min-width: 110px; height: 36px; border-radius: 999px; padding: 0 14px; cursor: pointer; border: none;
        }
        .rp-btn.primary { background: #111; color: #fff; }
        .rp-btn.primary:disabled { opacity: .6; cursor: not-allowed; }
        .rp-btn.outline { background: #fff; border: 1px solid #ddd; }
      `}</style>
    </div>
  );
}
