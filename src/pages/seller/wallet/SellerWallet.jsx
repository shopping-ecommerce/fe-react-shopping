"use client";

import React, {
  useMemo,
  useState,
  useEffect,
  useContext,
  useCallback,
  Navigate,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faEyeSlash,
  faWallet,
  faArrowRightLong,
} from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import "../../../styles/seller-wallet.css";
import { AuthContext } from "../../../contexts/AuthContext";
import { apiUrl, API_CONFIG } from "../../../config/api";

const fmtVND = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    Number(n) || 0
  );

// thêm ở trên cùng, cạnh fmtDateTime
const getTypeLabel = (t = "") => {
  const key = String(t).toUpperCase();
  switch (key) {
    case "DEPOSIT":
      return "Nạp tiền";
    case "WITHDRAW":
      return "Rút tiền";
    // (tuỳ BE có thêm type khác thì map tiếp ở đây)
    default:
      return "Khác";
  }
};

const fmtDateTime = (iso) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso || "";
    return d.toLocaleString("vi-VN");
  } catch {
    return iso || "";
  }
};

// Nhận diện refund
const isRefund = (desc = "") =>
  /^(refund\s+for\s+rejected\s+withdraw\s+request)/i.test(String(desc || ""));

const labelForType = (type, desc) => {
  if (isRefund(desc)) return "Nạp tiền";
  const t = String(type || "").toUpperCase();
  if (t === "DEPOSIT") return "Nạp tiền";
  if (t === "WITHDRAW") return "Rút tiền";
  return "Khác";
};

// Ghi chú (giữ nội dung, Việt hoá các prefix tiếng Anh)
const shortNote = (desc = "") => {
  const s = String(desc || "").trim();
  if (!s) return "—";

  // Refund → Hoàn tiền do yêu cầu rút bị từ chối: <lý do>
  if (isRefund(s)) {
    const parts = s.split(":");
    const reason = parts.slice(1).join(":").trim();
    return `Hoàn tiền do yêu cầu rút bị từ chối${reason ? `: ${reason}` : ""}`;
  }

  // Nạp tiền qua VNPay → rút gọn như cũ
  const vnp = s.match(/^(Nạp tiền qua VNPay)/i);
  if (vnp) return vnp[1];

  // "Withdraw to <Bank>" → "Rút tiền về <Bank>"
  const wd = s.match(/^withdraw\s+to\s+(.+)/i);
  if (wd) {
    const bank = wd[1].trim();
    return `Rút tiền về ${bank}`;
  }

  // Mặc định giữ nguyên
  return s;
};

// helper parse JSON an toàn
const safeJson = async (res) => {
  const t = await res.text();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return { message: t };
  }
};

