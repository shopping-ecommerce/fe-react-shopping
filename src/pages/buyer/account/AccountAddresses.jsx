// src/pages/account/AccountAddresses.jsx
"use client";

import { useEffect, useState, useContext, useRef, useMemo } from "react";
import { AuthContext } from "../../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../../config/api";
import "../../../styles/account-addresses.css";

/** === Goong keys & endpoints (giữ nguyên) === */
const GOONG_API_KEY =
  import.meta.env?.VITE_GOONG_API_KEY ||
  (typeof window !== "undefined" ? window.GOONG_API_KEY : "") ||
  "";

const GOONG_MAPTILES_KEY =
  import.meta.env?.VITE_GOONG_MAPTILES_KEY ||
  (typeof window !== "undefined" ? window.GOONG_MAPTILES_KEY : "") ||
  "";

const GOONG_RS = "https://rsapi.goong.io";

/** Loader có fallback cho goong-js và CSS (giữ nguyên) */
async function loadGoongLibs() {
  const JS_CANDS = [
    "https://cdn.jsdelivr.net/npm/goong-js@1.0.7/dist/goong-js.js",
    "https://unpkg.com/goong-js@1.0.7/dist/goong-js.js",
    "https://cdn.jsdelivr.net/npm/goong-js@latest/dist/goong-js.js",
  ];
  const CSS_CANDS = [
    "https://cdn.jsdelivr.net/npm/goong-js@1.0.7/dist/goong-js.css",
    "https://unpkg.com/goong-js@1.0.7/dist/goong-js.css",
    "https://cdn.jsdelivr.net/npm/goong-js@latest/dist/goong-js.css",
  ];

  const loadCss = (href) =>
    new Promise((res, rej) => {
      if ([...document.styleSheets].some((s) => s.href?.includes("goong-js.css")))
        return res();
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = () => res();
      link.onerror = (e) => rej(e);
      document.head.appendChild(link);
    });

  const loadJs = (src) =>
    new Promise((res, rej) => {
      if (window.goongjs) return res();
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => res();
      s.onerror = (e) => rej(e);
      document.body.appendChild(s);
    });

  // CSS
  let cssOk = false;
  for (const href of CSS_CANDS) {
    try {
      await loadCss(href);
      cssOk = true;
      break;
    } catch {}
  }
  if (!cssOk) throw new Error("Không tải được goong-js.css");

  // JS
  let jsOk = false;
  for (const src of JS_CANDS) {
    try {
      await loadJs(src);
      jsOk = true;
      if (window.goongjs) break;
    } catch {}
  }
  if (!jsOk || !window.goongjs) throw new Error("Không tải được goong-js");
}

/* =========================
   Helpers VN địa giới + fetch
   ========================= */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function safeFetchJSON(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
  }
  return res.json();
}

/** Chuẩn hoá dữ liệu về dạng {code,name,districts:[{code,name,wards:[...] }]} */
function normalizeVNTree(input) {
  // Nếu đã đúng định dạng open-api (depth=3)
  if (Array.isArray(input) && input[0]?.code && input[0]?.name) {
    return input.map((p) => ({
      code: String(p.code),
      name: p.name,
      districts: (p.districts || []).map((d) => ({
        code: String(d.code),
        name: d.name,
        wards: (d.wards || []).map((w) => ({
          code: String(w.code),
          name: w.name,
        })),
      })),
    }));
  }

  // Nếu theo format phổ biến trên GitHub: {Id, Name, Districts:[{Id, Name, Wards:[{Id, Name}]}]}
  if (Array.isArray(input) && input[0]?.Id && input[0]?.Name) {
    return input.map((p) => ({
      code: String(p.Id),
      name: p.Name,
      districts: (p.Districts || []).map((d) => ({
        code: String(d.Id),
        name: d.Name,
        wards: (d.Wards || []).map((w) => ({
          code: String(w.Id),
          name: w.Name,
        })),
      })),
    }));
  }

  return [];
}

