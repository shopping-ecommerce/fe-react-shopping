"use client";

import React, {
  useMemo,
  useState,
  useEffect,
  useContext,
  useCallback,
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

const fmtDateTime = (iso) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso || "";
    return d.toLocaleString("vi-VN");
  } catch {
    return iso || "";
  }
};

const isRefund = (desc = "") =>
  /^(refund\s+for)/i.test(String(desc || ""));
const isPayment = (desc = "") =>
  /^(payment\s+for\s+order)/i.test(String(desc || ""));

const labelForType = (type, desc) => {
  const s = String(desc || "");
  if (isRefund(s)) return "Hoàn tiền";
  if (isPayment(s)) return "Thanh toán";

  const t = String(type || "").toUpperCase();
  if (t === "DEPOSIT") return "Nạp tiền";
  if (t === "WITHDRAW") return "Rút tiền";
  return "Khác";
};

const shortNote = (desc = "") => {
  const s = String(desc || "").trim();
  if (!s) return "—";

  const refundMatch = s.match(/^refund\s+for\s+cancelled\s+order\s+(.+)/i);
  if (refundMatch) {
    const orderId = refundMatch[1].trim();
    return `Hoàn tiền cho đơn hàng ${orderId}`;
  }

  if (isRefund(s)) {
      const parts = s.split(":");
      const reason = parts.slice(1).join(":").trim();
      return `Hoàn tiền${reason ? `: ${reason}` : ""}`;
  }

  const paymentMatch = s.match(/^payment\s+for\s+order\s+(.+)/i);
  if (paymentMatch) {
    const orderId = paymentMatch[1].trim();
    return `Thanh toán cho đơn hàng ${orderId}`;
  }
  
  const vnpMatch = s.match(/^(Nạp tiền qua VNPay)/i);
  if (vnpMatch) return vnpMatch[1];

  return s;
};

export default function UserWallet() {
  const { user, authFetch, authReady, isAuthenticated } =
    useContext(AuthContext);
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [show, setShow] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const userId = user?.id || "";

  const loadBalance = useCallback(async () => {
    if (!authReady || !isAuthenticated || !userId) return;
    try {
      const url = apiUrl(API_CONFIG.endpoints.walletBalance(userId));
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
  }, [authFetch, authReady, isAuthenticated, userId]);

  const loadTransactions = useCallback(async () => {
    if (!authReady || !isAuthenticated || !userId) return;
    setLoading(true);
    setErr("");
    try {
      const url = apiUrl(
        API_CONFIG.endpoints.walletTransactions(userId, { page, size })
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
  }, [authFetch, authReady, isAuthenticated, userId, page, size]);

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
          <div className="sw-hero-title">Ví của tôi</div>
          <div className="sw-hero-sub">
            Quản lý số dư và lịch sử giao dịch
          </div>
        </div>
      </div>

      <div className="sw-grid">
        {/* Card Số dư */}
        <div className="sw-card">
          <div className="sw-card-head">
            <div className="sw-card-title">Số dư khả dụng</div>
            <button
              className="sw-eye-btn"
              title={show ? "Ẩn số dư" : "Hiện số dư"}
              onClick={() => setShow((s) => !s)}
            >
              <FontAwesomeIcon icon={show ? faEyeSlash : faEye} />
            </button>
          </div>
          <div className="sw-amount-row">
            <div className={`sw-amount ${show ? "visible" : "hidden"}`}>
              {displayAmount}
            </div>
          </div>

          <div className="sw-actions">
            <button
              className="sw-primary-btn"
              onClick={() => navigate("/account/wallet/withdraw")}
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
            <li>• Số dư khả dụng là số tiền bạn có thể dùng để thanh toán.</li>
            <li>• Nạp tiền vào ví giúp thanh toán đơn hàng nhanh chóng hơn.</li>
            <li>• Tiền hoàn từ các đơn hàng bị hủy sẽ được cộng vào ví.</li>
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

          {loading ? (
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
                <div>{labelForType(tr.type, tr.description)}</div>
                <div>{renderAmount(tr.type, tr.amount, tr.description)}</div>
                <div title={tr.description || ""}>
                  {shortNote(tr.description)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="sw-pager">
          <div className="sw-pg-group">
            <button
              className="sw-pg-btn"
              disabled={page <= 0 || loading}
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
              />
              <span>/ {Math.max(1, totalPages)}</span>
            </div>
            <button
              className="sw-pg-btn"
              disabled={page >= totalPages - 1 || loading || totalPages === 0}
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