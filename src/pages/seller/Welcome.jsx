// src/pages/seller/Welcome.jsx
import React, { useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../../styles/Welcome.css";
import { AuthContext } from "../../contexts/AuthContext";
import { registerSeller, getSellerByUserId } from "../../services/seller";
import { acceptSellerPolicy } from "../../services/policy";
import { getMyProfile } from "../../services/profile";

export default function Welcome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authFetch, user, logout, isAuthenticated } = useContext(AuthContext);

  const [storeName, setStoreName] = React.useState("");
  const [logoPreview, setLogoPreview] = React.useState(null);
  const [logoFile, setLogoFile] = React.useState(null);
  const [agreedToTerms, setAgreedToTerms] = React.useState(false);

  const [frontURL, setFrontURL] = React.useState(null);
  const [backURL, setBackURL] = React.useState(null);
  const [frontFile, setFrontFile] = React.useState(null);
  const [backFile, setBackFile] = React.useState(null);

  // ====== Địa giới hành chính (đa nguồn + fallback) ======
  const [loadingVN, setLoadingVN] = React.useState(true);
  const [vnError, setVnError] = React.useState("");
  const [provinces, setProvinces] = React.useState([]);
  const [districts, setDistricts] = React.useState([]);
  const [wards, setWards] = React.useState([]);

  const [province, setProvince] = React.useState(null);
  const [district, setDistrict] = React.useState(null);
  const [ward, setWard] = React.useState(null);

  const [addressLine, setAddressLine] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");

  const [myProfile, setMyProfile] = React.useState(null);
  const [loadingProfile, setLoadingProfile] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [sellerStatus, setSellerStatus] = React.useState(null);
  const [rejectedReason, setRejectedReason] = React.useState(""); // NEW: lý do bị từ chối

  const [errors, setErrors] = React.useState({});
  const message = location.state?.message || "Chào mừng bạn!";
  const prevUserIdRef = React.useRef(null);

  // NEW: trạng thái sellerId
  const [sellerId, setSellerId] = React.useState("");
  const [sellerLoading, setSellerLoading] = React.useState(false);
  const [sellerErr, setSellerErr] = React.useState("");

  // ================== Goong keys & endpoints ==================
  const GOONG_API_KEY =
    import.meta.env?.VITE_GOONG_API_KEY ||
    (typeof window !== "undefined" ? window.GOONG_API_KEY : "") ||
    "";

  const GOONG_MAPTILES_KEY =
    import.meta.env?.VITE_GOONG_MAPTILES_KEY ||
    (typeof window !== "undefined" ? window.GOONG_MAPTILES_KEY : "") ||
    "";

  const GOONG_RS = "https://rsapi.goong.io";

  // Loader có fallback cho goong-js và CSS
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
        if (
          [...document.styleSheets].some((s) =>
            s.href?.includes("goong-js.css")
          )
        )
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

    let cssOk = false;
    for (const href of CSS_CANDS) {
      try {
        await loadCss(href);
        cssOk = true;
        break;
      } catch {}
    }
    if (!cssOk) throw new Error("Không tải được goong-js.css");

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

  // ================== Goong Autocomplete + Map state ==================
  const [isInputFocused, setIsInputFocused] = React.useState(false);
  const [suppressSuggestUntil, setSuppressSuggestUntil] = React.useState(0);
  const [predictions, setPredictions] = React.useState([]);
  const [showPredictions, setShowPredictions] = React.useState(false);
  const abortAutoRef = React.useRef(null);

  const [fullAddress, setFullAddress] = React.useState("");
  const [latLng, setLatLng] = React.useState({ lat: 10.8231, lng: 106.6297 });

  const [mapModalOpen, setMapModalOpen] = React.useState(false);
  const mapRef = React.useRef(null);
  const markerRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const addressInputRef = React.useRef(null);

  const toast = (text) => {
    const el = document.createElement("div");
    el.className = "wk-toast";
    el.innerText = text;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      el.remove();
    }, 2200);
  };

  // ================== Helpers ==================
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function safeFetchJSON(url, opts) {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ------------------ Nguồn 1 ------------------
  const src1 = {
    provinces: async () => {
      const arr = await safeFetchJSON("/vngeo/?depth=1");
      return (Array.isArray(arr) ? arr : []).map((p) => ({
        code: String(p.code),
        name: p.name,
      }));
    },
    districtsByProvince: async (provCode) => {
      const j = await safeFetchJSON(
        `/vngeo/p/${encodeURIComponent(provCode)}?depth=2`
      );
      const arr = j?.districts || j?.province?.districts || [];
      return arr.map((d) => ({ code: String(d.code), name: d.name }));
    },
    wardsByDistrict: async (districtCode) => {
      const j = await safeFetchJSON(
        `/vngeo/d/${encodeURIComponent(districtCode)}?depth=2`
      );
      const arr = j?.wards || j?.district?.wards || [];
      return arr.map((w) => ({ code: String(w.code), name: w.name }));
    },
  };

  // ------------------ Nguồn 2 (fallback) ------------------
  const CDN = "https://cdn.jsdelivr.net/gh/madnh/hanhchinhvn/dist";
  const src2 = {
    _cache: { tinh: null, huyen: null, xa: null },

    provinces: async () => {
      if (!src2._cache.tinh)
        src2._cache.tinh = await safeFetchJSON(`${CDN}/tinh_tp.json`);
      const obj = src2._cache.tinh || {};
      return Object.entries(obj).map(([code, it]) => ({
        code: String(code),
        name: it.name,
      }));
    },

    districtsByProvince: async (provCode) => {
      if (!src2._cache.huyen)
        src2._cache.huyen = await safeFetchJSON(`${CDN}/quan_huyen.json`);
      const all = src2._cache.huyen || {};
      const list = [];
      Object.entries(all).forEach(([code, it]) => {
        if (String(it.parent_code) === String(provCode)) {
          list.push({ code: String(code), name: it.name });
        }
      });
      return list;
    },

    wardsByDistrict: async (districtCode) => {
      if (!src2._cache.xa)
        src2._cache.xa = await safeFetchJSON(`${CDN}/xa_phuong.json`);
      const all = src2._cache.xa || {};
      const list = [];
      Object.entries(all).forEach(([code, it]) => {
        if (String(it.parent_code) === String(districtCode)) {
          list.push({ code: String(code), name: it.name });
        }
      });
      return list;
    },
  };

  // ------------------ Loader với fallback (provinces) ------------------
  const loadProvinces = async () => {
    setLoadingVN(true);
    setVnError("");
    try {
      const list = await src1.provinces();
      if (!list.length) throw new Error("empty provinces");
      setProvinces(list);
    } catch (e1) {
      console.warn("[VN] src1 provinces fail:", e1?.message || e1);
      try {
        const list = await src2.provinces();
        if (!list.length) throw new Error("empty provinces (cdn)");
        setProvinces(list);
      } catch (e2) {
        console.error("[VN] src2 provinces fail:", e2?.message || e2);
        setVnError("Không tải được Tỉnh/Thành. Bấm Thử lại.");
        setProvinces([]);
      }
    } finally {
      setLoadingVN(false);
    }
  };

  const onProvinceChange = async (code) => {
    const p = provinces.find((x) => String(x.code) === String(code)) || null;
    setProvince(p);
    setDistrict(null);
    setWard(null);
    setDistricts([]);
    setWards([]);
    if (!p) return;

    setVnError("");
    try {
      const list = await src1.districtsByProvince(p.code);
      setDistricts(list);
    } catch {
      try {
        const list = await src2.districtsByProvince(p.code);
        setDistricts(list);
      } catch (e2) {
        console.error("[VN] districts fail:", e2?.message || e2);
        setVnError(
          "Không tải được Quận/Huyện. Hãy chọn lại Tỉnh hoặc Thử lại."
        );
        setDistricts([]);
      }
    }
  };

  const onDistrictChange = async (code) => {
    const d = districts.find((x) => String(x.code) === String(code)) || null;
    setDistrict(d);
    setWard(null);
    setWards([]);
    if (!d) return;

    setVnError("");
    try {
      const list = await src1.wardsByDistrict(d.code);
      setWards(list);
    } catch {
      try {
        const list = await src2.wardsByDistrict(d.code);
        setWards(list);
      } catch (e2) {
        console.error("[VN] wards fail:", e2?.message || e2);
        setVnError("Không tải được Phường/Xã. Hãy chọn lại Quận hoặc Thử lại.");
        setWards([]);
      }
    }
  };

  React.useEffect(() => {
    if (GOONG_API_KEY || GOONG_MAPTILES_KEY) {
      console.log(
        "[GOONG] API_KEY=",
        (GOONG_API_KEY || "").slice(0, 6) + "******",
        "| MAPTILES_KEY=",
        (GOONG_MAPTILES_KEY || "").slice(0, 6) + "******"
      );
    }
  }, []);

  React.useEffect(() => {
    loadProvinces();
  }, []);

  // ================== Drag & drop helpers (giấy tờ) ==================
  const handlePick = (e, setUrl, setFile) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setUrl(URL.createObjectURL(f));
  };
  const useDrop = (setUrl, setFile) => {
    const onDrop = (e) => {
      e.preventDefault();
      const f = e.dataTransfer.files?.[0];
      if (!f) return;
      setFile(f);
      setUrl(URL.createObjectURL(f));
    };
    const onDrag = (e) => e.preventDefault();
    return {
      onDrop,
      onDragOver: onDrag,
      onDragEnter: onDrag,
      onDragLeave: onDrag,
    };
  };
  const dropFront = useDrop(setFrontURL, setFrontFile);
  const dropBack = useDrop(setBackURL, setBackFile);

  const handleLogoUpload = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast("Kích thước logo ≤ 2MB");
      return;
    }
    if (!/^image\/(jpe?g|png)$/i.test(file.type)) {
      toast("Logo chỉ nhận JPG/PNG");
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setStoreName("");
    setLogoPreview(null);
    setLogoFile(null);
    setAgreedToTerms(false);
    setFrontURL(null);
    setBackURL(null);
    setFrontFile(null);
    setBackFile(null);
    setProvince(null);
    setDistrict(null);
    setWard(null);
    setDistricts([]);
    setWards([]);
    setAddressLine("");
    setContactEmail("");
    setErrors({});
    setIsSubmitted(false);
    setSellerStatus(null);
    setRejectedReason("");
    setFullAddress("");
    setLatLng({ lat: 10.8231, lng: 106.6297 });
  };

  // ================== Load profile + trạng thái seller ==================
  React.useEffect(() => {
    if (!isAuthenticated) {
      toast("Vui lòng đăng nhập để tiếp tục.");
      navigate("/login", { replace: true });
      return;
    }
    if (!authFetch) return;

    (async () => {
      try {
        setLoadingProfile(true);
        const profRaw = await getMyProfile(authFetch);
        const userId = profRaw?.id || profRaw?.result?.id;
        const profile = userId ? { ...profRaw, id: userId } : profRaw;
        setMyProfile(profile);

        const uid = profile?.id;
        const userChanged = prevUserIdRef.current !== uid;
        if (userChanged) {
          resetForm();
          prevUserIdRef.current = uid;
        }

        let seller = null;
        try {
          seller = uid ? await getSellerByUserId(authFetch, uid) : null;
        } catch {
          seller = null;
        }

        if (seller?.status === "PENDING") {
          setSellerStatus("PENDING");
          setIsSubmitted(true); // khóa form
          setSellerId(seller.id || "");
          setStoreName(seller.shop_name || "");
          setLogoPreview(seller.avatar_link || null);
          setContactEmail(seller.email || user?.email || "");
          setAddressLine(seller.address || "");
          // KHÔNG ép hiển thị lại ảnh riêng tư, để nguyên (không cho sửa khi pending)
          return;
        }

        if (seller?.status === "REJECTED") {
          setSellerStatus("REJECTED");
          setIsSubmitted(false); // mở form để sửa
          setSellerId(seller.id || "");

          setStoreName(seller.shop_name || "");
          setContactEmail(seller.email || user?.email || "");
          setAddressLine(seller.address || "");

          // ❗️Không đổ lại ảnh giấy tờ cũ (riêng tư) & KHÔNG đổ lại logo
          setFrontURL(null);
          setBackURL(null);
          setFrontFile(null);
          setBackFile(null);

          setLogoPreview(null); // ❗️ Quan trọng: xoá preview logo
          setLogoFile(null); // ❗️ Quan trọng: xoá file logo

          setRejectedReason(
            seller.reviewNote || seller.reason || seller.rejectReason || ""
          );
          return;
        }

        if (seller?.status === "APPROVED") {
          setSellerStatus("APPROVED");
          setSellerId(seller.id || "");
          setStoreName(seller.shop_name || "");
          setLogoPreview(seller.avatar_link || null);
          setContactEmail(seller.email || user?.email || "");
          setAddressLine(seller.address || "");
          // có thể khoá form hoặc hiển thị read-only tùy ý
        }

        // Khôi phục nháp theo uid (optional)
        if (uid) {
          const DRAFT_KEY = `seller_onboarding_draft_${uid}`;
          const raw = localStorage.getItem(DRAFT_KEY);
          if (raw) {
            try {
              const d = JSON.parse(raw);
              setStoreName(d.storeName || "");
              setLogoPreview(d.logoPreview || null);
              setFrontURL(null); // luôn null để ép re-upload nếu trước đó bị reject/private
              setBackURL(null);
              setAddressLine(d.addressLine || "");
              setAgreedToTerms(!!d.agreedToTerms);
              setContactEmail(d.contactEmail || "");
            } catch {}
          }
        }

        if (localStorage.getItem("seller_onboarding_draft")) {
          localStorage.removeItem("seller_onboarding_draft");
        }
      } catch (e) {
        console.error("[Welcome] fetch profile/seller error:", e);
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [authFetch, isAuthenticated, navigate, user?.email]);

  // ================== Goong helpers ==================
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

  // Autocomplete (debounce 150ms)
  React.useEffect(() => {
    if (!GOONG_API_KEY) return;
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
        setPredictions(items.slice(0, 3));
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
    isInputFocused,
    suppressSuggestUntil,
    GOONG_API_KEY,
  ]);

  // Ẩn dropdown khi nhấn ESC
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setShowPredictions(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        detail?.formatted_address ||
        detail?.name ||
        p?.description ||
        addressLine;

      if (loc) setLatLng({ lat: loc.lat, lng: loc.lng });
      setAddressLine(addr || "");
      setFullAddress(addr || "");

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

  const initializeMap = async () => {
    if (!GOONG_MAPTILES_KEY) {
      toast("Thiếu GOONG_MAPTILES_KEY (.env).");
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
      toast("Không thể nạp thư viện bản đồ (goong-js).");
    }
  };

  const openMapModal = async () => {
    setMapModalOpen(true);
    setTimeout(() => initializeMap(), 100);
  };
  const closeMapModal = () => setMapModalOpen(false);

  const searchOnMap = async () => {
    if (!GOONG_API_KEY) {
      toast("Thiếu GOONG_API_KEY (.env).");
      return;
    }
    const txt = addressLine?.trim();
    if (!txt) {
      toast("Vui lòng nhập địa chỉ chi tiết trước");
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
        toast("Không tìm thấy địa chỉ trên bản đồ");
      }
    } catch (e) {
      toast("Không tìm thấy địa chỉ trên bản đồ");
    }
  };

  const confirmMapLocation = async () => {
    let addr = fullAddress;
    if (!addr && latLng?.lat && latLng?.lng) {
      addr = await reverseGeocode(latLng.lat, latLng.lng);
    }
    if (addr) {
      setAddressLine(addr);
      setSuppressSuggestUntil(Date.now() + 800);
      requestAnimationFrame(() => addressInputRef.current?.focus?.());
    }
    closeMapModal();
  };

  // ================== Validate & submit ==================
  const validate = () => {
    const errs = {};

    // Ảnh giấy tờ (CCCD):
    if (sellerStatus === "REJECTED") {
      // Bắt buộc re-upload file thật khi bị từ chối
      if (!(frontFile instanceof File)) {
        errs.front = "Vui lòng tải lại MẶT TRƯỚC (JPG/PNG).";
      }
      if (!(backFile instanceof File)) {
        errs.back = "Vui lòng tải lại MẶT SAU (JPG/PNG).";
      }
    } else {
      // Đăng ký mới / trạng thái khác: chấp nhận file mới hoặc URL đã có
      if (!frontFile && !frontURL) {
        errs.front = "Vui lòng tải mặt trước giấy tờ.";
      }
      if (!backFile && !backURL) {
        errs.back = "Vui lòng tải mặt sau giấy tờ.";
      }
    }

    // Logo: nếu bị từ chối -> bắt buộc re-upload file logo mới
    if (sellerStatus === "REJECTED") {
      if (!(logoFile instanceof File)) {
        errs.logo = "Vui lòng chọn lại logo JPG/PNG (≤ 2MB).";
      }
    }

    // Thông tin cơ bản
    if (!storeName.trim()) errs.storeName = "Tên cửa hàng là bắt buộc.";
    if (!addressLine.trim()) errs.address = "Vui lòng nhập địa chỉ chi tiết.";
    if (!agreedToTerms) errs.terms = "Bạn cần đồng ý với điều khoản.";

    setErrors(errs);
    return errs;
  };

  const saveDraft = () => {
    const uid = myProfile?.id;
    if (!uid) return;
    const DRAFT_KEY = `seller_onboarding_draft_${uid}`;
    const draft = {
      storeName,
      logoPreview,
      // không lưu front/back URL để tránh lộ private
      frontURL: null,
      backURL: null,
      province: province?.code || null,
      district: district?.code || null,
      ward: ward?.code || null,
      addressLine,
      agreedToTerms,
      contactEmail,
      ownerId: uid,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    toast("Đã lưu nháp");
  };

  // Chấp nhận chính sách sau khi có sellerId
  const doAcceptPolicy = async (sid) => {
    if (!sid || !agreedToTerms) return;
    try {
      await acceptSellerPolicy(authFetch, sid, { forwardedFor: "203.113.1.9" });
      console.log("[Policy] Accepted for seller:", sid);
    } catch (e) {
      console.warn("[Policy] Accept failed:", e?.message || e);
      // không chặn luồng đăng ký nếu chấp nhận policy fail, có thể re-try chỗ khác
    }
  };

  const handleFinish = async () => {
    if (!isAuthenticated) {
      toast("Vui lòng đăng nhập để tiếp tục.");
      navigate("/login", { replace: true });
      return;
    }
    const userId = myProfile?.id;
    if (!userId) {
      toast("Không tìm thấy userId. Vui lòng thử lại.");
      return;
    }
    const errs = validate();
    if (Object.keys(errs).length) {
      toast("Vui lòng kiểm tra các trường còn thiếu.");
      return;
    }

    try {
      setSubmitting(true);
      const fullAddr = [addressLine, ward?.name, district?.name, province?.name]
        .filter(Boolean)
        .join(", ");

      await registerSeller(authFetch, {
        userId,
        shopName: storeName,
        address: fullAddr,
        email: contactEmail || user?.email || "seller@example.com",
        identifications: [frontFile, backFile].filter(Boolean),
        avatar: logoFile instanceof File ? logoFile : null,
      });

      // Sau khi đăng ký thành công -> trạng thái quay về PENDING
      const msg =
        sellerStatus === "REJECTED"
          ? "Gửi duyệt lại thành công!"
          : "Đăng ký seller thành công!";
      toast(msg);
      setIsSubmitted(true);
      setSellerStatus("PENDING");

      // Lấy lại seller để có sellerId
      try {
        setSellerLoading(true);
        const again = await getSellerByUserId(authFetch, userId);
        const sid = again?.id || "";
        if (sid) setSellerId(sid);

        // Chấp nhận chính sách cho seller này
        if (sid) await doAcceptPolicy(sid);
      } catch (e) {
        console.warn("Reload seller/accept policy failed:", e?.message || e);
      } finally {
        setSellerLoading(false);
      }
    } catch (e) {
      console.error("Lỗi đăng ký seller:", e);
      if (e.message?.includes?.("Phiên đăng nhập hết hạn")) {
        toast("Phiên đăng nhập hết hạn. Đang chuyển hướng về đăng nhập...");
        logout();
        navigate("/login", { replace: true });
      } else if (e.message?.includes?.("Yêu cầu hết thời gian chờ")) {
        toast("Yêu cầu mất quá lâu để xử lý. Vui lòng thử lại.");
      } else {
        toast("Lỗi đăng ký: " + (e.message || "Không thể gửi duyệt"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ================== UI ==================
  return (
    <div className="wk-container">
      <div className="wk-content">
        <header className="wk-hero" role="banner" aria-label="Tiêu đề trang">
          <h1 className="wk-hero-title">
            Thiết lập hồ sơ <span>Nhà Bán</span>
          </h1>
          <p className="wk-hero-subtitle">{message || "Chào mừng bạn!"}</p>
          <ul className="wk-hero-ticks" aria-label="Điểm nổi bật">
            <li>✔ Xác thực pháp lý</li>
            <li>✔ Cấu hình gian hàng</li>
            <li>✔ Hoàn tất nhanh gọn</li>
          </ul>

          <div style={{ marginTop: 8 }}>
            {sellerLoading ? (
              <div className="wk-note">Đang kiểm tra seller…</div>
            ) : sellerId ? (
              <div className="wk-note success">
                Seller ID: <code>{sellerId}</code>
              </div>
            ) : sellerErr ? (
              <div className="wk-note warn">{sellerErr}</div>
            ) : (
              <div className="wk-note"></div>
            )}
          </div>

          {sellerStatus === "REJECTED" && (
            <div className="wk-note warn" style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                Hồ sơ của bạn đã bị từ chối. Vui lòng chỉnh sửa và tải lại
                <u> 2 ảnh giấy tờ + logo gian hàng</u>, sau đó gửi duyệt lại.
              </div>
              {rejectedReason ? (
                <div>
                  <b>Lý do:</b> {rejectedReason}
                </div>
              ) : (
                <div>Hãy kiểm tra email để xem chi tiết lý do từ chối.</div>
              )}
            </div>
          )}
        </header>

        {/* Giấy tờ pháp lý */}
        <section className="sp-section card">
          <div className="sp-section-head">
            <h2>Giấy tờ pháp lý</h2>
            <p className="sub">
              Tải ảnh xác thực danh tính & địa chỉ kinh doanh
            </p>
          </div>

          <div className="legal-grid">
            <div className="legal-left">
              <div className="upload-grid">
                <label
                  className={`upload-card ${frontURL ? "has-image" : ""} ${
                    errors.front ? "is-error" : ""
                  }`}
                  {...dropFront}
                  aria-label="Tải ảnh mặt trước"
                >
                  <input
                    type="file"
                    className="u-input"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (!/^image\/(jpe?g|png)$/i.test(f.type)) {
                        toast("Giấy tờ chỉ nhận JPG/PNG");
                        return;
                      }
                      if (f.size > 10 * 1024 * 1024) {
                        toast("Giấy tờ ≤ 10MB");
                        return;
                      }
                      setFrontFile(f);
                      setFrontURL(URL.createObjectURL(f));
                    }}
                    disabled={isSubmitted && sellerStatus === "PENDING"}
                  />

                  {frontURL ? (
                    <>
                      <img src={frontURL} alt="Mặt trước" className="preview" />
                      <button
                        type="button"
                        className="u-remove"
                        onClick={(ev) => {
                          ev.preventDefault();
                          if (isSubmitted && sellerStatus === "PENDING") return;
                          setFrontURL(null);
                          setFrontFile(null);
                        }}
                        disabled={isSubmitted && sellerStatus === "PENDING"}
                        aria-label="Xoá ảnh mặt trước"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="plus">+</span>
                      <span className="utitle">
                        Kéo-thả hoặc bấm để tải
                        <br />
                        Mặt trước giấy tờ
                      </span>
                    </>
                  )}
                </label>
                {errors.front && <p className="field-error">{errors.front}</p>}

                <label
                  className={`upload-card ${backURL ? "has-image" : ""} ${
                    errors.back ? "is-error" : ""
                  }`}
                  {...dropBack}
                  aria-label="Tải ảnh mặt sau"
                >
                  <input
                    type="file"
                    className="u-input"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (!/^image\/(jpe?g|png)$/i.test(f.type)) {
                        toast("Giấy tờ chỉ nhận JPG/PNG");
                        return;
                      }
                      if (f.size > 10 * 1024 * 1024) {
                        toast("Giấy tờ ≤ 10MB");
                        return;
                      }
                      setBackFile(f);
                      setBackURL(URL.createObjectURL(f));
                    }}
                    disabled={isSubmitted && sellerStatus === "PENDING"}
                  />

                  {backURL ? (
                    <>
                      <img src={backURL} alt="Mặt sau" className="preview" />
                      <button
                        type="button"
                        className="u-remove"
                        onClick={(ev) => {
                          ev.preventDefault();
                          if (isSubmitted && sellerStatus === "PENDING") return;
                          setBackURL(null);
                          setBackFile(null);
                        }}
                        disabled={isSubmitted && sellerStatus === "PENDING"}
                        aria-label="Xoá ảnh mặt sau"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="plus">+</span>
                      <span className="utitle">
                        Kéo-thả hoặc bấm để tải
                        <br />
                        Mặt sau giấy tờ
                      </span>
                    </>
                  )}
                </label>
                {errors.back && <p className="field-error">{errors.back}</p>}
              </div>

              <div className="form-row" style={{ maxWidth: 420 }}>
                <label>Email liên hệ</label>
                <div className="control">
                  <input
                    type="email"
                    placeholder="seller@example.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    disabled={isSubmitted && sellerStatus === "PENDING"}
                    aria-label="Email"
                  />
                </div>
              </div>
            </div>

            <div className="legal-right">
              <div className="tip-box">
                <div className="tip-title">Lưu ý</div>
                <ul>
                  <li>Giấy tờ tùy thân phải là bản gốc và còn hiệu lực.</li>
                  <li>Ảnh rõ nét, không chói, không che mờ thông tin.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Địa chỉ */}
          <div className="addr-block">
            <div className="addr-head">Địa chỉ kinh doanh</div>
            <p className="addr-desc">
              Hệ thống sẽ xuất hoá đơn theo địa chỉ này.
            </p>

            {vnError && (
              <div className="wk-note warn" style={{ marginBottom: 8 }}>
                {vnError}{" "}
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => loadProvinces()}
                >
                  Thử lại
                </button>
              </div>
            )}

            {loadingVN ? (
              <div className="addr-skeleton">
                <div className="sk-line" />
                <div className="sk-line" />
                <div className="sk-line" />
              </div>
            ) : (
              <>
                <div className="row-2">
                  <div className="form-row">
                    <label>Tỉnh/Thành phố</label>
                    <div className="control">
                      <select
                        value={province?.code || ""}
                        onChange={(e) => onProvinceChange(e.target.value)}
                        disabled={isSubmitted && sellerStatus === "PENDING"}
                        aria-label="Chọn Tỉnh/Thành"
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
                  </div>

                  <div className="form-row">
                    <label>Quận/Huyện</label>
                    <div className="control">
                      <select
                        value={district?.code || ""}
                        onChange={(e) => onDistrictChange(e.target.value)}
                        disabled={isSubmitted && sellerStatus === "PENDING"}
                        aria-label="Chọn Quận/Huyện"
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
                  </div>
                </div>

                <div
                  className="row-2"
                  data-error-anchor={errors.address ? "true" : undefined}
                >
                  <div className="form-row">
                    <label>Phường/Xã</label>
                    <div className="control">
                      <select
                        value={ward?.code || ""}
                        onChange={(e) => {
                          const w =
                            wards.find(
                              (x) => String(x.code) === String(e.target.value)
                            ) || null;
                          setWard(w);
                        }}
                        disabled={isSubmitted && sellerStatus === "PENDING"}
                        aria-label="Chọn Phường/Xã"
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
                  </div>

                  {/* Địa chỉ chi tiết + Goong */}
                  <div className="form-row" style={{ position: "relative" }}>
                    <label>Địa chỉ chi tiết</label>
                    <div className="control" style={{ position: "relative" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          position: "relative",
                        }}
                      >
                        <input
                          ref={addressInputRef}
                          type="text"
                          placeholder="Số nhà, đường…"
                          value={addressLine}
                          onChange={(e) => setAddressLine(e.target.value)}
                          onFocus={() => {
                            setIsInputFocused(true);
                            if (predictions.length) setShowPredictions(true);
                          }}
                          onBlur={() => {
                            setIsInputFocused(false);
                            setTimeout(() => setShowPredictions(false), 120);
                          }}
                          disabled={isSubmitted && sellerStatus === "PENDING"}
                          aria-label="Địa chỉ chi tiết"
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={searchOnMap}
                          title="Xem trên bản đồ"
                          disabled={isSubmitted && sellerStatus === "PENDING"}
                        >
                          📍 Bản đồ
                        </button>
                      </div>

                      {/* Gợi ý địa chỉ */}
                      {showPredictions && predictions.length > 0 && (
                        <div
                          role="listbox"
                          aria-label="Gợi ý địa chỉ"
                          style={{
                            position: "absolute",
                            zIndex: 30,
                            left: 0,
                            right: 0,
                            top: "100%",
                            marginTop: 6,
                            background: "#fff",
                            border: "1px solid #eee",
                            borderRadius: 8,
                            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                            overflow: "hidden",
                          }}
                        >
                          {predictions.map((p, idx) => {
                            const main = p?.description || "";
                            const secondary =
                              p?.structured_formatting?.secondary_text || "";
                            return (
                              <button
                                key={p.place_id || idx}
                                type="button"
                                role="option"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handlePickPrediction(p)}
                                title={main}
                                style={{
                                  width: "100%",
                                  textAlign: "left",
                                  padding: "10px 12px",
                                  border: "none",
                                  background: "white",
                                  cursor: "pointer",
                                }}
                              >
                                <div style={{ fontWeight: 600 }}>{main}</div>
                                {secondary ? (
                                  <div style={{ opacity: 0.7, fontSize: 12 }}>
                                    {secondary}
                                  </div>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Cảnh báo + địa chỉ đã chọn */}
                      <div className="wk-note" style={{ marginTop: 6 }}>
                        ⚠️ Hãy ghim vị trí đúng trên bản đồ để giao hàng chính
                        xác.
                      </div>
                      {fullAddress && (
                        <div
                          className="wk-note success"
                          style={{ marginTop: 6 }}
                        >
                          <strong>Địa chỉ đã chọn:</strong> {fullAddress}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {errors.address && (
                  <p className="field-error">{errors.address}</p>
                )}
              </>
            )}
          </div>
        </section>

        {/* Cấu hình gian hàng */}
        <section className="wk-store-setup-content card">
          <div className="wk-form-section">
            <div
              className={`wk-form-group ${errors.storeName ? "has-error" : ""}`}
            >
              <label className="wk-form-label">
                <span className="wk-required">*</span> Tên cửa hàng
              </label>
              <p className="wk-form-description">
                Tên ngắn gọn, dễ nhớ, không dùng từ gây hiểu nhầm.
              </p>
              <div className="wk-input-wrapper">
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value.slice(0, 35))}
                  className="wk-store-name-input"
                  placeholder="Nhập tên cửa hàng"
                  disabled={isSubmitted && sellerStatus === "PENDING"}
                  aria-invalid={!!errors.storeName}
                  aria-describedby="err-store-name"
                />
                <span className="wk-char-count">{storeName.length}/35</span>
              </div>
              {errors.storeName && (
                <p id="err-store-name" className="field-error">
                  {errors.storeName}
                </p>
              )}

              <div className="wk-warning-box">
                <ul>
                  <li>
                    Tránh từ “tốt nhất, rẻ nhất…”, tên địa phương/quốc gia.
                  </li>
                  <li>
                    Nếu chứa tên thương hiệu bảo hộ, cần giấy uỷ quyền/chứng
                    nhận.
                  </li>
                </ul>
              </div>
            </div>

            <div className="wk-form-group">
              <label className="wk-form-label">Logo gian hàng</label>
              <p className="wk-form-description">320x320px · JPG/PNG · ≤ 2MB</p>
              <div className="wk-logo-upload-section">
                <div className="wk-logo-upload-area">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="wk-logo-preview"
                    />
                  ) : (
                    <div
                      className="wk-logo-placeholder"
                      aria-label="Chưa có logo"
                    >
                      <svg
                        viewBox="0 0 64 64"
                        width="40"
                        height="40"
                        aria-hidden="true"
                      >
                        <rect
                          x="8"
                          y="20"
                          width="48"
                          height="32"
                          rx="4"
                          fill="#4A90E2"
                          stroke="#fff"
                          strokeWidth="2"
                        />
                        <rect x="12" y="28" width="8" height="16" fill="#fff" />
                        <rect x="24" y="24" width="16" height="4" fill="#fff" />
                        <rect x="24" y="32" width="12" height="2" fill="#fff" />
                        <rect x="24" y="36" width="8" height="2" fill="#fff" />
                      </svg>
                    </div>
                  )}
                  <label className="wk-upload-button">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                      style={{ display: "none" }}
                      disabled={isSubmitted && sellerStatus === "PENDING"}
                    />
                    📥 Tải logo
                  </label>
                  {logoPreview && (
                    <button
                      type="button"
                      className="wk-upload-button ghost"
                      onClick={() => {
                        if (isSubmitted && sellerStatus === "PENDING") return;
                        setLogoPreview(null);
                        setLogoFile(null);
                      }}
                      disabled={isSubmitted && sellerStatus === "PENDING"}
                      aria-label="Xoá logo"
                    >
                      ✕ Xoá
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Preview mobile */}
          <div className="wk-mobile-preview-wrapper">
            <p className="wk-preview-label">Mô phỏng trang gian hàng</p>
            <div className="wk-mobile-preview-section">
              <div className="wk-mobile-preview">
                <div className="wk-mobile-header">
                  <div className="wk-mobile-status">
                    <span>9:41</span>
                    <div className="wk-mobile-icons">
                      <span>📶</span>
                      <span>📶</span>
                      <span>📶</span>
                      <span>🔋</span>
                    </div>
                  </div>
                  <div className="wk-mobile-nav">
                    <span>←</span>
                    <div className="wk-search-bar">
                      🔍 Tìm kiếm tại cửa hàng
                    </div>
                    <span>🛒</span>
                    <span>1</span>
                    <span>⋯</span>
                  </div>
                </div>

                <div className="wk-store-info">
                  <div className="wk-store-avatar">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Store logo" />
                    ) : (
                      <div className="default-avatar">🏪</div>
                    )}
                  </div>
                  <div className="wk-store-details">
                    <h4>{storeName || "Tên cửa hàng"}</h4>
                    <p>1.5K người theo dõi</p>
                    <div className="wk-action-buttons">
                      <button className="wk-chat-btn">Chat</button>
                      <button className="wk-follow-btn">Theo dõi</button>
                    </div>
                  </div>
                </div>

                <div className="wk-mobile-tabs">
                  <span className="active">Cửa Hàng</span>
                  <span>Sản Phẩm</span>
                  <span>Bộ Sưu Tập</span>
                  <span>Giá Sốc Hôm Nay</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="wk-form-footer">
            <label className="wk-checkbox-container">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                disabled={isSubmitted && sellerStatus === "PENDING"}
              />
              <span className="checkmark"></span>
              Tôi đồng ý với{" "}
              <a
                href="#"
                className="wk-link"
                onClick={(e) => {
                  e.preventDefault();
                  const d = new Date();
                  const pad = (n) => String(n).padStart(2, "0");
                  const today = `${d.getFullYear()}-${pad(
                    d.getMonth() + 1
                  )}-${pad(d.getDate())}`;
                  window.open(
                    `/seller/policys?at=${today}`,
                    "_blank",
                    "noopener,noreferrer"
                  );
                }}
              >
                Chính sách & điều khoản
              </a>
            </label>
            {errors.terms && (
              <p className="field-error" style={{ marginTop: 8 }}>
                {errors.terms}
              </p>
            )}

            <div className="wk-actions">
              <button
                className="btn ghost"
                type="button"
                onClick={saveDraft}
                disabled={isSubmitted && sellerStatus === "PENDING"}
              >
                Lưu nháp
              </button>
              <button
                className={`wk-finish-button ${submitting ? "is-loading" : ""}`}
                onClick={handleFinish}
                disabled={
                  submitting ||
                  loadingProfile ||
                  !myProfile?.id ||
                  (isSubmitted && sellerStatus === "PENDING")
                }
                aria-busy={submitting || loadingProfile}
                title={
                  loadingProfile
                    ? "Đang tải hồ sơ..."
                    : !myProfile?.id
                    ? "Chưa tải được hồ sơ"
                    : isSubmitted && sellerStatus === "PENDING"
                    ? "Hồ sơ đang đợi duyệt"
                    : undefined
                }
              >
                {submitting
                  ? "Đang xử lý…"
                  : isSubmitted && sellerStatus === "PENDING"
                  ? "Đã gửi duyệt"
                  : sellerStatus === "REJECTED"
                  ? "Gửi duyệt lại"
                  : "Gửi duyệt"}
              </button>
            </div>

            {isSubmitted && sellerStatus === "PENDING" && (
              <div className="wk-pending-message">
                Hồ sơ của bạn đang đợi duyệt, hãy đợi chút nhé!
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Modal bản đồ (Goong) */}
      {mapModalOpen && (
        <div
          className="addr-modal-overlay"
          onClick={closeMapModal}
          style={{ zIndex: 1000 }}
        >
          <div
            className="addr-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(1100px, 95vw)", maxHeight: "92vh" }}
          >
            <div className="addr-modal-header">
              <button
                className="map-back-btn btn ghost"
                onClick={closeMapModal}
              >
                ← Sửa Vị trí
              </button>
              <h3>
                {[
                  addressLine?.trim(),
                  ward?.name,
                  district?.name,
                  province?.name,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </h3>
            </div>

            <div className="map-container" style={{ height: "72vh" }}>
              <div
                ref={mapRef}
                className="google-map"
                style={{ height: "100%" }}
              />
              <div className="map-info-overlay">
                <div className="map-info-card">
                  <h4>Địa chỉ của bạn ở đây</h4>
                  <p>Vui lòng kiểm tra vị trí trên bản đồ</p>
                </div>
              </div>
            </div>

            <div className="addr-modal-footer">
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