/** Thử nhiều nguồn: proxy → open-api trực tiếp → GitHub raw */
async function fetchVNAdministrativeTree() {
  // Nguồn 1: Vite proxy (bạn đã cấu hình /vngeo → https://provinces.open-api.vn)
  const src1 = { url: "/vngeo/api/?depth=3", note: "proxy open-api" };
  // Nguồn 2: gọi trực tiếp open-api (thường CORS OK)
  const src2 = { url: "https://provinces.open-api.vn/api/?depth=3", note: "open-api trực tiếp" };
  // Nguồn 3: GitHub raw (data tree đã build sẵn) – fallback ổn định
  const src3 = {
    url: "https://raw.githubusercontent.com/kenzouno1/DiaGioiHanhChinhVN/master/data.json",
    note: "github raw fallback",
  };

  const sources = [src1, src2, src3];

  let lastErr;
  for (const s of sources) {
    try {
      const json = await safeFetchJSON(s.url, { cache: "no-store" });
      const tree = normalizeVNTree(json);
      if (tree.length) return tree;
      throw new Error(`Empty/invalid data from ${s.note}`);
    } catch (e) {
      lastErr = e;
      // thử nguồn sau
      await sleep(200);
    }
  }
  throw lastErr || new Error("Không tải được dữ liệu địa giới");
}

