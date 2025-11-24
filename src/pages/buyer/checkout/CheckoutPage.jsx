// src/pages/buyer/checkout/CheckoutPage.jsx
"use client";

import { useMemo, useState, useEffect, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../../../styles/CheckoutPage.css";
import AddressPickerModal from "../../../pages/buyer/checkout/AddressPickerModal";
import RecipientEditModal from "../../../pages/buyer/checkout/RecipientEditModal";
import { AuthContext } from "../../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../../config/api";
import { removeCartItemsBatch } from "../../../services/cartService";
import { createNotification } from "../../../services/notificationService";

const fmtVND = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    n ?? 0
  );
const fmt = (n) => new Intl.NumberFormat("en-US").format(Number(n) || 0);

const SHIPPING_BASE_FEE = 30000;
const PROVINCE_TREE_URL = "https://provinces.open-api.vn/api/?depth=3";
const makePaymentRef = (userId) => {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `${userId}:${ts}:${rand}`;
};

const VOUCHER_APPLY_PATH = "/voucher/apply";
const VOUCHER_COMPLETE_PATH = "/voucher/complete";

const pickDefaultAddress = (addresses = []) =>
  addresses.find((a) => a.is_default) || addresses[0] || null;

const guessName = (p = {}) => {
  const full = p.fullName || p.full_name || p.name || p.displayName;
  if (full) return full;
  const combo = [p.first_name || p.firstName, p.last_name || p.lastName]
    .filter(Boolean)
    .join(" ");
  return combo || "";
};
const guessPhone = (p = {}) => p.phone || p.phone_number || p.mobile || "";

/* =========================
   Helpers cho ảnh & options
========================= */
const firstTruthy = (...vals) =>
  vals.find((v) => v !== undefined && v !== null && String(v).trim() !== "");

const getItemImage = (it) =>
  firstTruthy(
    it.image,
    it.imageUrl,
    it.thumbnail,
    Array.isArray(it.images) ? it.images[0]?.url || it.images[0] : null,
    "https://placehold.co/150x150"
  );

const _readOptionFromObj = (obj, regex) => {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const k = Object.keys(obj).find((key) => regex.test(key));
    if (k) return obj[k];
  }
  return undefined;
};
const _readOptionFromArr = (arr, regex) => {
  if (!Array.isArray(arr)) return undefined;
  const f = arr.find((o) => regex.test(String(o?.name || o?.label || "")));
  return firstTruthy(f?.value, f?.selected, f?.optionValue);
};
const readOption = (it, regex) => {
  const fromObj =
    _readOptionFromObj(it.options, regex) ??
    _readOptionFromObj(it.selectedOptions, regex);
  if (fromObj !== undefined) return fromObj;
  return (
    _readOptionFromArr(it.options, regex) ??
    _readOptionFromArr(it.selectedOptions, regex)
  );
};

const getSelectedSize = (it) =>
  firstTruthy(
    readOption(it, /kích cỡ|kich co|kích thước|kich thuoc|size/i),
    it.size,
    it.variantSize,
    ""
  );
const getSelectedColor = (it) =>
  firstTruthy(
    readOption(it, /màu sắc|mau sac|màu|mau|color|colour/i),
    it.color,
    it.colour,
    it.colorName,
    ""
  );

// chuẩn hoá key "linh hoạt" => key chuẩn
const normalizeKey = (k) =>
  String(k || "")
    .trim()
    .toLowerCase();
const toCanonicalOptions = (obj = {}) => {
  const out = {};
  for (const [k, vRaw] of Object.entries(obj)) {
    const v = String(vRaw ?? "").trim();
    if (!v || v.toUpperCase() === "FREE") continue; // bỏ placeholder khi hiển thị
    const kk = normalizeKey(k);
    if (["size", "kích cỡ", "kích thước"].includes(kk)) out["Kích cỡ"] = v;
    else if (["màu sắc", "màu", "color", "colour"].includes(kk))
      out["Màu sắc"] = v;
    else out[k] = v;
  }
  return out;
};

/**
 * Options cho HIỂN THỊ (ẩn FREE)
 * - dùng cho UI (OrderSummary)
 */
const buildOptionsForDisplay = (it) => {
  const base =
    (it && typeof it.options === "object" && it.options) ||
    (it && typeof it.selectedOptions === "object" && it.selectedOptions) ||
    {};
  let out = toCanonicalOptions(base);

  if (Object.keys(out).length === 0) {
    const size = String(getSelectedSize(it) || "").trim();
    const color = String(getSelectedColor(it) || "").trim();
    if (color) out["Màu sắc"] = color;
    if (size && size.toUpperCase() !== "FREE") out["Kích cỡ"] = size;
  }
  return out;
};

/**
 * Options cho GỬI LÊN BE (luôn có ít nhất 1 key)
 * - nếu người dùng không chọn gì, sẽ gửi { "Kích cỡ": "FREE" }
 */
