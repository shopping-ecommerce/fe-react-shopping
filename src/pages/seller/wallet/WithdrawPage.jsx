"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useContext,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import "../../../styles/seller-withdraw.css";
import { AuthContext } from "../../../contexts/AuthContext";
import { apiUrl, API_CONFIG, VN_BANKS } from "../../../config/api";

const nf = new Intl.NumberFormat("en-US");
const fmtVND = (n) => nf.format(Number(n) || 0);

// 🔹 Mức rút tối thiểu
const MIN_WITHDRAW = 50000;

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

export default function WithdrawPage() {
  const { user, authFetch, authReady, isAuthenticated } =
    useContext(AuthContext);
  const navigate = useNavigate();

  // ===== sellerId lấy từ userId (giống trang SellerWallet) =====
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

        // 1) Lấy userId thật từ getMyProfile
        const r1 = await authFetch(
          apiUrl(API_CONFIG.endpoints.getMyProfile),
          {
            method: "GET",
            headers: { Accept: "application/json" },
          }
        );
        const j1 = await safeJson(r1);
        const userId = (j1.result ?? j1)?.id;
        if (!userId) {
          if (!cancelled) {
            setMySellerId("");
            setSellerLoading(false);
          }
          return;
        }

        // 2) Từ userId → sellerId
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

  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(0);

  // Form
  const [amount, setAmount] = useState(0);
  const [bank, setBank] = useState(VN_BANKS[0]?.name || "");
  const [bankCustom, setBankCustom] = useState("");
  const [account, setAccount] = useState("");
  const [holder, setHolder] = useState("");
  const [msg, setMsg] = useState("");

  const chips = [50000, 100000, 200000, 500000];
  const isCustomBank = bank === "__OTHER__";
  const chosenBankName = isCustomBank ? bankCustom.trim() : bank.trim();

  const overBalance = useMemo(
    () => Number(amount) > Number(balance),
    [amount, balance]
  );
  const tooSmall = amount > 0 && Number(amount) < MIN_WITHDRAW;

  const canSubmit =
    !loading &&
    !!mySellerId &&                    // 🔹 phải có sellerId
    amount >= MIN_WITHDRAW &&          // 🔹 đủ min
    !overBalance &&
    chosenBankName &&
    account.trim() &&
    holder.trim();

  // Lấy số dư theo sellerId (đồng bộ với SellerWallet)
  const loadBalance = useCallback(async () => {
    if (!authReady || !isAuthenticated || !mySellerId) return;
    try {
      const url = apiUrl(API_CONFIG.endpoints.walletBalance(mySellerId));
      const res = await authFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const text = await res.text();
      if (!res.ok) return;
      const json = text ? JSON.parse(text) : {};
      const result = json.result ?? json;
      const bal = typeof result === "number" ? result : result.balance ?? 0;
      setBalance(bal);
    } catch {}
  }, [authFetch, authReady, isAuthenticated, mySellerId]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  // Helpers
  const setChip = (v) => {
    // toggle: nếu đang chọn lại → về 0
    setAmount((curr) => (Number(curr) === Number(v) ? 0 : Number(v)));
    setMsg("");
  };

  const onAmountChange = (e) => {
    // nhận string có thể đã format → bỏ mọi ký tự không phải số
    const digits = e.target.value.replace(/[^\d]/g, "");
    setAmount(digits ? Number(digits) : 0);
    setMsg("");
  };

  const onAccountChange = (e) => {
    // cho phép số, khoảng trắng
    const s = e.target.value.replace(/[^\d\s]/g, "");
    setAccount(s);
  };

  const onSubmit = async () => {
    if (!canSubmit || !mySellerId) return;
    setLoading(true);
    setMsg("");
    try {
      // 🔹 Dùng sellerId giống trang ví
      const url = apiUrl(API_CONFIG.endpoints.walletWithdraw(mySellerId));
      const res = await authFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          amount: Number(amount),
          bankAccount: account.trim(),
          bankName: chosenBankName,
          accountHolderName: holder.trim(),
        }),
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);

      setMsg("✅ Gửi yêu cầu rút tiền thành công!");
      loadBalance();
      setAmount(0);
      setAccount("");
      setHolder("");
      setBank(VN_BANKS[0]?.name || "");
      setBankCustom("");
      setTimeout(() => navigate("/seller/wallet"), 900);
    } catch (e) {
      setMsg(`❌ ${e.message || "Gửi yêu cầu thất bại"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wd-container">
      <div className="wd-header">
        <button className="wd-back" onClick={() => navigate(-1)}>
          ← Quay lại
        </button>
        <h1>Rút tiền về ngân hàng</h1>
        <div />
      </div>

      {/* Thông báo nếu chưa có sellerId */}
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
          để sử dụng chức năng rút tiền.
        </div>
      )}

      <div className="wd-grid">
        {/* Trái: số dư + nhập số tiền */}
        <div className="wd-card wd-tilt">
          <div className="wd-card-title">Số dư khả dụng</div>
          <div className="wd-balance">
            <div className="wd-balance-number">
              {fmtVND(balance)}
              <span className="wd-currency"> ₫</span>
            </div>
            <div className="wd-balance-sub">Có thể rút ngay</div>
          </div>

          <div className="wd-section">
            <label className="wd-label">Số tiền muốn rút</label>
            <div
              className={`wd-amount-input ${
                overBalance || tooSmall ? "danger" : ""
              }`}
            >
              <span className="wd-prefix">₫</span>
              <input
                inputMode="numeric"
                pattern="\d*"
                placeholder="0"
                value={amount ? fmtVND(amount) : ""}
                onChange={onAmountChange}
              />
              {amount > 0 && (
                <button
                  className="wd-clear"
                  onClick={() => setAmount(0)}
                  title="Xoá"
                >
                  ×
                </button>
              )}
            </div>

            {/* Ưu tiên cảnh báo hết số dư, nếu không thì cảnh báo min */}
            {overBalance ? (
              <div className="wd-error">
                Số dư không khả dụng cho số tiền đã chọn.
              </div>
            ) : tooSmall ? (
              <div className="wd-error">
                Số tiền rút phải từ {fmtVND(MIN_WITHDRAW)}đ.
              </div>
            ) : null}
          </div>

          <div className="wd-section">
            <div className="wd-label">Mệnh giá nhanh</div>
            <div className="wd-chips">
              {chips.map((c) => {
                const active = Number(amount) === c;
                return (
                  <button
                    key={c}
                    className={`wd-chip ${active ? "active" : ""}`}
                    onClick={() => setChip(c)}
                  >
                    {fmtVND(c)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Phải: thông tin ngân hàng */}
        <div className="wd-card wd-tilt">
          <div className="wd-card-title">Thông tin tài khoản nhận</div>

          <div className="wd-section">
            <label className="wd-label">Ngân hàng</label>
            <div className="wd-select-wrap">
              <select value={bank} onChange={(e) => setBank(e.target.value)}>
                {VN_BANKS.map((b) => (
                  <option key={b.code || b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
                <option value="__OTHER__">Khác …</option>
              </select>
            </div>
          </div>

          {isCustomBank && (
            <div className="wd-section">
              <label className="wd-label">Nhập tên ngân hàng</label>
              <input
                className="wd-input"
                placeholder="VD: Ngan hang TMCP XYZ"
                value={bankCustom}
                onChange={(e) => setBankCustom(e.target.value)}
              />
            </div>
          )}

          <div className="wd-section">
            <label className="wd-label">Số tài khoản</label>
            <input
              className="wd-input"
              placeholder="Nhập số tài khoản"
              value={account}
              onChange={onAccountChange}
            />
          </div>

          <div className="wd-section">
            <label className="wd-label">Tên chủ tài khoản</label>
            <input
              className="wd-input"
              placeholder="VIẾT HOA KHÔNG DẤU"
              value={holder}
              onChange={(e) => setHolder(e.target.value.toUpperCase())}
            />
          </div>

          {msg && (
            <div className={`wd-msg ${msg.startsWith("✅") ? "ok" : "err"}`}>
              {msg}
            </div>
          )}

          <div className="wd-actions">
            <button
              className="wd-submit"
              disabled={!canSubmit}
              onClick={onSubmit}
            >
              {loading ? "Đang gửi yêu cầu…" : "Gửi yêu cầu rút tiền"}
            </button>
          </div>

          <p className="wd-note">
            Lưu ý: Thời gian nhận tiền phụ thuộc ngân hàng của bạn. Hãy kiểm tra
            kỹ thông tin trước khi gửi yêu cầu.
          </p>
        </div>
      </div>
    </div>
  );
}