export default function AccountAddresses() {
  const { authFetch } = useContext(AuthContext);

  // ===== UI/Suggest control =====
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [suppressSuggestUntil, setSuppressSuggestUntil] = useState(0);

  // ===== State chính =====
  const [addresses, setAddresses] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profileId, setProfileId] = useState(null);
  const [settingDefaultId, setSettingDefaultId] = useState(null);

  // ===== Tree hành chính (đã thay logic load) =====
  const [vnTree, setVnTree] = useState([]);
  const [province, setProvince] = useState(null);
  const [district, setDistrict] = useState(null);
  const [ward, setWard] = useState(null);

  // ===== Goong Map refs =====
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const addressInputRef = useRef(null);

  // ===== Form =====
  const [addressLine, setAddressLine] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [latLng, setLatLng] = useState({ lat: 10.8231, lng: 106.6297 });
  const [isDefault, setIsDefault] = useState(false);
  const originalAddressRef = useRef("");

  // ===== Gợi ý Places (Goong) =====
  const [predictions, setPredictions] = useState([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const abortAutoRef = useRef(null);

  // Log keys (ẩn bớt)
  useEffect(() => {
    console.log(
      "[GOONG] API_KEY =",
      (GOONG_API_KEY || "").slice(0, 6) + "******",
      "| MAPTILES_KEY =",
      (GOONG_MAPTILES_KEY || "").slice(0, 6) + "******"
    );
  }, []);

  // ===== Load dữ liệu ban đầu (đổ tỉnh/thành theo cơ chế mới) =====
  useEffect(() => {
    (async () => {
      try {
        const tree = await fetchVNAdministrativeTree();
        setVnTree(tree);
      } catch (e) {
        console.error("❌ Load provinces (tree) failed:", e);
        setError("Không thể tải danh sách tỉnh/thành. Vui lòng bấm Thêm địa chỉ mới rồi 'Thử lại'.");
      }
    })();

    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const response = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile));
      const data = await response.json();

      const result = data?.result ?? data ?? {};
      if (result?.id) setProfileId(result.id);

      if (Array.isArray(result.addresses)) {
        setAddresses(
          result.addresses.map((addr, index) => ({
            id: `addr-${index}`,
            ...addr,
          }))
        );
      } else {
        setAddresses([]);
      }
    } catch (err) {
      console.error("❌ Lỗi khi tải địa chỉ:", err);
      setError("Không thể tải danh sách địa chỉ");
    } finally {
      setLoading(false);
    }
  };

  // ===== Danh sách con =====
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

  /** ===== Helper: reverse geocode lat,lng -> fullAddress (dùng chung) ===== */
  const reverseGeocode = async (lat, lng) => {
    try {
      const r = await fetch(
        `${GOONG_RS}/Geocode?api_key=${GOONG_API_KEY}&latlng=${lat},${lng}`
      );
      const j = await r.json();
      const addr = j?.results?.[0]?.formatted_address || "";
      if (addr) setFullAddress(addr);
      return addr;
    } catch {
      return "";
    }
  };

  /** ========== Goong Autocomplete (debounce 150ms) ========== */
  useEffect(() => {
    if (!modalOpen || !GOONG_API_KEY) return;
    if (Date.now() < suppressSuggestUntil) return;

    const id = setTimeout(async () => {
      if (!isInputFocused) return;

      const txt = addressLine.trim();
      if (txt.length < 2) {
        setShowPredictions(false);
        setPredictions([]);
        return;
      }

      const parts = [txt];
      if (ward?.name) parts.push(ward.name);
      if (district?.name) parts.push(district.name);
      if (province?.name) parts.push(province.name);
      parts.push("Việt Nam");
      const input = parts.join(", ");

      try {
        abortAutoRef.current?.abort?.();
        abortAutoRef.current = new AbortController();

        const url = `${GOONG_RS}/Place/AutoComplete?api_key=${GOONG_API_KEY}&input=${encodeURIComponent(
          input
        )}&limit=5`;
        const res = await fetch(url, { signal: abortAutoRef.current.signal });
        const json = await res.json();
        const items = json?.predictions || [];
        setPredictions(items.slice(0, 3)); // chỉ 3 gợi ý
        setShowPredictions(isInputFocused && items.length > 0);
      } catch {
        setPredictions([]);
        setShowPredictions(false);
      }
    }, 150);

    return () => clearTimeout(id);
  }, [
    addressLine,
    province,
    district,
    ward,
    modalOpen,
    isInputFocused,
    suppressSuggestUntil,
  ]);

  // Ẩn dropdown khi nhấn ESC
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setShowPredictions(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  const handlePickPrediction = async (p) => {
    try {
      const url = `${GOONG_RS}/Place/Detail?api_key=${GOONG_API_KEY}&place_id=${encodeURIComponent(
        p.place_id
      )}`;
      const res = await fetch(url);
      const data = await res.json();
      const detail = data?.result;

      const loc = detail?.geometry?.location;
      const addr =
        detail?.formatted_address || detail?.name || p?.description || addressLine;

      if (loc) setLatLng({ lat: loc.lat, lng: loc.lng });
      setAddressLine(addr || "");
      setFullAddress(addr || "");

      // Ẩn & chặn suggest ngắn hạn
      setPredictions([]);
      setShowPredictions(false);
      setSuppressSuggestUntil(Date.now() + 600);

      requestAnimationFrame(() => addressInputRef.current?.focus?.());
    } catch {
      const addr = p?.description || addressLine;
      setAddressLine(addr);
      setFullAddress(addr);
      setPredictions([]);
      setShowPredictions(false);
      setSuppressSuggestUntil(Date.now() + 600);
      requestAnimationFrame(() => addressInputRef.current?.focus?.());
    }
  };

  /** ========== Khởi tạo Goong Map trong modal ========== */
  const initializeMap = async () => {
    if (!GOONG_MAPTILES_KEY) {
      setError(
        "Thiếu GOONG_MAPTILES_KEY. Hãy đặt VITE_GOONG_MAPTILES_KEY trong .env rồi restart dev server."
      );
      return;
    }
    try {
      await loadGoongLibs();

      if (!mapRef.current) return;

      const center = [
        Number(latLng.lng) || 106.6297,
        Number(latLng.lat) || 10.8231,
      ]; // [lng, lat]

      window.goongjs.accessToken = GOONG_MAPTILES_KEY;

      const map = new window.goongjs.Map({
        container: mapRef.current,
        style: "https://tiles.goong.io/assets/goong_map_web.json",
        center,
        zoom: 15,
      });

      const marker = new window.goongjs.Marker({ draggable: true })
        .setLngLat(center)
        .addTo(map);

      marker.on("dragend", async () => {
        const { lat, lng } = marker.getLngLat();
        setLatLng({ lat, lng });
        await reverseGeocode(lat, lng);
      });

      map.on("click", async (e) => {
        const { lng, lat } = e.lngLat;
        marker.setLngLat([lng, lat]);
        setLatLng({ lat, lng });
        await reverseGeocode(lat, lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      setTimeout(() => {
        try {
          map.resize();
        } catch {}
      }, 50);
    } catch (e) {
      console.error("Init Goong map failed:", e);
      setError(
        "Không thể nạp thư viện bản đồ (goong-js). Kiểm tra mạng/CDN hoặc thử lại."
      );
    }
  };

  // ===== Handlers chọn địa lý =====
  const handleProvinceChange = (code) => {
    const p = provinces.find((x) => String(x.code) === String(code));
    setProvince(p || null);
    setDistrict(null);
    setWard(null);
  };

  const handleDistrictChange = (code) => {
    const d = districts.find((x) => String(x.code) === String(code));
    setDistrict(d || null);
    setWard(null);
  };

  const handleWardChange = (code) => {
    const w = wards.find((x) => String(x.code) === String(code));
    setWard(w || null);
  };

  // ===== Modal control =====
  const openAddModal = () => {
    setEditingId(null);
    originalAddressRef.current = "";
    setProvince(null);
    setDistrict(null);
    setWard(null);
    setAddressLine("");
    setFullAddress("");
    setLatLng({ lat: 10.8231, lng: 106.6297 });
    setIsDefault(addresses.length === 0);
    setError("");
    setModalOpen(true);
    setPredictions([]);
    setShowPredictions(false);
  };

  const openEditModal = (address) => {
    setEditingId(address.id);
    originalAddressRef.current = (address.address || "").trim();
    setProvince(null);
    setDistrict(null);
    setWard(null);

    setAddressLine(address.address || "");
    setFullAddress(address.address || "");
    setLatLng({
      lat: Number(address.latitude) || 10.8231,
      lng: Number(address.longitude) || 106.6297,
    });
    setIsDefault(!!address.is_default);
    setError("");
    setModalOpen(true);
    setPredictions([]);
    setShowPredictions(false);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setError("");
    setPredictions([]);
    setShowPredictions(false);
  };

  const openMapModal = () => {
    setMapModalOpen(true);
    setTimeout(() => initializeMap(), 100);
  };

  const closeMapModal = () => setMapModalOpen(false);

  /** ✅ Đồng ý: cập nhật luôn ô nhập bằng fullAddress */
  const confirmMapLocation = async () => {
    // nếu fullAddress trống, reverse lại theo latLng hiện tại
    let addr = fullAddress;
    if (!addr && latLng?.lat && latLng?.lng) {
      addr = await reverseGeocode(latLng.lat, latLng.lng);
    }
    if (addr) {
      setAddressLine(addr);
      setSuppressSuggestUntil(Date.now() + 800); // chặn dropdown nhảy lại
      requestAnimationFrame(() => addressInputRef.current?.focus?.());
    }
    closeMapModal();
  };

  /** ========== Geocode thuận bằng Goong khi bấm icon bản đồ ========== */
  const searchOnMap = async () => {
    const txt = addressLine?.trim();
    if (!txt) {
      setError("Vui lòng nhập địa chỉ chi tiết trước");
      return;
    }

    const parts = [txt];
    if (ward?.name) parts.push(ward.name);
    if (district?.name) parts.push(district.name);
    if (province?.name) parts.push(province.name);
    parts.push("Việt Nam");
    const query = parts.filter(Boolean).join(", ");

    try {
      const r = await fetch(
        `${GOONG_RS}/Geocode?api_key=${GOONG_API_KEY}&address=${encodeURIComponent(
          query
        )}`
      );
      const j = await r.json();
      const first = j?.results?.[0];
      const loc = first?.geometry?.location;
      if (loc) {
        setLatLng({ lat: loc.lat, lng: loc.lng });
        setFullAddress(first?.formatted_address || "");
        openMapModal();
      } else {
        setError("Không tìm thấy địa chỉ trên bản đồ");
      }
    } catch (e) {
      setError("Không tìm thấy địa chỉ trên bản đồ");
    }
  };

  // ===== Validate & Save =====
  const validateForm = () => {
    if (!addressLine.trim()) return "Vui lòng nhập địa chỉ chi tiết.";
    if (!editingId) {
      if (!province) return "Vui lòng chọn Tỉnh/Thành phố.";
      if (!district) return "Vui lòng chọn Quận/Huyện.";
      if (!ward) return "Vui lòng chọn Phường/Xã.";
    }
    return "";
  };

  const saveAddress = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!profileId) {
      setError("Không tìm thấy thông tin user. Vui lòng thử lại.");
      return;
    }

    try {
      setLoading(true);

      const hasAdmin = !!(province && district && ward);
      const finalAddress = (
        hasAdmin
          ? fullAddress ||
            [addressLine.trim(), ward?.name, district?.name, province?.name]
              .filter(Boolean)
              .join(", ")
          : addressLine.trim()
      ).trim();

      // ⚠️ Không gửi lat/lng để tránh BE báo invalid body
      let endpoint, body;
      if (editingId) {
        endpoint = API_CONFIG.endpoints.updateAddress;
        body = {
          user_id: profileId,
          old_address: (originalAddressRef.current || "").trim(),
          new_address: {
            address: finalAddress,
            is_default: !!isDefault,
          },
        };
      } else {
        endpoint = API_CONFIG.endpoints.addAddress;
        body = {
          user_id: profileId,
          address: {
            address: finalAddress,
            is_default: !!isDefault,
          },
        };
      }

      const res = await authFetch(apiUrl(endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

      await loadAddresses();
      closeModal();
    } catch (err) {
      console.error("❌ Lỗi khi lưu địa chỉ:", err);
      setError(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ===== Xóa =====
  const removeAddress = async (id) => {
    const target = addresses.find((a) => a.id === id);
    if (!target) return;
    if (!confirm("Xóa địa chỉ này?")) return;

    try {
      setLoading(true);

      const body = {
        user_id: profileId,
        address: target.address,
      };

      const response = await authFetch(apiUrl(API_CONFIG.endpoints.deleteAddress), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      await loadAddresses();
    } catch (e) {
      console.error("❌ Delete failed:", e);
      setError("Không thể xóa địa chỉ. " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  };

  // ===== Đặt mặc định =====
  const setDefault = async (id) => {
    const target = addresses.find((a) => a.id === id);
    if (!target || target.is_default) return;

    try {
      setSettingDefaultId(id);

      const body = {
        user_id: profileId,
        address: target.address,
      };

      const response = await authFetch(
        apiUrl(API_CONFIG.endpoints.setDefaultAddress),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      await loadAddresses();
    } catch (e) {
      console.error("❌ Set default failed:", e);
      setError("Không thể thiết lập mặc định. " + (e.message || ""));
    } finally {
      setSettingDefaultId(null);
    }
  };

  return (
    <div className="addr-page">
      <div className="addr-header">
        <h1>Địa chỉ của tôi</h1>
        <button className="btn-primary" onClick={openAddModal}>
          + Thêm địa chỉ mới
        </button>
      </div>

      <div className="addr-card">
        <h2>Địa chỉ</h2>

        {loading ? (
          <div className="addr-loading">Đang tải...</div>
        ) : addresses.length === 0 ? (
          <div className="addr-empty">
            Bạn chưa có địa chỉ nào. Hãy bấm <b>"Thêm địa chỉ mới"</b>.
          </div>
        ) : (
          <ul className="addr-list">
            {addresses.map((address) => (
              <li key={address.id} className="addr-item">
                <div className="addr-row">
                  <div className="addr-left">
                    <div className="addr-line">{address.address}</div>
                    <div className="addr-tags">
                      {address.is_default && <span className="tag-default">Mặc định</span>}
                    </div>
                  </div>

                  <div className="addr-actions">
                    <button className="link" onClick={() => openEditModal(address)}>
                      Cập nhật
                    </button>
                    <button className="link danger" onClick={() => removeAddress(address.id)}>
                      Xóa
                    </button>
                    <button
                      className="btn-outline small"
                      onClick={() => setDefault(address.id)}
                      disabled={address.is_default || settingDefaultId === address.id}
                    >
                      {settingDefaultId === address.id ? "Đang thiết lập..." : "Thiết lập mặc định"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div
          className="error-banner"
          style={{
            background: "#ffebee",
            color: "#c62828",
            padding: "12px",
            borderRadius: "4px",
            margin: "16px 0",
            border: "1px solid #ffcdd2",
          }}
        >
          {error}
        </div>
      )}

      {/* Modal thêm/sửa địa chỉ */}
      {modalOpen && (
        <div className="addr-modal-overlay" onClick={closeModal}>
          <div className="addr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="addr-modal-header">
              <h3>{editingId ? "Cập nhật địa chỉ" : "Địa chỉ mới"}</h3>
            </div>

            <div className="addr-modal-body">
              <div className="form-grid">
                {!editingId && (
                  <>
                    <div className="form-item">
                      <label>Tỉnh/Thành phố</label>
                      <select
                        value={province?.code || ""}
                        onChange={(e) => handleProvinceChange(e.target.value)}
                        disabled={!provinces.length}
                        className="address-select"
                      >
                        <option value="" disabled>
                          Chọn
                        </option>
                        {provinces.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-item">
                      <label>Quận/Huyện</label>
                      <select
                        value={district?.code || ""}
                        onChange={(e) => handleDistrictChange(e.target.value)}
                        disabled={!province}
                        className="address-select"
                      >
                        <option value="" disabled>
                          Chọn
                        </option>
                        {districts.map((d) => (
                          <option key={d.code} value={d.code}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-item">
                      <label>Phường/Xã</label>
                      <select
                        value={ward?.code || ""}
                        onChange={(e) => handleWardChange(e.target.value)}
                        disabled={!district}
                        className="address-select"
                      >
                        <option value="" disabled>
                          Chọn
                        </option>
                        {wards.map((w) => (
                          <option key={w.code} value={w.code}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Địa chỉ cụ thể + nút bản đồ (giữ nguyên) */}
                <div className="form-item full" style={{ position: "relative" }}>
                  <label>Địa chỉ cụ thể</label>
                  <div className="address-input-group">
                    <input
                      ref={addressInputRef}
                      type="text"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      onFocus={() => {
                        setIsInputFocused(true);
                        if (predictions.length) setShowPredictions(true);
                      }}
                      onBlur={() => {
                        setIsInputFocused(false);
                        setTimeout(() => setShowPredictions(false), 100);
                      }}
                      placeholder="Ví dụ: 622 Cộng Hòa, Tân Bình…"
                      className="address-input"
                      autoComplete="off"
                      spellCheck={false}
                    />

                    <button
                      type="button"
                      className="map-button"
                      onClick={searchOnMap}
                      title="Xem trên bản đồ"
                    >
                      <span className="map-icon">📍</span>
                    </button>
                  </div>

                  {/* Cảnh báo + Gợi ý nằm TRONG address-warning */}
                  <div className="address-warning">
                    <span className="warning-icon">⚠️</span>
                    <span>Vui lòng ghim địa chỉ chính xác</span>
                    <br />
                    <small>Hãy chắc chắn vị trí trên bản đồ được ghim đúng để giao hàng chính xác.</small>

                    {showPredictions && predictions.length > 0 && (
                      <div
                        className="predictions-card"
                        role="listbox"
                        aria-label="Gợi ý địa chỉ"
                        style={{ marginTop: 8 }}
                      >
                        {predictions.map((p, idx) => {
                          const main = p?.description || "";
                          const secondary = p?.structured_formatting?.secondary_text || "";
                          return (
                            <button
                              key={p.place_id || idx}
                              type="button"
                              className="prediction-item"
                              role="option"
                              onMouseDown={(e) => e.preventDefault()} // giữ focus input
                              onClick={() => handlePickPrediction(p)}
                              title={main}
                            >
                              <span className="prediction-icon">📌</span>
                              <span className="prediction-text">
                                <span className="prediction-main">{main}</span>
                                {secondary ? (
                                  <span className="prediction-second">{secondary}</span>
                                ) : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {fullAddress && (
                    <div className="selected-address">
                      <strong>Địa chỉ đã chọn:</strong> {fullAddress}
                    </div>
                  )}
                </div>

                <label className="checkline full">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                  />
                  Đặt làm địa chỉ mặc định
                </label>
              </div>

              {error && <div className="form-error">{error}</div>}
            </div>

            <div className="addr-modal-footer">
              <button className="btn-outline" onClick={closeModal}>
                Trở Lại
              </button>
              <button className="btn-primary" onClick={saveAddress} disabled={loading}>
                {loading ? "Đang lưu..." : editingId ? "Cập nhật" : "Hoàn thành"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal bản đồ (Goong) */}
      {mapModalOpen && (
        <div className="map-modal-overlay" onClick={closeMapModal}>
          <div className="map-modal" onClick={(e) => e.stopPropagation()}>
            <div className="map-modal-header">
              <button className="map-back-btn" onClick={closeMapModal}>
                ← Sửa Vị trí
              </button>
              <h3>
                {[addressLine?.trim(), ward?.name, district?.name, province?.name]
                  .filter(Boolean)
                  .join(", ")}
              </h3>
            </div>

            <div className="map-container">
              <div ref={mapRef} className="google-map"></div>
              <div className="map-info-overlay">
                <div className="map-info-card">
                  <h4>Địa chỉ của bạn ở đây</h4>
                  <p>Vui lòng kiểm tra vị trí trên bản đồ</p>
                </div>
              </div>
            </div>

            <div className="map-modal-footer">
              <button className="btn-outline" onClick={closeMapModal}>
                Trở Lại
              </button>
              <button className="btn-primary" onClick={confirmMapLocation}>
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