const buildOptionsForPayload = (it) => {
  const base =
    (it && typeof it.options === "object" && it.options) ||
    (it && typeof it.selectedOptions === "object" && it.selectedOptions) ||
    {};
  const canonical = {};
  for (const [k, vRaw] of Object.entries(base)) {
    const v = String(vRaw ?? "").trim();
    const kk = normalizeKey(k);
    if (!v) continue;
    if (["size", "kích cỡ", "kích thước"].includes(kk))
      canonical["Kích cỡ"] = v;
    else if (["màu sắc", "màu", "color", "colour"].includes(kk))
      canonical["Màu sắc"] = v;
    else canonical[k] = v;
  }
  if (Object.keys(canonical).length === 0) {
    const size = String(getSelectedSize(it) || "").trim();
    const color = String(getSelectedColor(it) || "").trim();
    if (color) canonical["Màu sắc"] = color;
    if (size) canonical["Kích cỡ"] = size; // có thể là "FREE"
  }
  if (Object.keys(canonical).length === 0) {
    canonical["Kích cỡ"] = "FREE";
  }
  return canonical;
};

/** Form địa chỉ */
function AddressForm({
  defaultName,
  defaultPhone,
  onSaved,
  authFetch,
  profileId,
}) {
  const [fullName, setFullName] = useState(defaultName || "");
  const [phone, setPhone] = useState(defaultPhone || "");
  const [addressLine, setAddressLine] = useState("");
  const [vnTree, setVnTree] = useState([]);
  const [province, setProvince] = useState(null);
  const [district, setDistrict] = useState(null);
  const [ward, setWard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => setFullName(defaultName || ""), [defaultName]);
  useEffect(() => setPhone(defaultPhone || ""), [defaultPhone]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(PROVINCE_TREE_URL, { cache: "no-store" });
        const data = await res.json();
        setVnTree(Array.isArray(data) ? data : []);
      } catch {}
    })();
  }, []);

  const provinces = vnTree;
  const districts = useMemo(() => {
    if (!province) return [];
    const p = vnTree.find((x) => String(x.code) === String(province.code));
    return p?.districts || [];
  }, [vnTree, province]);
  const wards = useMemo(() => {
    if (!district) return [];
    const d = districts.find((x) => String(x.code) === String(district.code));
    return d?.wards || [];
  }, [districts, district]);

  const canSave =
    fullName.trim() &&
    phone.trim() &&
    addressLine.trim() &&
    province &&
    district &&
    ward;

  const handleSave = async () => {
    if (!canSave) return;
    if (!profileId) {
      setErr("Không tìm thấy thông tin user.");
      return;
    }
    const fullAddress = [
      addressLine.trim(),
      ward?.name,
      district?.name,
      province?.name,
    ]
      .filter(Boolean)
      .join(", ");

    try {
      setLoading(true);
      setErr("");

      const res = await authFetch(apiUrl(API_CONFIG.endpoints.addAddress), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: profileId,
          address: { address: fullAddress, is_default: true },
        }),
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);

      onSaved?.({
        address: fullAddress,
        is_default: true,
        fullName: fullName.trim(),
        phone: phone.trim(),
      });
    } catch (e) {
      setErr(e.message || "Lưu địa chỉ thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="theciu-card">
      <div className="theciu-card-header">
        <h3>Địa chỉ</h3>
      </div>
      <div className="theciu-form">
        <div className="theciu-field-group">
          <div className="theciu-field">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nhập họ và tên"
              className="theciu-input theciu-input-pill"
            />
          </div>
          <div className="theciu-field">
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Nhập số điện thoại"
              className="theciu-input theciu-input-pill"
            />
          </div>
        </div>

        <div className="theciu-field">
          <input
            type="text"
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            placeholder="Nhập địa chỉ chi tiết của bạn"
            className="theciu-input theciu-input-pill"
          />
        </div>

        <div className="theciu-field-row">
          <div className="theciu-field">
            <div className="theciu-select-wrapper">
              <select
                value={province?.code || ""}
                onChange={(e) => {
                  const p = provinces.find(
                    (x) => String(x.code) === String(e.target.value)
                  );
                  setProvince(p || null);
                  setDistrict(null);
                  setWard(null);
                }}
                disabled={!provinces.length}
                className="theciu-select theciu-input-pill"
              >
                <option value="">Chọn tỉnh/thành phố</option>
                {provinces.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="theciu-field">
            <div className="theciu-select-wrapper">
              <select
                value={district?.code || ""}
                onChange={(e) => {
                  const d = districts.find(
                    (x) => String(x.code) === String(e.target.value)
                  );
                  setDistrict(d || null);
                  setWard(null);
                }}
                disabled={!province}
                className="theciu-select theciu-input-pill"
              >
                <option value="">Chọn quận</option>
                {districts.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="theciu-field">
            <div className="theciu-select-wrapper">
              <select
                value={ward?.code || ""}
                onChange={(e) => {
                  const w = wards.find(
                    (x) => String(x.code) === String(e.target.value)
                  );
                  setWard(w || null);
                }}
                disabled={!district}
                className="theciu-select theciu-input-pill"
              >
                <option value="">Chọn phường/xã</option>
                {wards.map((w) => (
                  <option key={w.code} value={w.code}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {err && (
          <div className="form-error" style={{ marginTop: 8 }}>
            {err}
          </div>
        )}

        <button
          className="theciu-btn-primary theciu-btn-full"
          disabled={!canSave || loading}
          onClick={handleSave}
        >
          {loading ? "Đang lưu..." : "Cập nhật thông tin"}
        </button>
      </div>
    </div>
  );
}

/** Sidebar tóm tắt */
function OrderSummary({
  items,
  shippingFee,
  total,
  onCheckout,
  canCheckout,
  note,
  onNoteChange,
  isPaying,
  selectedDiscountTotal,
}) {
  const subtotal = useMemo(
    () => items.reduce((s, it) => s + it.price * it.qty, 0),
    [items]
  );

  return (
    <div className="theciu-card theciu-sticky">
      <div className="theciu-card-header">
        <h3>Đơn hàng của bạn</h3>
      </div>
      <div className="theciu-order-summary">
        <div className="theciu-muted">
          Có {items.length} sản phẩm trong giỏ hàng
        </div>
        <div className="theciu-divider" />
        <div className="theciu-products in-summary">
          {items.map((item) => (
            <div
              className="theciu-product-item"
              key={item.id || item.productId}
            >
              <img
                src={getItemImage(item)}
                alt={item.title}
                className="theciu-product-image"
                onError={(e) =>
                  (e.currentTarget.src = "https://placehold.co/150x150")
                }
                loading="lazy"
              />
              <div className="theciu-product-info">
                <h4 className="theciu-product-title">{item.title}</h4>

                {Object.entries(buildOptionsForDisplay(item)).map(([k, v]) => (
                  <p key={k} className="theciu-product-variant">
                    {k}: {String(v)}
                  </p>
                ))}

                <div className="theciu-product-meta">
                  <span className="theciu-product-qty">x{item.qty}</span>
                  <span className="theciu-product-price">
                    {fmtVND(item.price)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="theciu-divider" />
        <div className="theciu-price-breakdown">
          <div className="theciu-price-row">
            <span>Tổng giá</span>
            <span>{fmtVND(subtotal)}</span>
          </div>
          <div className="theciu-price-row">
            <span>Phí vận chuyển</span>
            <span>{fmtVND(shippingFee)}</span>
          </div>
          <div className="theciu-price-row">
            <span>Giảm từ voucher</span>
            <span
              className={selectedDiscountTotal > 0 ? "theciu-discount" : ""}
            >
              {selectedDiscountTotal > 0
                ? `-${fmt(selectedDiscountTotal)} đ`
                : `${fmt(0)} đ`}
            </span>
          </div>
        </div>

        <div className="theciu-divider" />
        <div className="theciu-price-breakdown">
          <div className="theciu-price-row theciu-total-row">
            <span style={{ fontWeight: 800, color: "#000" }}>Tổng cộng</span>
            <strong>{fmtVND(total)}</strong>
          </div>
        </div>

        <div className="theciu-divider" />
        <div className="theciu-note-wrapper">
          <label className="theciu-note-label">Ghi chú đơn hàng</label>
          <textarea
            rows={4}
            className="theciu-note-textarea"
            placeholder="Nhập ghi chú cho đơn hàng của bạn..."
            value={note}
            onChange={(e) => onNoteChange?.(e.target.value)}
          />
        </div>

        <button
          className={`theciu-btn-checkout ${isPaying ? "is-loading" : ""}`}
          disabled={!canCheckout || isPaying}
          onClick={onCheckout}
        >
          {isPaying ? (
            <>
              Đang thanh toán
              <span className="theciu-loading-dots">
                <span>•</span>
                <span>•</span>
                <span>•</span>
              </span>
            </>
          ) : (
            "Đặt hàng"
          )}
        </button>
        <p className="theciu-note small">
          *Số tiền sẽ được quy đổi sang VND theo tỷ giá tại thời điểm thanh
          toán.
        </p>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { authFetch } = useContext(AuthContext);

  const [items, setItems] = useState([]);
  const [address, setAddress] = useState(null);
  const [profileId, setProfileId] = useState(null);

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  const [showAddrModal, setShowAddrModal] = useState(false);
  const [showRecipientModal, setShowRecipientModal] = useState(false);

  const [shipping, setShipping] = useState("standard");
  const [payment, setPayment] = useState("bank");
  const [note, setNote] = useState("");

  const [isPaying, setIsPaying] = useState(false);

  const [usableBySeller, setUsableBySeller] = useState({});

  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherErr, setVoucherErr] = useState("");

  const [sellerNameMap, setSellerNameMap] = useState({});
  const [selectedBySeller, setSelectedBySeller] = useState({});

  // nhận items từ state + sessionStorage
  useEffect(() => {
    const fromState = location.state?.items;
    if (Array.isArray(fromState) && fromState.length) {
      setItems(fromState);
      sessionStorage.setItem("checkout_items", JSON.stringify(fromState));
    } else {
      const cached = sessionStorage.getItem("checkout_items");
      setItems(cached ? JSON.parse(cached) : []);
    }
  }, [location.state]);

  // Load profile + địa chỉ
  useEffect(() => {
    (async () => {
      try {
        const cachedAddr = sessionStorage.getItem("checkout_address");
        const cachedContact = sessionStorage.getItem("checkout_contact");

        const res = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile));
        const data = await res.json().catch(() => ({}));
        const result = data?.result ?? data ?? {};

        if (result?.id) {
          setProfileId(result.id);
          sessionStorage.setItem("user_id", result.id);
        }

        const prefName = guessName(result);
        const prefPhone = guessPhone(result);

        if (cachedContact) {
          try {
            const c = JSON.parse(cachedContact);
            setRecipientName(c.name || prefName);
            setRecipientPhone(c.phone || prefPhone);
          } catch {
            setRecipientName(prefName);
            setRecipientPhone(prefPhone);
          }
        } else {
          setRecipientName(prefName);
          setRecipientPhone(prefPhone);
        }

        if (cachedAddr) {
          try {
            setAddress(JSON.parse(cachedAddr));
          } catch {
            const list = Array.isArray(result.addresses)
              ? result.addresses
              : [];
            const def = pickDefaultAddress(list);
            if (def) {
              setAddress(def);
              sessionStorage.setItem("checkout_address", JSON.stringify(def));
            } else setAddress(null);
          }
        } else {
          const list = Array.isArray(result.addresses) ? result.addresses : [];
          const def = pickDefaultAddress(list);
          if (def) {
            setAddress(def);
            sessionStorage.setItem("checkout_address", JSON.stringify(def));
          } else setAddress(null);
        }
      } catch (e) {
        console.error("❌ Không lấy được profile/địa chỉ:", e);
      }
    })();
  }, [authFetch]);

  const handlePickedAddress = (addrObj) => {
    setAddress(addrObj);
    sessionStorage.setItem("checkout_address", JSON.stringify(addrObj));
  };

  const handleSavedNewAddress = (addrObj) => {
    setAddress({ address: addrObj.address, is_default: !!addrObj.is_default });
    setRecipientName(addrObj.fullName || recipientName);
    setRecipientPhone(addrObj.phone || recipientPhone);
    sessionStorage.setItem(
      "checkout_address",
      JSON.stringify({
        address: addrObj.address,
        is_default: !!addrObj.is_default,
      })
    );
  };

  const hasAddress = !!address;
  const canCheckout =
    hasAddress &&
    items.length > 0 &&
    recipientName.trim() &&
    recipientPhone.trim();

  const shippingFee = useMemo(
    () => (shipping === "fast" ? 45000 : SHIPPING_BASE_FEE),
    [shipping]
  );

  const sellerGroups = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      let sellerId = it.sellerId;
      if (!sellerId && it.id && typeof it.id === "string") {
        const parts = it.id.split("-");
        if (parts.length >= 2) sellerId = parts[0];
      }
      if (!sellerId) continue;
      if (!map.has(sellerId)) map.set(sellerId, { items: [], amount: 0 });
      map.get(sellerId).items.push(it);
      map.get(sellerId).amount += (it.price || 0) * (it.qty || 0);
    }
    return Array.from(map.entries()).map(([sellerId, data]) => ({
      sellerId,
      ...data,
    }));
  }, [items]);

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + it.price * it.qty, 0),
    [items]
  );

  const selectedDiscountTotal = useMemo(
    () =>
      Object.values(selectedBySeller).reduce(
        (s, v) => s + (Number(v?.discountAmount) || 0),
        0
      ),
    [selectedBySeller]
  );

  const total = Math.max(0, subtotal + shippingFee - selectedDiscountTotal);
  const toPaymentEnum = (p) =>
    p === "cod" ? "CASH_ON_DELIVERY" : "BANK_TRANSFER";

  // === FETCH shop names ===
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = Array.from(
        new Set(sellerGroups.map((g) => g.sellerId))
      ).filter(Boolean);
      const toFetch = ids.filter((id) => !(id in sellerNameMap));
      if (toFetch.length === 0) return;

      const next = {};
      for (const sid of toFetch) {
        try {
          const url = apiUrl(API_CONFIG.endpoints.searchSellerBySellerId(sid));
          const res = await authFetch(url, {
            method: "GET",
            headers: { Accept: "application/json" },
          });
          const data = await res.json().catch(() => ({}));
          const name =
            data?.result?.shop_name ||
            data?.result?.shopName ||
            data?.result?.name ||
            sid;
          next[sid] = name;
        } catch {
          next[sid] = sid;
        }
      }
      if (!cancelled) setSellerNameMap((m) => ({ ...m, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, sellerGroups, sellerNameMap]);

  // === FETCH usable vouchers per seller ===
  useEffect(() => {
    if (!profileId || sellerGroups.length === 0) {
      setUsableBySeller({});
      return;
    }

    let cancelled = false;
    const aborter = new AbortController();

    (async () => {
      try {
        setVoucherLoading(true);
        setVoucherErr("");

        const next = {};
        for (const g of sellerGroups) {
          const orderAmount = Math.round(g.amount || 0);
          const url = apiUrl(
            `/voucher/usable-vouchers?userId=${encodeURIComponent(
              profileId
            )}&sellerId=${encodeURIComponent(
              g.sellerId
            )}&orderAmount=${encodeURIComponent(orderAmount)}`
          );

          try {
            const res = await authFetch(url, {
              method: "GET",
              headers: { Accept: "application/json" },
              signal: aborter.signal,
            });
            const data = await res.json().catch(() => ({}));
            const arr = Array.isArray(data?.result)
              ? data.result
              : Array.isArray(data)
              ? data
              : [];
            next[g.sellerId] = arr;
          } catch (e) {
            next[g.sellerId] = [];
            if (!cancelled)
              setVoucherErr(
                (old) => old || "Không tải được voucher một số shop."
              );
          }
        }

        if (!cancelled) setUsableBySeller(next);
      } finally {
        if (!cancelled) setVoucherLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      aborter.abort();
    };
  }, [authFetch, profileId, sellerGroups]);

  const handleSelectVoucher = async (sellerId, voucher) => {
    if (!profileId) {
      alert("Vui lòng đăng nhập.");
      return;
    }
    const group = sellerGroups.find((g) => g.sellerId === sellerId);
    const orderAmount = Math.round(group?.amount || 0);

    if (orderAmount < Number(voucher?.minOrderAmount || 0)) return;

    try {
      const res = await authFetch(apiUrl("/voucher/validate"), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voucherCode: voucher.code,
          userId: profileId,
          orderAmount,
          shippingFee: SHIPPING_BASE_FEE,
          sellerId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.code !== 200 || !data?.result?.valid) {
        throw new Error(
          data?.message || data?.result?.message || "Không hợp lệ"
        );
      }
      const info = data.result.voucherInfo;
      setSelectedBySeller((m) => ({
        ...m,
        [sellerId]: {
          code: info?.code || voucher.code,
          name: info?.name || voucher.name,
          discountAmount: Number(info?.discountAmount || 0),
          voucherId: voucher.voucherId || voucher.id || info?.id || null,
        },
      }));
    } catch (e) {
      alert(e?.message || "Áp dụng voucher thất bại");
    }
  };

  const handleUnselectVoucher = (sellerId) => {
    setSelectedBySeller((m) => {
      const cp = { ...m };
      delete cp[sellerId];
      return cp;
    });
  };

  // === Build payload per seller (dùng cho COD; luồng bank tạo ở OrderSuccess.jsx)
  const toPaymentPayloadGroups = ({
    items,
    address,
    recipientName,
    recipientPhone,
    payment,
    note,
    userId,
    paymentRef,
  }) => {
    const map = new Map();
    for (const it of items) {
      const sellerId = it.sellerId || (it.id || "").split("-")[0];
      if (!sellerId) throw new Error("Item thiếu sellerId");
      if (!map.has(sellerId)) map.set(sellerId, []);
      map.get(sellerId).push(it);
    }

    return Array.from(map.entries()).map(([sellerId, its]) => {
      const normItems = its.map((i) => ({
        productId: String(i.productId).trim(),
        options: buildOptionsForPayload(i),
        quantity: Math.max(1, parseInt(i.qty ?? 1, 10)),
      }));

      const sellerSubtotal = getSellerAmount(sellerId);
      const ship = shipping === "fast" ? 45000 : SHIPPING_BASE_FEE;
      const picked = selectedBySeller[sellerId];
      const discount = Number(picked?.discountAmount || 0);
      const clientTotal = Math.max(0, sellerSubtotal + ship - discount);

      const payload = {
        userId: String(userId).trim(),
        sellerId: String(sellerId).trim(),
        items: normItems,
        paymentStatus: toPaymentEnum(payment),
        shippingAddress:
          (typeof address === "string" ? address : address?.address) || "",
        phoneNumber: (recipientPhone || "").trim(),
        recipientName: (recipientName || "").trim(),
        subtotal: sellerSubtotal,
        shippingFee: ship,
        discountAmount: discount,
        totalAmount: clientTotal,
      };

      if (note?.trim()) payload.notes = note.trim();
      if (selectedBySeller[sellerId]?.code)
        payload.couponCode = selectedBySeller[sellerId].code;

      if (toPaymentEnum(payment) === "BANK_TRANSFER") {
        if (paymentRef) payload.paymentRef = paymentRef; // chỉ đính ref nếu cần
      }
      return payload;
    });
  };

  const createOrders = async (orderPayloads) => {
    const results = [];
    for (let i = 0; i < orderPayloads.length; i++) {
      const payload = orderPayloads[i];
      const res = await authFetch(apiUrl("/order/createOrder"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      const responseText = await res.text();
      let data = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Server returned invalid JSON: ${responseText}`);
      }
      if (!res.ok)
        throw new Error(
          data.message || data.error || `Tạo đơn thất bại (HTTP ${res.status})`
        );
      results.push(data);
    }
    return results;
  };

  // redirect VNPay
  const redirectToVnPay = async ({ userId, amount, orderId }) => {
    if (!userId) throw new Error("userId is required for VNPay payment");
    try {
      const balanceRes = await authFetch(
        apiUrl(API_CONFIG.endpoints.walletBalance(userId)),
        { method: "GET" }
      );
      if (!balanceRes.ok) {
        const createRes = await authFetch(
          apiUrl(API_CONFIG.endpoints.walletCreate(userId)),
          { method: "POST" }
        );
        if (!createRes.ok) throw new Error("Không thể tạo ví thanh toán");
      }
    } catch (walletErr) {
      console.warn("⚠️ Lỗi kiểm tra ví:", walletErr);
    }

    const bankCode = "NCB";
    const url = apiUrl(
      API_CONFIG.endpoints.vnPayUrl({ amount, userId, bankCode, orderId })
    );
    const res = await authFetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(
        data?.message || `Lấy URL thanh toán thất bại (HTTP ${res.status})`
      );
    const payUrl = data?.result;
    if (typeof payUrl !== "string" || !payUrl.startsWith("http"))
      throw new Error("URL thanh toán VNPay không hợp lệ");
    window.location.href = payUrl;
  };

  const getSellerAmount = (sellerId) => {
    const g = sellerGroups.find((x) => x.sellerId === sellerId);
    return Math.round(g?.amount || 0);
  };

  const applySelectedVouchers = async (userId, orderRef) => {
    const entries = Object.entries(selectedBySeller);
    if (entries.length === 0) return {};
    const appliedMap = {};
    for (const [sellerId, sv] of entries) {
      try {
        if (!sv?.voucherId) continue;
        const body = {
          voucherId: String(sv.voucherId),
          userId: String(userId),
          orderId: String(orderRef),
          discountAmount: Number(sv.discountAmount || 0),
          orderAmount: getSellerAmount(sellerId),
        };
        const res = await authFetch(apiUrl(VOUCHER_APPLY_PATH), {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.code === 200 && data?.result) {
          const userVoucherId = data.result;
          appliedMap[sellerId] = userVoucherId;
        } else {
          console.warn("Apply voucher fail for seller", sellerId, data);
        }
      } catch (e) {
        console.warn("Apply voucher error for seller", sellerId, e);
      }
    }
    if (Object.keys(appliedMap).length > 0) {
      setSelectedBySeller((prev) => {
        const cp = { ...prev };
        for (const [sid, uvid] of Object.entries(appliedMap)) {
          cp[sid] = { ...cp[sid], userVoucherId: uvid };
        }
        return cp;
      });
    }
    return appliedMap;
  };

  const completeVoucherUsage = async (userVoucherId) => {
    try {
      if (!userVoucherId) return;
      const url = apiUrl(
        `${VOUCHER_COMPLETE_PATH}/${encodeURIComponent(userVoucherId)}`
      );
      const res = await authFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      await res.json().catch(() => ({}));
    } catch (e) {
      console.warn("Complete voucher usage lỗi:", e);
    }
  };

  const sendOrderCreatedNotification = async (
    authFetch,
    { userId, orderId, totalAmount }
  ) => {
    try {
      const content = {
        text: `Đơn hàng ${orderId} của bạn đã được tạo thành công.`,
        orderId: String(orderId),
        totalAmount: Number(totalAmount || 0),
        link: `/orders/${orderId}`,
      };
      await createNotification(authFetch, { userId, type: "NOTIFY", content });
    } catch (e) {
      console.warn("createNotification failed:", e?.message || e);
    }
  };

  // Checkout
  const handleCheckout = async () => {
    if (!canCheckout || isPaying) return;

    setIsPaying(true);
    try {
      // Lấy userId với các fallback
      let userId =
        sessionStorage.getItem("user_id") ||
        location.state?.userId ||
        profileId;

      if (!userId) {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            userId = parsed?.id || parsed?.user_id;
          } catch {}
        }
      }

      if (!userId) {
        alert("Không xác định được người dùng. Vui lòng đăng nhập lại.");
        setIsPaying(false);
        navigate("/login", { state: { from: "/checkout" } });
        return;
      }

      userId = String(userId);
      const totalFE = Math.round(total);

      // ====== BANK TRANSFER (KHÔNG tạo đơn trước) ======
      if (toPaymentEnum(payment) === "BANK_TRANSFER") {
        const paymentRef = makePaymentRef(userId);

        // 1) Apply giữ chỗ voucher (chưa chốt)
        const appliedMap = await applySelectedVouchers(userId, paymentRef);

        // 2) Lưu draft để OrderSuccess.jsx finalize sau khi BE verify & redirect
        const draft = {
          userId,
          items,
          address:
            typeof address === "string" ? address : address?.address || "",
          recipientName,
          recipientPhone,
          note: (note || "").trim(),
          shipping,
          amount: totalFE,
          paymentStatus: "BANK_TRANSFER",
          paymentRef,
          subtotal: Math.round(subtotal),
          discount: Math.round(selectedDiscountTotal),
          shippingFee,
          selectedVouchers: Object.fromEntries(
            Object.entries(selectedBySeller).map(([sid, sv]) => [
              sid,
              {
                code: sv.code,
                name: sv.name,
                discountAmount: sv.discountAmount,
                voucherId: sv.voucherId || null,
                userVoucherId: appliedMap[sid] || sv.userVoucherId || null,
              },
            ])
          ),
        };
        sessionStorage.setItem("pending_checkout_draft", JSON.stringify(draft));
        sessionStorage.removeItem("last_order_success");

        // 3) Điều hướng VNPay (BE verify xong sẽ 302 về /order-success)
        await redirectToVnPay({ userId, amount: totalFE, orderId: paymentRef });
        return;
      }

      // ====== COD (tạo đơn ngay) ======
      const codRef = `COD:${Date.now()}`;
      const appliedMap = await applySelectedVouchers(userId, codRef);

      const payloads = toPaymentPayloadGroups({
        items,
        address,
        recipientName,
        recipientPhone,
        payment,
        note,
        userId,
        selectedBySeller, // chỉ giữ ngữ cảnh
      });
      const created = await createOrders(payloads);

      // complete voucher
      const userVoucherIds = Object.values(appliedMap).filter(Boolean);
      for (const uvid of userVoucherIds) await completeVoucherUsage(uvid);

      // XÓA GIỎ: theo options (đúng biến thể)
      try {
        const toRemove = items.map((i) => ({
          sellerId:
            i.sellerId || (typeof i.id === "string" ? i.id.split("-")[0] : ""),
          productId: i.productId,
          options: buildOptionsForPayload(i),
        }));
        await removeCartItemsBatch({ userId, items: toRemove });
      } catch (e) {
        console.warn("Xoá giỏ sau đặt hàng lỗi:", e);
      }

      const orderIds = (created || [])
        .map((r) => r?.result?.id)
        .filter(Boolean);
      const sumFromBE = (created || [])
        .map((r) => Number(r?.result?.totalAmount))
        .filter((n) => Number.isFinite(n) && n >= 0)
        .reduce((a, b) => a + b, 0);

      const hadVouchers = Object.keys(selectedBySeller || {}).length > 0;
      const EPS = 1;
      let totalForSuccess;
      if (Number.isFinite(sumFromBE) && sumFromBE > 0) {
        if (hadVouchers && sumFromBE - total > EPS)
          totalForSuccess = Math.round(total);
        else totalForSuccess = Math.round(sumFromBE);
      } else totalForSuccess = Math.round(total);

      sessionStorage.removeItem("checkout_items");
      const orderSuccess = {
        orderIds,
        total: totalForSuccess,
        paymentStatus: toPaymentEnum(payment),
        address: typeof address === "string" ? address : address?.address || "",
        phone: recipientPhone,
        itemsCount: items.length,
        etaText:
          shipping === "fast" ? "5–10 ngày làm việc" : "7–20 ngày làm việc",
        subtotal: Math.round(subtotal),
        discount: Math.round(selectedDiscountTotal),
        shippingFee,
      };
      sessionStorage.setItem(
        "last_order_success",
        JSON.stringify(orderSuccess)
      );

      try {
        for (const oid of orderIds) {
          const found = (created || []).find((r) => r?.result?.id === oid);
          const totalAmountForThis =
            found?.result?.totalAmount ?? totalForSuccess;
          await sendOrderCreatedNotification(authFetch, {
            userId,
            orderId: oid,
            totalAmount: totalAmountForThis,
          });
        }
      } catch {}

      navigate("/order-success", { state: { orderSuccess } });
    } catch (err) {
      console.error("❌ Checkout error:", err);
      alert(err.message || "Đặt hàng thất bại");
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="theciu-checkout">
      <div className="theciu-container">
        <div className="theciu-header">
          <h1>Thanh toán</h1>
          <nav className="theciu-breadcrumb">
            <a href="/cart">Giỏ hàng</a>
            <span>›</span>
            <span>Thanh toán</span>
          </nav>
        </div>

        <div className="theciu-layout">
          <div className="theciu-main">
            {hasAddress ? (
              <div className="theciu-card">
                <div className="theciu-card-header">
                  <h3>Địa chỉ giao hàng</h3>
                  <div className="theciu-card-actions">
                    <button
                      className="theciu-btn-secondary"
                      onClick={() => setShowRecipientModal(true)}
                    >
                      Sửa người nhận
                    </button>
                    <button
                      className="theciu-btn-secondary"
                      onClick={() => setShowAddrModal(true)}
                      style={{ fontWeight: 600 }}
                    >
                      Thay đổi địa chỉ
                    </button>
                  </div>
                </div>

                <div className="theciu-address-display">
                  <div className="theciu-display-row">
                    <div className="theciu-display-field">
                      <strong>{recipientName || "Người nhận"}</strong>
                    </div>
                    <div
                      className="theciu-display-field"
                      style={{ fontWeight: 380 }}
                    >
                      {recipientPhone || "SĐT"}
                    </div>
                  </div>
                  <div
                    className="theciu-display-field"
                    style={{ width: "100%", fontWeight: 380 }}
                  >
                    {address?.address || address}
                  </div>
                  {address?.is_default && (
                    <span className="theciu-tag">Mặc định</span>
                  )}
                </div>
              </div>
            ) : (
              <AddressForm
                defaultName={recipientName}
                defaultPhone={recipientPhone}
                onSaved={handleSavedNewAddress}
                authFetch={authFetch}
                profileId={profileId}
              />
            )}

            {/* Vouchers */}
            {sellerGroups.length > 0 && (
              <div className="theciu-card">
                <div className="theciu-card-header">
                  <h3>Voucher áp dụng</h3>
                  <div style={{ fontSize: 13, color: "#666" }}>
                    {voucherLoading
                      ? "Đang tải voucher…"
                      : "Chọn 1 voucher cho mỗi shop (nếu đủ điều kiện)"}
                  </div>
                </div>

                <div className="theciu-voucher-section">
                  {voucherErr && (
                    <div className="theciu-voucher-error">⚠ {voucherErr}</div>
                  )}
                  {sellerGroups.map((g) => {
                    const list = usableBySeller[g.sellerId] || [];
                    const selected = selectedBySeller[g.sellerId];
                    return (
                      <div className="theciu-voucher-group" key={g.sellerId}>
                        <div className="theciu-voucher-head">
                          <div className="theciu-voucher-shop">
                            Shop:{" "}
                            <b>{sellerNameMap[g.sellerId] || g.sellerId}</b>
                          </div>
                          <div className="theciu-voucher-amount">
                            Tạm tính: {fmtVND(g.amount)}
                          </div>
                        </div>

                        {list.length === 0 ? (
                          <div className="theciu-voucher-empty">
                            Không có voucher khả dụng.
                          </div>
                        ) : (
                          <div className="theciu-voucher-list">
                            {list.map((v) => {
                              const enough =
                                g.amount >= Number(v.minOrderAmount || 0);
                              const isSelected =
                                !!selected && selected.code === v.code;
                              const label =
                                v.type === "PERCENTAGE"
                                  ? `Giảm ${v.discountValue}%${
                                      Number(v.maxDiscountAmount || 0) > 0
                                        ? ` (tối đa ${fmt(
                                            v.maxDiscountAmount
                                          )} đ)`
                                        : ""
                                    }`
                                  : v.type === "FREE_SHIPPING"
                                  ? "Miễn phí vận chuyển (−" +
                                    fmt(SHIPPING_BASE_FEE) +
                                    " đ)"
                                  : `Giảm ${fmt(v.discountValue)} đ`;
                              return (
                                <button
                                  key={v.voucherId || v.id || v.code}
                                  className={`theciu-voucher-pill ${
                                    !enough ? "is-disabled" : ""
                                  } ${isSelected ? "is-selected" : ""}`}
                                  title={
                                    !enough
                                      ? `Cần tối thiểu ${fmtVND(
                                          v.minOrderAmount
                                        )}`
                                      : label
                                  }
                                  onClick={() =>
                                    isSelected
                                      ? handleUnselectVoucher(g.sellerId)
                                      : enough &&
                                        handleSelectVoucher(g.sellerId, v)
                                  }
                                  disabled={!enough}
                                >
                                  <span className="code">{v.code}</span>
                                  <span className="label">{label}</span>
                                  <span className="min">
                                    Đơn tối thiểu {fmtVND(v.minOrderAmount)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {selected && (
                          <div className="theciu-voucher-picked">
                            Đã chọn: <b>{selected.code}</b> • Giảm{" "}
                            <b>{fmtVND(selected.discountAmount)}</b>{" "}
                            <button
                              className="theciu-voucher-remove"
                              onClick={() => handleUnselectVoucher(g.sellerId)}
                            >
                              Bỏ chọn
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shipping */}
            <div className="theciu-card">
              <div className="theciu-card-header">
                <h3>Phương thức vận chuyển</h3>
              </div>
              <div className="theciu-shipping-options">
                {[
                  {
                    id: "standard",
                    name: "Giao hàng tiêu chuẩn",
                    desc: "7 - 20 ngày làm việc",
                    fee: 30000,
                  },
                ].map((option) => (
                  <label
                    key={option.id}
                    className={`theciu-radio-option ${
                      shipping === option.id ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      value={option.id}
                      checked={shipping === option.id}
                      onChange={() => setShipping(option.id)}
                      className="theciu-radio-input"
                    />
                    <div className="theciu-radio-content">
                      <div className="theciu-radio-main">
                        <div className="theciu-radio-title">{option.name}</div>
                        <div className="theciu-radio-desc">{option.desc}</div>
                      </div>
                      <div className="theciu-radio-price">
                        {fmtVND(option.fee)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Payment */}
            <div className="theciu-card">
              <div className="theciu-card-header">
                <h3>Phương thức thanh toán</h3>
              </div>
              <div className="theciu-payment-options">
                {[
                  { id: "bank", name: "Chuyển khoản ngân hàng", icon: "🏦" },
                  {
                    id: "cod",
                    name: "Thanh toán khi nhận hàng (COD)",
                    icon: "💰",
                  },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`theciu-payment-option ${
                      payment === opt.id ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={opt.id}
                      checked={payment === opt.id}
                      onChange={() => setPayment(opt.id)}
                      className="theciu-radio-input"
                    />
                    <div className="theciu-payment-content">
                      <span className="theciu-payment-icon">{opt.icon}</span>
                      <span className="theciu-payment-name">{opt.name}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="theciu-sidebar">
            <OrderSummary
              items={items}
              shippingFee={shippingFee}
              total={total}
              canCheckout={canCheckout}
              onCheckout={handleCheckout}
              note={note}
              onNoteChange={setNote}
              isPaying={isPaying}
              selectedDiscountTotal={selectedDiscountTotal}
            />
          </div>
        </div>
      </div>

      <AddressPickerModal
        open={showAddrModal}
        onClose={() => setShowAddrModal(false)}
        onPicked={handlePickedAddress}
      />
      <RecipientEditModal
        open={showRecipientModal}
        defaultName={recipientName}
        defaultPhone={recipientPhone}
        onClose={() => setShowRecipientModal(false)}
        onSave={({ name, phone }) => {
          setRecipientName(name);
          setRecipientPhone(phone);
          sessionStorage.setItem(
            "checkout_contact",
            JSON.stringify({ name, phone })
          );
        }}
      />
    </div>
  );
}