export default function SellerWallet() {
  const { user, authFetch, authReady, isAuthenticated } =
    useContext(AuthContext);
  const navigate = useNavigate();

  // ===== sellerId lấy từ userId =====
  const [mySellerId, setMySellerId] = useState("");
  const [sellerLoading, setSellerLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!authReady || !isAuthenticated || !user) {
          if (!cancelled) {
            setMySellerId("");
            setSellerLoading(false);
          }
          return;
        }
        // Lấy userId thật từ getMyProfile
        const r1 = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile), {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const j1 = await safeJson(r1);
        const userId = (j1.result ?? j1)?.id;
        if (!userId) {
          if (!cancelled) {
            setMySellerId("");
            setSellerLoading(false);
          }
          return;
        }
        // Từ userId → sellerId
        const r2 = await authFetch(
          apiUrl(API_CONFIG.endpoints.searchSellerByUserId(userId)),
          { method: "GET", headers: { Accept: "application/json" } }
        );
        if (!r2.ok) {
          if (!cancelled) {
            setMySellerId("");
            setSellerLoading(false);
          }
          return;
        }
        const j2 = await safeJson(r2);
        const sid = j2?.result?.id || "";
        if (!cancelled) {
          setMySellerId(sid);
          setSellerLoading(false);
        }
      } catch {
        if (!cancelled) {
          setMySellerId("");
          setSellerLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated, user, authFetch]);

  // ===== Số dư & lịch sử (theo sellerId) =====
  const [balance, setBalance] = useState(0);
  const [show, setShow] = useState(false);

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Tải số dư theo sellerId
  const loadBalance = useCallback(async () => {
    if (!authReady || !isAuthenticated || !mySellerId) return;
    try {
      const url = apiUrl(API_CONFIG.endpoints.walletBalance(mySellerId));
      const res = await authFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const text = await res.text();
      if (!res.ok) {
        console.warn("Load balance failed:", res.status, text);
        return;
      }
      const json = text ? JSON.parse(text) : {};
      const result = json.result ?? json;
      const bal = typeof result === "number" ? result : result.balance ?? 0;
      setBalance(bal);
    } catch (e) {
      console.warn("Load balance error:", e);
    }
  }, [authFetch, authReady, isAuthenticated, mySellerId]);

  // Tải lịch sử giao dịch theo sellerId
  const loadTransactions = useCallback(async () => {
    if (!authReady || !isAuthenticated || !mySellerId) return;
    setLoading(true);
    setErr("");
    try {
      const url = apiUrl(
        API_CONFIG.endpoints.walletTransactions(mySellerId, { page, size })
      );
      const res = await authFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      const json = text ? JSON.parse(text) : {};
      const result = json.result ?? json;

      setRows(Array.isArray(result?.content) ? result.content : []);
      setTotalPages(Number(result?.totalPages) || 0);
    } catch (e) {
      setErr(e.message || "Không tải được lịch sử giao dịch");
      setRows([]);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [authFetch, authReady, isAuthenticated, mySellerId, page, size]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const masked = useMemo(() => "*****", []);
  const displayAmount = show ? fmtVND(balance) : masked;

  const renderAmount = (type, amount, desc) => {
    const plus = isRefund(desc) || String(type).toUpperCase() === "DEPOSIT";
    return (
      <div className={`sw-money ${plus ? "plus" : "minus"}`}>
        {plus ? "+ " : "- "}
        {fmtVND(Math.abs(Number(amount) || 0))}
      </div>
    );
  };

  // Handlers cho pager đẹp
  const handleJumpPage = (val) => {
    const tp = totalPages || 1;
    const n = Math.max(1, Math.min(tp, Number(val) || 1));
    setPage(n - 1);
  };

  return (
    <div className="sw-container">
      <div className="sw-hero">
        <div className="sw-hero-icon">
          <FontAwesomeIcon icon={faWallet} />
        </div>
        <div className="sw-hero-text">
          <div className="sw-hero-title">Ví nhà bán</div>
          <div className="sw-hero-sub">
            Quản lý số dư & rút tiền về tài khoản ngân hàng
          </div>
        </div>
      </div>

      {/* Thông báo khi chưa có sellerId */}
      {!sellerLoading && !mySellerId && (
        <div
          style={{
            margin: "12px 0",
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fff7e6",
            color: "#8a5a00",
            fontWeight: 500,
          }}
        >
          Không tìm thấy thông tin người bán. Hãy hoàn tất đăng ký/duyệt Seller
          để sử dụng ví nhà bán.
        </div>
      )}

      <div className="sw-grid">
        {/* Card Số dư */}
        <div className="sw-card">
          <div className="sw-card-head">
            <div className="sw-card-title">Số dư khả dụng</div>
            <button
              className="sw-eye-btn"
              title={show ? "Ẩn số dư" : "Hiện số dư"}
              onClick={() => setShow((s) => !s)}
              disabled={!mySellerId}
            >
              <FontAwesomeIcon icon={show ? faEyeSlash : faEye} />
            </button>
          </div>
          <div className="sw-amount-row">
            <div className={`sw-amount ${show ? "visible" : "hidden"}`}>
              {mySellerId ? displayAmount : "—"}
            </div>
          </div>

          <div className="sw-actions">
            <button
              className="sw-primary-btn"
              onClick={() => navigate("/seller/wallet/withdraw")}
              disabled={!mySellerId}
            >
              Rút tiền
              <FontAwesomeIcon icon={faArrowRightLong} className="ml-8" />
            </button>
          </div>
        </div>

        {/* Card Hướng dẫn */}
        <div className="sw-card">
          <div className="sw-card-title">Hướng dẫn nhanh</div>
          <ul className="sw-bullets">
            <li>• Số dư khả dụng là số tiền có thể rút ngay.</li>
            <li>
              • Tiền từ đơn hàng sẽ được cộng vào ví sau khi giao thành công.
            </li>
            <li>
              • Thời gian chuyển về ngân hàng tuỳ thuộc ngân hàng của bạn.
            </li>
          </ul>
        </div>
      </div>

      {/* Lịch sử giao dịch */}
      <div className="sw-card">
        <div className="sw-card-title">Lịch sử giao dịch</div>

        {err && (
          <div
            style={{
              marginBottom: 8,
              padding: "8px 10px",
              borderRadius: 8,
              background: "#ffecec",
              color: "#b00020",
              fontWeight: 500,
            }}
          >
            {err}
          </div>
        )}

        <div className="sw-table">
          <div className="sw-thead">
            <div>Thời gian</div>
            <div>Loại</div>
            <div>Số tiền</div>
            <div>Ghi chú</div>
          </div>

        {!mySellerId ? (
            <div className="sw-row">
              <div style={{ gridColumn: "1 / span 4", opacity: 0.7 }}>
                Chưa sẵn sàng — thiếu thông tin người bán
              </div>
            </div>
          ) : loading ? (
            <div className="sw-row">
              <div style={{ gridColumn: "1 / span 4", opacity: 0.7 }}>
                Đang tải…
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="sw-row">
              <div style={{ gridColumn: "1 / span 4", opacity: 0.7 }}>
                Chưa có giao dịch
              </div>
            </div>
          ) : (
            rows.map((tr) => (
              <div className="sw-row" key={tr.id}>
                <div>{fmtDateTime(tr.createdAt)}</div>

                {/* Loại: ép Refund => Nạp tiền */}
                <div>{labelForType(tr.type, tr.description)}</div>

                {/* Số tiền: ép Refund => dấu + */}
                <div>{renderAmount(tr.type, tr.amount, tr.description)}</div>

                {/* Ghi chú rút gọn */}
                <div title={tr.description || ""}>
                  {shortNote(tr.description)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination đẹp */}
        <div className="sw-pager">
          <div className="sw-pg-group">
            <button
              className="sw-pg-btn"
              disabled={page <= 0 || loading || !mySellerId}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ← Trước
            </button>

            <div className="sw-pg-status">
              <span>Trang</span>
              <input
                className="sw-page-input"
                type="number"
                min={1}
                max={Math.max(1, totalPages)}
                value={totalPages === 0 ? 0 : page + 1}
                onChange={(e) => handleJumpPage(e.target.value)}
                disabled={!mySellerId}
              />
              <span>/ {Math.max(1, totalPages)}</span>
            </div>

            <button
              className="sw-pg-btn"
              disabled={
                page >= totalPages - 1 || loading || totalPages === 0 || !mySellerId
              }
              onClick={() =>
                setPage((p) =>
                  totalPages ? Math.min(totalPages - 1, p + 1) : p
                )
              }
            >
              Sau →
            </button>
          </div>

          <div className="sw-size">
            <label className="sw-size-label">Mỗi trang</label>
            <select
              className="sw-size-select"
              value={size}
              onChange={(e) => {
                setPage(0);
                setSize(Number(e.target.value) || 10);
              }}
              disabled={!mySellerId}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
