// src/pages/seller/products/ProductEdit.jsx
import React, { useEffect, useState, useContext, useMemo, useRef } from "react";
import {
  Upload,
  Plus,
  X,
  Info,
  Settings,
  CheckCircle,
  Minus,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  RotateCcw,
  Send,
  Pencil,
  GripVertical,
} from "lucide-react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import "../../../styles/ProductCreation.css";
import {
  fetchProductDetail,
  updateProduct,
  reregisterProduct,
} from "../../../services/products";
import { API_CONFIG, apiUrl } from "../../../config/api";
import { AuthContext } from "../../../contexts/AuthContext";
import { showToast } from "../../../utils/toast";
import Portal from "../product/Portal";

/* ===== Local constants (đồng bộ Create) ===== */
const ALLOWED_MIME = ["image/jpeg", "image/png"];
const ALLOWED_EXT = ["jpg", "jpeg", "png"];
const getExt = (name = "") => {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
};
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const WARN_FILE_SIZE = 800 * 1024;
const RECOMMENDED_DIM = "1024×1024";
const MAX_IMAGES = 10;

const MAX_NAME_WORDS = 20;
const MAX_WORD_LEN = 10;
const MAX_OPTIONS = 2; // y chang trang tạo
const OPTION_VALUE_CHAR_LIMIT = 20;

const genUid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `uid_${Math.random().toString(36).slice(2)}_${Date.now()}`;

const isColorName = (s = "") =>
  s.toLowerCase().includes("màu") || s.toLowerCase().includes("color");

const findTooLongWord = (raw = "") => {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  for (const w of words) if (w.length > MAX_WORD_LEN) return w;
  return "";
};

const sanitizeName = (raw = "") => {
  const words = raw.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return words.slice(0, MAX_NAME_WORDS).join(" ");
};

function cartesian(arrays) {
  if (!arrays.length) return [];
  return arrays.reduce(
    (acc, cur) => {
      const next = [];
      acc.forEach((a) => cur.forEach((b) => next.push([...a, b])));
      return next;
    },
    [[]]
  );
}

/* ===== Category VN mapping + template (đồng bộ Create) ===== */
const CATEGORY_VN = {
  Electronics: "Điện tử",
  Fashion: "Thời trang",
  Books: "Sách",
  Home: "Nhà cửa",
  Sports: "Thể thao",
  Beauty: "Làm đẹp",
  Toys: "Đồ chơi",
  Automotive: "Ô tô - Xe máy",
  Health: "Sức khoẻ",
  Grocery: "Tạp hoá",
  SecondHand: "Đồ Uống",
  All: "Tất cả",
};
const labelCategoryVN = (name) => CATEGORY_VN[name] || name;

const DEFAULT_TEMPLATES = {
  Fashion: [
    { name: "Màu sắc", values: ["Be", "Đen"] },
    { name: "Kích cỡ", values: ["M", "L"] },
  ],
  Electronics: [
    { name: "Phiên bản", values: ["Tiêu chuẩn", "Pro"] },
    { name: "Màu sắc", values: ["Đen", "Bạc"] },
  ],
  Sports: [
    { name: "Kích cỡ", values: ["M", "L"] },
    { name: "Màu sắc", values: ["Đen", "Đỏ"] },
  ],
  Beauty: [
    { name: "Dung tích", values: ["50ml", "100ml"] },
    { name: "Mùi hương", values: ["Fresh", "Floral"] },
  ],
  Toys: [
    { name: "Màu sắc", values: ["Hồng", "Vàng"] },
    { name: "Chất liệu", values: ["Nhựa", "Gỗ"] },
  ],
  Books: [
    { name: "Loại bìa", values: ["Bìa mềm", "Bìa cứng"] },
    { name: "Ngôn ngữ", values: ["Việt", "Anh"] },
  ],
  Home: [
    { name: "Kích thước", values: ["S", "M"] },
    { name: "Màu sắc", values: ["Trắng", "Ghi"] },
  ],
  Automotive: [
    { name: "Dòng xe", values: ["Xe máy", "Ô tô"] },
    { name: "Màu sắc", values: ["Đen", "Bạc"] },
  ],
  Health: [
    { name: "Quy cách", values: ["Hộp 10", "Hộp 30"] },
    { name: "Dạng", values: ["Viên", "Bột"] },
  ],
  Grocery: [
    { name: "Khối lượng", values: ["250g", "500g"] },
    { name: "Vị", values: ["Nguyên bản", "Ít đường"] },
  ],
  SecondHand: [
    { name: "Dung tích", values: ["500ml", "1000ml"] },
    { name: "Phân loại", values: ["1 chai", "1 lốc", "1 thùng"] },
  ],
};
const defaultOptionNameByCategory = (catEn) =>
  DEFAULT_TEMPLATES[catEn]?.[0]?.name || "Phân loại";

/* === Helpers ảnh: File -> dataURL để xem trước (giống Create) === */
const fileToDataURL = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

/* ===== Modal chọn ảnh (dùng Portal như Create) ===== */
/* ===== Modal chọn ảnh (dùng Portal như Create) ===== */
function ImagePickerModal({ open, onClose, items = [], onPick }) {
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <Portal>
      <div className="pc-modal-root" role="dialog" aria-modal="true">
        <div className="pc-modal-backdrop" onClick={onClose} />
        <div className="pc-modal-content">
          <div className="pc-modal-head">
            <h4>Chọn ảnh từ thư viện</h4>
            <button
              className="pc-order-mgmt-btn pc-ghost pc-btn-sm"
              onClick={onClose}
            >
              <X size={16} /> Đóng
            </button>
          </div>

          {items?.length ? (
            <div className="pc-modal-grid">
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="pc-modal-thumb"
                  onClick={() => {
                    onPick?.(it);
                    onClose();
                  }}
                  title={`Chọn ảnh: ${it.name}`}
                >
                  <img src={it.url} alt={it.name || "img"} />
                  <div className="pc-modal-thumb-name">
                    {it.kind === "old" ? "Cũ - " : "Mới - "}
                    {it.name}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="pc-empty">
              Chưa có ảnh. Hãy tải ảnh ở phần “Ảnh”.
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

/* ===== ValueCell (đồng bộ Create) ===== */
const ValueCell = ({
  isMediaOption,
  value,
  placeholder,
  imgPreview,
  onPickImage,
  onClearMedia,
  onChange,
  onCommit,
  onRemove,
  readOnly = false,
}) => {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);

  const count = (draft || "").length;
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onCommit?.(draft);
    }
  };

  return (
    <div className="pc-value-cell">
      {isMediaOption ? (
        <button
          type="button"
          className="pc-thumb-pick"
          onClick={(e) => onPickImage?.(e)}
          title="Chọn ảnh"
        >
          {imgPreview?.url ? (
            <>
              <img src={imgPreview.url} alt={imgPreview.name || "preview"} />
              <span
                className="pc-thumb-close"
                title="Xoá gán ảnh"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onClearMedia?.();
                }}
              >
                <X size={14} />
              </span>
            </>
          ) : (
            <div className="pc-thumb-placeholder">
              <ImageIcon size={16} />
              <span>Chọn ảnh</span>
            </div>
          )}
        </button>
      ) : (
        <div className="pc-value-thumb pc-value-thumb--spacer" />
      )}

      <div className="pc-value-input-wrap">
        <input
          type="text"
          className="pc-form-input pc-input-compact pc-value-input"
          value={readOnly ? value || "" : draft}
          onChange={(e) => {
            const next = e.target.value.slice(0, OPTION_VALUE_CHAR_LIMIT);
            if (readOnly) return;
            setDraft(next);
            onChange?.(next);
          }}
          onBlur={() => onCommit?.(draft)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={OPTION_VALUE_CHAR_LIMIT}
          readOnly={readOnly}
        />
        <div className="pc-value-meta">
          <span className="pc-counter">
            {count}/{OPTION_VALUE_CHAR_LIMIT}
          </span>
          <div className="pc-value-actions">
            <button
              type="button"
              className="pc-action-icon"
              onClick={onRemove}
              title="Xoá"
              disabled={!value}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ================== PRODUCT EDIT PAGE ================= */
const DISCONTINUED_STATES = ["DISCONTINUED", "DELETED"];
const STEP2_TOUR_SEEN_KEY = "edit_product_step2_tour_seen_v2";

export default function ProductEdit() {
  const { authFetch } = useContext(AuthContext) || {};
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  const [productId, setProductId] = useState("");

  /* Danh mục */
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catErr, setCatErr] = useState("");
  const findCategoryById = (id) => categories.find((c) => c.id === id);
  const getCategoryEnName = (id) => findCategoryById(id)?.name || "";

  /* Form */
  const [productData, setProductData] = useState({
    name: "",
    categoryId: "",
    description: "",
    images: [], // File[] (chỉ hình mới)
    optionDefs: [], // [{uid,name,values[]}]
    variants: [],
    mediaByOption: [],
  });

  /* Ảnh cũ và preview ảnh mới */
  const [oldImages, setOldImages] = useState([]); // string URLs
  const [markedRemoveOld, setMarkedRemoveOld] = useState(new Set());
  const [imgPreviews, setImgPreviews] = useState([]); // previews for new images

  /* Tour / lỗi */
  const [nameErr, setNameErr] = useState("");
  const [step2Err, setStep2Err] = useState("");
  const step2Ref = useRef(null);

  /* Duplicate warnings theo từng option name */
  const [dupWarnings, setDupWarnings] = useState({}); // { [optName]: "msg" }

  /* Modal chọn ảnh */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerBind, setPickerBind] = useState(null);
  const [pickerPos, setPickerPos] = useState(null);

  /* input rỗng theo optName */
  const [optionValueInputs, setOptionValueInputs] = useState({});

  /* rename option name state (giống Create) */
  const [editingOptionUid, setEditingOptionUid] = useState(null);
  const [editingNameInput, setEditingNameInput] = useState("");

  /* Drag state */
  const dragOptionUidRef = useRef(null);
  const dragValueRef = useRef(null); // { optUid, index }

  /* Bulk set (giống Create) */
  const [bulkAll, setBulkAll] = useState({ price: "", compare: "", qty: "" });

  /* Re-register mode */
  const [reRegisterMode, setReRegisterMode] = useState(false);

  /* Snapshot để khôi phục */
  const originalRef = useRef(null);
  const takeSnapshot = (prod, optionDefs, variants, mediaByOption, oldImgs) => {
    originalRef.current = {
      id: prod.id,
      name: prod.name || "",
      categoryId: prod.categoryId || prod.category?.id || "",
      description: prod.description || "",
      optionDefs: JSON.parse(JSON.stringify(optionDefs || [])),
      variants: JSON.parse(JSON.stringify(variants || [])),
      mediaByOption: JSON.parse(JSON.stringify(mediaByOption || [])),
      oldImages: Array.isArray(oldImgs) ? oldImgs.slice() : [],
    };
  };
  const restoreFromSnapshot = () => {
    const s = originalRef.current;
    if (!s) return;
    setProductId(s.id || "");
    setProductData((prev) => ({
      ...prev,
      name: s.name,
      categoryId: s.categoryId,
      description: s.description,
      optionDefs: JSON.parse(JSON.stringify(s.optionDefs)),
      variants: JSON.parse(JSON.stringify(s.variants)),
      mediaByOption: JSON.parse(JSON.stringify(s.mediaByOption)),
      images: [],
    }));
    setMediaKey(pickMediaKey(s.optionDefs));
    setOldImages(Array.isArray(s.oldImages) ? s.oldImages.slice() : []);
    setMarkedRemoveOld(new Set());
    imgPreviews.forEach((p) => p?.url && URL.revokeObjectURL(p.url));
    setImgPreviews([]);
    setStep2Err("");
    setNameErr("");
    showToast?.({
      title: "Đã khôi phục",
      text: "Form đã trở về như lúc tải ban đầu.",
      type: "info",
    });
  };

  /* Media key */
  const pickMediaKey = (opts) => {
    const colorOpt =
      (opts || []).find((o) => isColorName(o.name || "")) || (opts || [])[0];
    return colorOpt?.name || "";
  };
  const [mediaKey, setMediaKey] = useState("");

  /* ===== Tour ===== */
  function runStep2Tour() {
    const drv = driver({
      allowClose: true,
      animate: true,
      opacity: 0.45,
      stagePadding: 8,
    });
    const STEPS = [
      {
        element: '[data-tour="step2-title"]',
        popover: {
          title: "Biến thể của sản phẩm",
          description:
            "Đặt tên biến thể (Màu sắc/Kích cỡ/Thông số…) và thêm giá trị.",
          side: "bottom",
          align: "start",
        },
      },
      {
        element: '[data-tour="value-rows"]',
        popover: {
          title: "Giá trị biến thể",
          description:
            "Nhập vào dòng rỗng; Enter/nhấp ra ngoài để lưu; luôn có 1 ô rỗng kế tiếp.",
          side: "bottom",
          align: "start",
        },
      },
    ].filter((s) => {
      try {
        return !!document.querySelector(s.element);
      } catch {
        return false;
      }
    });
    if (STEPS.length) {
      drv.setSteps(STEPS);
      drv.drive();
    }
  }

  /* ============ LOAD PRODUCT & CATEGORIES ============ */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadErr("");

        // categories
        setCatLoading(true);
        setCatErr("");
        try {
          const res = await authFetch(apiUrl(API_CONFIG.endpoints.categories), {
            method: "GET",
            headers: { Accept: "application/json" },
          });
          const js = await res.json().catch(() => ({}));
          const list = Array.isArray(js?.result) ? js.result : [];
          if (!cancelled) setCategories(list);
        } catch (e) {
          if (!cancelled) setCatErr(e.message || "Không tải được danh mục");
        } finally {
          if (!cancelled) setCatLoading(false);
        }

        // product detail
        const productIdFromURL = window.location.pathname.split("/").pop();
        const prod = await fetchProductDetail(authFetch, productIdFromURL);
        if (!prod) throw new Error("Không tìm thấy sản phẩm.");

        if (!cancelled) {
          setProductId(prod.id);

          // chuẩn hóa optionDefs: thêm uid
          const rawOptionDefs =
            Array.isArray(prod.optionDefs) && prod.optionDefs.length
              ? prod.optionDefs
              : [{ name: "Phân loại", values: [] }];

          const optionDefs = rawOptionDefs.map((o) => ({
            uid: genUid(),
            name: o.name,
            values: Array.isArray(o.values) ? o.values : [],
          }));

          const active = optionDefs.filter(
            (o) => o.name && (o.values || []).length
          );
          const names = active.map((o) => o.name);
          const combos = cartesian(active.map((o) => o.values));

          const existedMap = new Map(
            (Array.isArray(prod.variants) ? prod.variants : [])
              .filter((v) => v && typeof v.options === "object")
              .map((v) => [JSON.stringify(v.options), v])
          );

          const variants = combos.map((arr) => {
            const opts = {};
            names.forEach((n, i) => (opts[n] = arr[i]));
            const prev = existedMap.get(JSON.stringify(opts));
            return {
              options: opts,
              price: Number(prev?.price || 0),
              compareAtPrice: Number(prev?.compareAtPrice || 0),
              quantity: Number(prev?.quantity || 0),
              available: prev?.available !== false,
            };
          });

          const mediaByOption = Array.isArray(prod.mediaByOption)
            ? prod.mediaByOption
            : [];

          setProductData((prev) => ({
            ...prev,
            name: prod.name || "",
            categoryId: prod.categoryId || prod.category?.id || "",
            description: prod.description || "",
            optionDefs,
            variants,
            mediaByOption,
            images: [], // ảnh mới
          }));

          setMediaKey(pickMediaKey(optionDefs));

          // ảnh cũ
          const imgs = (Array.isArray(prod.images) ? prod.images : [])
            .map((it) => (typeof it === "string" ? it : it?.url))
            .filter(Boolean);
          setOldImages(imgs);
          setMarkedRemoveOld(new Set());

          // reset preview ảnh mới
          setImgPreviews([]);

          // snapshot cho Refresh
          takeSnapshot(prod, optionDefs, variants, mediaByOption, imgs);

          // xác định chế độ reregister
          const st = String(prod?.status || "").toUpperCase();
          const needRe =
            prod?.reUpdate === true || DISCONTINUED_STATES.includes(st);
          setReRegisterMode(!!needRe);
        }
      } catch (e) {
        if (!cancelled) setLoadErr(e?.message || "Lỗi tải dữ liệu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => (cancelled = true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authFetch]);

  /* ===== Recompute variants khi optionDefs đổi (giống Create) ===== */
  useEffect(() => {
    const active = (productData.optionDefs || []).filter(
      (o) => o.name && (o.values || []).length
    );
    const names = active.map((o) => o.name);
    const combos = cartesian(active.map((o) => o.values));

    const prevMap = new Map(
      (productData.variants || []).map((v) => [
        JSON.stringify(v.options || {}),
        v,
      ])
    );

    const next = combos.map((arr) => {
      const opts = {};
      names.forEach((n, i) => (opts[n] = arr[i]));
      const key = JSON.stringify(opts);
      const prev = prevMap.get(key);
      return {
        options: opts,
        price: prev ? prev.price : 0,
        compareAtPrice: prev ? prev.compareAtPrice : 0,
        quantity: prev ? prev.quantity : 0,
        available: prev ? !!prev.available : true,
      };
    });
    setProductData((prev) => ({ ...prev, variants: next }));
    setMediaKey((mk) =>
      active.some((d) => d.name === mk) ? mk : pickMediaKey(active)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(productData.optionDefs)]);

  /* ===== Sắp xếp hiển thị optionDefs (giữ nguyên thứ tự người dùng như Create) ===== */
  const orderedOptionDefs = useMemo(() => {
    return productData.optionDefs || [];
  }, [productData.optionDefs]);

  /* ===== Render helpers ===== */
  const opt1 = orderedOptionDefs?.[0];
  const opt2 = orderedOptionDefs?.[1];
  const option1 = opt1?.name || "";
  const option2 = opt2?.name || "";
  const values1 = opt1?.values || [];
  const values2 = opt2?.values || [];
  const hasTwoOptions = Boolean(option1 && option2 && values2.length > 0);
  const findVariantIndex = (o1, o2) =>
    (productData.variants || []).findIndex((v) => {
      const a = v.options || {};
      if (hasTwoOptions) return a[option1] === o1 && a[option2] === o2;
      return a[option1] === o1;
    });

  /* ===== Handlers ===== */
  const step1Valid = !!(
    productData.name.trim() && productData.categoryId.trim()
  );

  const handleInputChange = (field, value) => {
    if (field === "name") {
      setProductData((prev) => ({ ...prev, name: value }));
      const bad = findTooLongWord(value);
      setNameErr(bad ? `Từ “${bad}” dài hơn ${MAX_WORD_LEN} ký tự` : "");
      return;
    }
    setProductData((prev) => ({ ...prev, [field]: value }));
  };

  /* ===== Upload ảnh mới (giống Create) ===== */
  useEffect(() => {
    return () => {
      imgPreviews.forEach((p) => p?.url && URL.revokeObjectURL(p.url));
    };
  }, [imgPreviews]);

  const handleImagesUpload = async (e) => {
    const incoming = Array.from(e.target.files || []);
    if (!incoming.length) return;

    const currentCount =
      oldImages.filter((_, i) => !markedRemoveOld.has(i)).length +
      (productData.images || []).length;
    const remaining = Math.max(0, MAX_IMAGES - currentCount);
    if (remaining <= 0) {
      alert(`Đã đủ tối đa ${MAX_IMAGES} ảnh.`);
      return;
    }

    const valid = [];
    const invalid = [];
    for (const f of incoming) {
      if (valid.length >= remaining) {
        invalid.push(`${f.name} (quá ${MAX_IMAGES} ảnh)`);
        continue;
      }
      const extOk = ALLOWED_EXT.includes(getExt(f.name));
      const mimeOk = ALLOWED_MIME.includes(f.type);
      if (!(mimeOk || (!f.type && extOk))) {
        invalid.push(`${f.name} (định dạng không hỗ trợ)`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        invalid.push(`${f.name} (> 2048KB)`);
        continue;
      }
      valid.push(f);
    }

    if (valid.length) {
      const previews = valid.map((f) => ({
        url: URL.createObjectURL(f),
        name: f.name,
        size: f.size,
        type: f.type,
      }));
      setProductData((prev) => ({
        ...prev,
        images: [...(prev.images || []), ...valid],
      }));
      setImgPreviews((prev) => [...prev, ...previews]);
    }
    if (invalid.length) {
      showToast?.({
        title: "Tệp không hợp lệ",
        text: invalid.join(", "),
        type: "warning",
      });
    }
  };

  const removeOldAt = (idx) => {
    setMarkedRemoveOld((prev) => {
      const s = new Set(prev);
      if (s.has(idx)) s.delete(idx);
      else s.add(idx);
      return s;
    });
    // Gỡ ánh xạ media nếu đang trỏ URL cũ này
    const removedUrl = oldImages[idx];
    setProductData((prev) => ({
      ...prev,
      mediaByOption: (prev.mediaByOption || []).filter(
        (m) => m.image !== removedUrl
      ),
    }));
  };

  const removeNewAt = (idx) => {
    setProductData((prev) => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== idx),
      mediaByOption: (prev.mediaByOption || [])
        .filter(
          (m) => !(String(m.image).match(/^\d+$/) && Number(m.image) === idx)
        )
        .map((m) => {
          if (String(m.image).match(/^\d+$/)) {
            const i = Number(m.image);
            if (i > idx) return { ...m, image: String(i - 1) };
          }
          return m;
        }),
    }));
    setImgPreviews((prev) => {
      const cp = [...prev];
      const removed = cp.splice(idx, 1)[0];
      if (removed?.url) URL.revokeObjectURL(removed.url);
      return cp;
    });
  };

  /* ===== Media map (giống Create) ===== */
  const setMediaImageFor = (optName, optValue, imgRef) => {
    const list = [...(productData.mediaByOption || [])];
    const idx = list.findIndex(
      (m) => m.optionName === optName && m.optionValue === optValue
    );
    const imageValue =
      typeof imgRef === "string" || typeof imgRef === "number"
        ? String(imgRef) // có thể là "0","1"... HOẶC URL
        : "";

    const item = {
      optionName: optName,
      optionValue: optValue,
      image: imageValue,
    };

    if (idx >= 0) list[idx] = item;
    else list.push(item);
    setProductData((prev) => ({ ...prev, mediaByOption: list }));
  };

  const getMediaImageIndexFor = (optName, optValue) => {
    const m = (productData.mediaByOption || []).find(
      (x) => x.optionName === optName && x.optionValue === optValue
    );
    return m?.image ?? "";
  };
  const clearMediaImageFor = (optName, optValue) => {
    const list = (productData.mediaByOption || []).filter(
      (m) => !(m.optionName === optName && m.optionValue === optValue)
    );
    setProductData((prev) => ({ ...prev, mediaByOption: list }));
  };

  /* ===== Option helpers: add/rename/remove values ===== */
  const addOptionValueFromInputByName = (optName) => {
    const raw = (optionValueInputs[optName] || "")
      .slice(0, OPTION_VALUE_CHAR_LIMIT)
      .trim();
    if (!raw) return;
    const lower = raw.toLowerCase();

    const idx = (productData.optionDefs || []).findIndex(
      (o) => o.name === optName
    );
    if (idx < 0) return;

    const current = productData.optionDefs[idx].values || [];
    if (current.some((v) => String(v).trim().toLowerCase() === lower)) {
      setDupWarnings((w) => ({ ...w, [optName]: `“${raw}” đã tồn tại.` }));
      showToast?.({
        title: "Giá trị trùng",
        text: `“${raw}” đã tồn tại.`,
        type: "warning",
      });
      return;
    }
    const opts = [...productData.optionDefs];
    opts[idx] = { ...opts[idx], values: [...current, raw] };

    setProductData((prev) => ({ ...prev, optionDefs: opts }));
    setOptionValueInputs((prev) => ({ ...prev, [optName]: "" }));
    setDupWarnings((w) => ({ ...w, [optName]: "" }));
  };

  const renameOptionValueByName = (optName, oldVal, newVal) => {
    const trimmed = (newVal || "").slice(0, OPTION_VALUE_CHAR_LIMIT).trim();
    if (!trimmed) return;
    const idx = (productData.optionDefs || []).findIndex(
      (o) => o.name === optName
    );
    if (idx < 0) return;

    const lower = trimmed.toLowerCase();
    const current = productData.optionDefs[idx].values || [];
    if (
      current.some(
        (v) => v !== oldVal && String(v).trim().toLowerCase() === lower
      )
    ) {
      setDupWarnings((w) => ({ ...w, [optName]: `“${trimmed}” đã tồn tại.` }));
      showToast?.({
        title: "Giá trị trùng",
        text: `“${trimmed}” đã tồn tại.`,
        type: "warning",
      });
      return;
    }
    const opts = [...productData.optionDefs];
    const replaced = current.map((v) => (v === oldVal ? trimmed : v));
    const optUid = opts[idx].uid;
    opts[idx] = { ...opts[idx], values: replaced };

    // đồng bộ mediaByOption
    let newMedia = productData.mediaByOption;
    if (optName === mediaKey) {
      newMedia = (productData.mediaByOption || []).map((m) =>
        m.optionName === mediaKey && m.optionValue === oldVal
          ? { ...m, optionValue: trimmed }
          : m
      );
    }

    setProductData((prev) => ({
      ...prev,
      optionDefs: opts,
      mediaByOption: newMedia,
    }));
  };

  const removeOptionValueByName = (optName, value) => {
    const idx = (productData.optionDefs || []).findIndex(
      (o) => o.name === optName
    );
    if (idx < 0) return;
    const opts = [...productData.optionDefs];
    opts[idx] = {
      ...opts[idx],
      values: (opts[idx].values || []).filter((v) => v !== value),
    };
    let newMedia = productData.mediaByOption;
    if (optName === mediaKey) {
      newMedia = (productData.mediaByOption || []).filter(
        (m) => !(m.optionName === mediaKey && m.optionValue === value)
      );
    }
    setProductData((prev) => ({
      ...prev,
      optionDefs: opts,
      mediaByOption: newMedia,
    }));
  };

  /* ===== Đổi tên biến thể (option name) — theo UID (giống Create) ===== */
  const startRenameOptionByUid = (uid) => {
    const opt = (productData.optionDefs || []).find((o) => o.uid === uid);
    setEditingOptionUid(uid);
    setEditingNameInput(opt?.name || "");
  };

  const commitRenameOptionByUid = () => {
    const uid = editingOptionUid;
    const raw = (editingNameInput || "").trim();
    if (!uid) return setEditingOptionUid(null);

    const currentOpt = (productData.optionDefs || []).find(
      (o) => o.uid === uid
    );
    const oldName = currentOpt?.name || "";

    if (!raw) {
      showToast?.({
        title: "Tên rỗng",
        text: "Vui lòng nhập tên biến thể.",
        type: "warning",
      });
      return;
    }

    const exists = (productData.optionDefs || []).some(
      (o) => o.uid !== uid && o.name?.toLowerCase() === raw.toLowerCase()
    );
    if (exists) {
      showToast?.({
        title: "Tên trùng",
        text: `“${raw}” đã tồn tại.`,
        type: "warning",
      });
      return;
    }

    const nextOptionDefs = (productData.optionDefs || []).map((o) =>
      o.uid === uid ? { ...o, name: raw } : o
    );

    const nextMedia = (productData.mediaByOption || []).map((m) =>
      m.optionName === oldName ? { ...m, optionName: raw } : m
    );

    const nextInputs = { ...optionValueInputs };
    if (Object.prototype.hasOwnProperty.call(nextInputs, oldName)) {
      nextInputs[raw] = nextInputs[oldName];
      delete nextInputs[oldName];
    }

    const nextMediaKey = mediaKey === oldName ? raw : mediaKey;

    setProductData((prev) => ({
      ...prev,
      optionDefs: nextOptionDefs,
      mediaByOption: nextMedia,
    }));
    setOptionValueInputs(nextInputs);
    setMediaKey(nextMediaKey);

    setEditingOptionUid(null);
    setEditingNameInput("");
  };

  /* ===== Drag & Drop: Option blocks ===== */
  const handleOptionDragStart = (uid) => (e) => {
    dragOptionUidRef.current = uid;
    e.dataTransfer.effectAllowed = "move";
  };
  const handleOptionDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleOptionDrop = (targetUid) => (e) => {
    e.preventDefault();
    const srcUid = dragOptionUidRef.current;
    if (!srcUid || srcUid === targetUid) return;
    setProductData((prev) => {
      const list = [...(prev.optionDefs || [])];
      const from = list.findIndex((o) => o.uid === srcUid);
      const to = list.findIndex((o) => o.uid === targetUid);
      if (from < 0 || to < 0) return prev;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return { ...prev, optionDefs: list };
    });
    dragOptionUidRef.current = null;
  };

  /* ===== Drag & Drop: Values in each option ===== */
  const handleValueDragStart = (optUid, index) => (e) => {
    dragValueRef.current = { optUid, index };
    e.dataTransfer.effectAllowed = "move";
  };
  const handleValueDrop = (optUid, targetIndex) => (e) => {
    e.preventDefault();
    const payload = dragValueRef.current;
    if (!payload) return;
    const { optUid: srcOptUid, index: from } = payload;
    if (srcOptUid !== optUid || from === targetIndex) return;
    setProductData((prev) => {
      const list = [...(prev.optionDefs || [])];
      const oi = list.findIndex((o) => o.uid === optUid);
      if (oi < 0) return prev;
      const vals = [...(list[oi].values || [])];
      const [moved] = vals.splice(from, 1);
      vals.splice(targetIndex, 0, moved);
      list[oi] = { ...list[oi], values: vals };
      return { ...prev, optionDefs: list };
    });
    dragValueRef.current = null;
  };

  /* ===== Thêm/Xoá biến thể ===== */
  const handleAddOption = () => {
    setProductData((prev) => {
      if ((prev.optionDefs || []).length >= MAX_OPTIONS) return prev;
      const newUid = genUid();
      const nextOptionDefs = [
        ...prev.optionDefs,
        { uid: newUid, name: "", values: [] },
      ];
      setTimeout(() => {
        startRenameOptionByUid(newUid); // auto focus rename ngay
      }, 0);
      return { ...prev, optionDefs: nextOptionDefs };
    });
  };

  const handleRemoveOption = (uid) => {
    setProductData((prev) => {
      const toRemove = (prev.optionDefs || []).find((o) => o.uid === uid);
      if (!toRemove) return prev;

      const next = (prev.optionDefs || []).filter((o) => o.uid !== uid);

      const nextMedia = (prev.mediaByOption || []).filter(
        (m) => m.optionName !== toRemove.name
      );

      setMediaKey(pickMediaKey(next));

      if (editingOptionUid === uid) {
        setEditingOptionUid(null);
        setEditingNameInput("");
      }

      return {
        ...prev,
        optionDefs: next,
        mediaByOption: nextMedia,
      };
    });
  };

  /* ===== Bulk set for all variants ===== */
  const formatWithComma = (s) => {
    const digits = String(s || "").replace(/\D/g, "");
    if (!digits) return "";
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  const applyBulkToAll = () => {
    const toNumber = (s) => Number(String(s || "").replace(/[^\d]/g, "")) || 0;

    setProductData((prev) => {
      const { price, compare, qty } = bulkAll;
      const hasPrice = String(price).trim() !== "";
      const hasCompare = String(compare).trim() !== "";
      const hasQty = String(qty).trim() !== "";

      const variants = (prev.variants || []).map((v) => ({
        ...v,
        price: hasPrice ? toNumber(price) : v.price,
        compareAtPrice: hasCompare ? toNumber(compare) : v.compareAtPrice,
        quantity: hasQty ? toNumber(qty) : v.quantity,
      }));

      return { ...prev, variants };
    });
  };

  /* ===== Import template theo ngành hàng (giống Create) ===== */
  const toOptionWithUid = (tplArr) =>
    (tplArr || []).slice(0, MAX_OPTIONS).map((o) => ({
      uid: genUid(),
      name: o.name,
      values: Array.from(new Set((o.values || []).slice(0, 30))),
    }));

  const buildOptionDefsFromCat = (catId) => {
    const catName = getCategoryEnName(catId);
    const tpl = DEFAULT_TEMPLATES[catName];
    if (tpl && tpl.length) {
      const uniq = toOptionWithUid(tpl);
      // đưa “Màu sắc/Color” lên đầu
      uniq.sort(
        (a, b) => (isColorName(b.name) ? 1 : 0) - (isColorName(a.name) ? 1 : 0)
      );
      return uniq;
    }
    return [
      { uid: genUid(), name: defaultOptionNameByCategory(catName), values: [] },
    ];
  };

  const handleImportTemplate = () => {
    if (!productData.categoryId) {
      showToast?.({
        title: "Chưa chọn danh mục",
        text: "Hãy chọn danh mục trước.",
        type: "warning",
      });
      return;
    }
    const next = buildOptionDefsFromCat(productData.categoryId);
    setProductData((prev) => ({
      ...prev,
      optionDefs: next,
      mediaByOption: [],
    }));
    setOptionValueInputs({});
    setDupWarnings({});
    setMediaKey(pickMediaKey(next));
    showToast?.({
      title: "Đã nhập template",
      text: "Tải template theo ngành hàng thành công.",
      type: "success",
    });
  };

  /* ===== Validate & Submit ===== */
  const scrollToStep2 = () => {
    try {
      step2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {}
  };

  const validateBeforeSubmit = () => {
    if (!productId) return alert("Không xác định được sản phẩm."), false;
    if (!productData.name?.trim())
      return alert("Vui lòng nhập Tên sản phẩm."), false;
    const bad = findTooLongWord(productData.name);
    if (bad) {
      setNameErr(`Từ “${bad}” dài hơn ${MAX_WORD_LEN} ký tự`);
      return false;
    }
    if (!productData.categoryId?.trim())
      return alert("Vui lòng chọn Danh mục."), false;
    if ((productData.variants || []).length === 0)
      return alert("Hãy thêm giá trị biến thể."), false;

    const hasAnyPrice = (productData.variants || []).some(
      (v) => Number(v.price) > 0
    );
    if (!hasAnyPrice) {
      setStep2Err("Vui lòng nhập giá cho ít nhất 1 biến thể trước khi lưu.");
      scrollToStep2();
      return false;
    }

    const totalAfter =
      oldImages.filter((_, i) => !markedRemoveOld.has(i)).length +
      (productData.images || []).length;
    if (totalAfter === 0) {
      alert("Vui lòng có ít nhất 1 ảnh.");
      return false;
    }
    if (totalAfter > MAX_IMAGES) {
      alert(`Tối đa ${MAX_IMAGES} ảnh.`);
      return false;
    }
    return true;
  };

  const buildCommonPayload = (includeStatus = true) => {
    const base = {
      id: productId,
      name: sanitizeName(productData.name),
      description: productData.description,
      categoryId: productData.categoryId,
      optionDefs: (productData.optionDefs || [])
        .filter((o) => o.name && (o.values || []).length)
        .map((o) => ({ name: o.name, values: o.values })),
      variants: (productData.variants || []).map((v) => ({
        options: v.options || {},
        price: Number(v.price || 0),
        compareAtPrice: Number(v.compareAtPrice || 0),
        quantity: Number(v.quantity || 0),
        available: v.available !== false,
      })),
      mediaByOption: (productData.mediaByOption || []).filter(
        (m) => m.optionName && m.optionValue && (m.image || m.image === "0")
      ),
      removeImage: Array.from(markedRemoveOld).map((idx) => idx + 1),
    };
    if (includeStatus) return { ...base, status: "AVAILABLE" };
    return base;
  };

  const handleSubmitUpdate = async () => {
    if (!validateBeforeSubmit()) return;
    try {
      setSubmitting(true);
      await updateProduct(
        authFetch,
        buildCommonPayload(true),
        productData.images
      );
      showToast?.({
        title: "Cập nhật sản phẩm",
        text: "Cập nhật sản phẩm thành công!",
        type: "success",
        duration: 2600,
      });
      window.history.back();
    } catch (e) {
      alert("Cập nhật thất bại: " + (e?.message || "Lỗi không xác định"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReRegister = async () => {
    if (!validateBeforeSubmit()) return;
    try {
      setSubmitting(true);
      await reregisterProduct(
        authFetch,
        buildCommonPayload(false),
        productData.images
      );
      showToast?.({
        title: "Đã gửi duyệt lại",
        text: "Sản phẩm của bạn đã được gửi cho Admin duyệt.",
        type: "success",
        duration: 2800,
      });
      window.history.back();
    } catch (e) {
      alert("Gửi duyệt thất bại: " + (e?.message || "Lỗi không xác định"));
    } finally {
      setSubmitting(false);
    }
  };

  /* ===================== UI ===================== */
  if (loading) {
    return (
      <div className="pc-onepage">
        <div className="pc-card">Đang tải dữ liệu…</div>
      </div>
    );
  }
  if (loadErr) {
    return (
      <div className="pc-onepage">
        <div className="pc-card">
          <div className="pc-alert pc-alert-danger">
            <span>{loadErr}</span>
          </div>
        </div>
      </div>
    );
  }

  const visibleOldImages = oldImages.filter((_, i) => !markedRemoveOld.has(i));

  const combinedPreviewList = [
    ...visibleOldImages.map((url, idx) => ({
      url,
      name: url.split("/").pop() || `old_${idx + 1}.jpg`,
      size: 0,
      type: "image/*",
      _kind: "old",
      _oldIndex: idx,
    })),
    ...imgPreviews.map((p, idx) => ({
      ...p,
      _kind: "new",
      _newIndex: idx,
    })),
  ];

  // Items cho modal chọn ảnh
  const pickerItems = combinedPreviewList.map((it, i) => ({
    id: i,
    url: it.url,
    name: it.name,
    kind: it._kind, // "old" hoặc "new"
    // imageValue: nếu "old" -> URL, nếu "new" -> index ảnh mới
    imageValue: it._kind === "old" ? it.url : String(it._newIndex ?? 0),
  }));

  return (
    <div className="pc-onepage">
      {/* Tiêu đề */}
      <div className="pc-card" style={{ marginBottom: 16 }}>
        <div className="pc-order-mgmt-head-row">
          <h1 className="pc-order-mgmt-title">
            <span className="pc-title-icon">✏️</span> Cập nhật sản phẩm
          </h1>

          {reRegisterMode && (
            <div
              className="pc-badge pc-badge-warn"
              title="Sản phẩm bị tạm ngưng/đã xoá — cần gửi duyệt lại"
            >
              Chế độ gửi duyệt lại
            </div>
          )}
        </div>
      </div>

      {/* 1. Thông tin chung + ẢNH */}
      <div className="pc-card">
        <div className="pc-section-subtitle">
          <span className="pc-subtitle-icon">
            <Info />
          </span>
          <h3>1. Thông tin chung</h3>
        </div>

        <div className="pc-form-grid">
          <div className="pc-form-group pc-full-width">
            <label className="pc-form-label">Danh mục *</label>
            {catLoading ? (
              <div
                className="pc-form-input pc-input-compact"
                style={{ opacity: 0.6 }}
              >
                Đang tải danh mục…
              </div>
            ) : catErr ? (
              <div className="pc-upload-note">
                <span className="pc-note-icon">!</span>
                <span>Lỗi tải danh mục: {catErr}</span>
              </div>
            ) : (
              <select
                value={productData.categoryId}
                onChange={(e) =>
                  handleInputChange("categoryId", e.target.value)
                }
                className="pc-form-select pc-input-compact"
              >
                <option value="">-- Chọn danh mục --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {labelCategoryVN(c.name)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="pc-form-group pc-full-width">
            <label className="pc-form-label">
              Tên sản phẩm (≤ {MAX_NAME_WORDS} từ, mỗi từ ≤ {MAX_WORD_LEN} ký
              tự) *
            </label>
            <input
              type="text"
              value={productData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              onBlur={(e) => {
                const cleaned = sanitizeName(e.target.value);
                const bad = findTooLongWord(cleaned);
                setProductData((prev) => ({ ...prev, name: cleaned }));
                setNameErr(
                  bad ? `Từ “${bad}” dài hơn ${MAX_WORD_LEN} ký tự` : ""
                );
              }}
              placeholder="Nhập tên sản phẩm"
              className={`pc-form-input pc-input-compact ${
                nameErr ? "pc-input-error" : ""
              }`}
            />
            {nameErr && <div className="pc-field-error">{nameErr}</div>}
          </div>

          <div className="pc-form-group pc-full-width">
            <label className="pc-form-label">
              <span className="pc-label-icon">📝</span>Mô tả
            </label>
            <textarea
              value={productData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder={
                reRegisterMode
                  ? "Mô tả thay đổi để gửi duyệt lại…"
                  : "Nhập mô tả chi tiết"
              }
              className="pc-form-textarea pc-input-compact pc-descr-equal-height"
              spellCheck={false}
              autoCorrect="off"
            />
          </div>

          {/* Ảnh */}
          <div className="pc-form-group pc-full-width">
            <label className="pc-form-label">
              <span className="pc-label-icon">📸</span>Hình ảnh sản phẩm
            </label>

            <div className="pc-file-upload-area">
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={handleImagesUpload}
                className="pc-file-input"
              />
              <div className="pc-file-upload-label">
                <Upload className="pc-upload-icon" />
                <span>Chọn hình ảnh hoặc kéo thả vào đây</span>
                <span>
                  Hỗ trợ: <strong>JPG, JPEG, PNG</strong>
                </span>
              </div>
            </div>
            <div className="pc-upload-note" style={{ marginTop: 6 }}>
              <span className="pc-note-icon">i</span>
              <span>
                Gợi ý: <b>{RECOMMENDED_DIM}px</b>, dung lượng nên ≤{" "}
                <b>{Math.round(WARN_FILE_SIZE / 1024)}KB</b>, tối đa{" "}
                <b>{MAX_IMAGES}</b> ảnh.
              </span>
            </div>

            {(combinedPreviewList.length > 0 || oldImages.length > 0) && (
              <>
                <div className="pc-uploaded-files">
                  Đang có:{" "}
                  {oldImages.filter((_, i) => !markedRemoveOld.has(i)).length +
                    (productData.images || []).length}
                  /{MAX_IMAGES} hình ảnh
                </div>

                {/* Ảnh hiện có */}
                {oldImages.length > 0 && (
                  <>
                    <div style={{ marginTop: 10, fontWeight: 700 }}>
                      Ảnh hiện có
                    </div>
                    <div className="pc-image-grid" style={{ marginTop: 8 }}>
                      {oldImages.map((url, idx) => {
                        const removed = markedRemoveOld.has(idx);
                        return (
                          <div
                            key={`old-${idx}`}
                            className="pc-image-thumb"
                            style={{
                              opacity: removed ? 0.55 : 1,
                              outline: removed ? "2px dashed #ef4444" : "none",
                              position: "relative",
                            }}
                          >
                            <img src={url} alt={`old-${idx}`} />
                            <div className="pc-thumb-meta">
                              <div className="pc-thumb-name" title={url}>
                                {url.split("/").pop()}
                              </div>
                              <div className="pc-thumb-size">cũ</div>
                            </div>
                            <button
                              onClick={() => removeOldAt(idx)}
                              className="pc-thumb-remove pc-btn-sm"
                              type="button"
                              aria-label="Đánh dấu xoá/khôi phục"
                              title={
                                removed
                                  ? "Bỏ đánh dấu xoá ảnh này"
                                  : "Đánh dấu sẽ xoá ảnh này khi lưu"
                              }
                              style={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                width: 28,
                                height: 28,
                                borderRadius: 999,
                                background: "#ef4444",
                                color: "#fff",
                                border: "1px solid rgba(255,255,255,.7)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 2px 8px rgba(0,0,0,.2)",
                              }}
                            >
                              x
                              <X size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Ảnh mới */}
                {(productData.images || []).length > 0 && (
                  <>
                    <div style={{ marginTop: 14, fontWeight: 700 }}>
                      Ảnh mới thêm
                    </div>
                    <div className="pc-image-grid" style={{ marginTop: 8 }}>
                      {imgPreviews.map((p, idx) => (
                        <div
                          key={`new-${idx}`}
                          className="pc-image-thumb"
                          style={{ position: "relative" }}
                        >
                          <img src={p.url} alt={p.name} />
                          <div className="pc-thumb-meta">
                            <div className="pc-thumb-name" title={p.name}>
                              {p.name}
                            </div>
                            <div className="pc-thumb-size">
                              {Math.round((p.size || 0) / 1024)} KB
                            </div>
                          </div>
                          <button
                            onClick={() => removeNewAt(idx)}
                            className="pc-thumb-remove pc-btn-sm"
                            type="button"
                            aria-label="Gỡ ảnh mới"
                            title="Gỡ ảnh mới này"
                            style={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              width: 28,
                              height: 28,
                              borderRadius: 999,
                              background: "#ef4444",
                              color: "#fff",
                              border: "1px solid rgba(255,255,255,.7)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 2px 8px rgba(0,0,0,.2)",
                            }}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Tuỳ chọn & Biến thể */}
      <div className="pc-card" ref={step2Ref}>
        <div className="pc-section-subtitle" data-tour="step2-title">
          <span className="pc-subtitle-icon">
            <Settings />
          </span>
          <h3>2. Tuỳ chọn & Biến thể</h3>

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={runStep2Tour}
              className="pc-order-mgmt-btn pc-outline pc-btn-sm"
            >
              ❔ Hướng dẫn
            </button>

            <button
              type="button"
              onClick={handleImportTemplate}
              className="pc-order-mgmt-btn pc-outline pc-btn-sm"
              title="Nhập template theo ngành hàng"
            >
              ⭳ Import template
            </button>

            <button
              type="button"
              onClick={restoreFromSnapshot}
              className="pc-order-mgmt-btn pc-ghost pc-btn-sm"
              title="Khôi phục toàn bộ về trạng thái ban đầu"
            >
              <RotateCcw size={16} /> Refresh
            </button>
          </div>
        </div>

        {step2Err && (
          <div className="pc-alert pc-alert-danger">
            <span>{step2Err}</span>
            <button
              className="pc-alert-close"
              onClick={() => setStep2Err("")}
              aria-label="Đóng"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {(orderedOptionDefs || []).map((opt) => {
          const isMediaOption = opt.name === mediaKey;
          const optName = opt.name;
          const optUid = opt.uid;

          return (
            <div
              key={optUid}
              className="pc-option-block"
              draggable
              onDragStart={handleOptionDragStart(optUid)}
              onDragOver={handleOptionDragOver}
              onDrop={handleOptionDrop(optUid)}
              title="Kéo để sắp xếp thứ tự biến thể"
            >
              <div className="pc-option-header pc-open">
                <div className="pc-option-header-left">
                  <div className="pc-option-title">
                    <span className="pc-drag-handle" title="Kéo để sắp xếp">
                      <GripVertical size={16} />
                    </span>
                    {editingOptionUid === optUid ? (
                      <input
                        autoFocus
                        type="text"
                        className="pc-form-input pc-input-compact pc-option-name-input"
                        value={editingNameInput}
                        placeholder="Nhập tên biến thể"
                        onChange={(e) => setEditingNameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitRenameOptionByUid();
                          } else if (e.key === "Escape") {
                            setEditingOptionUid(null);
                            setEditingNameInput("");
                          }
                        }}
                        onBlur={commitRenameOptionByUid}
                      />
                    ) : (
                      <>
                        <span>{optName || "Biến thể"}</span>
                        <button
                          type="button"
                          className="pc-inline-icon-btn"
                          title="Đổi tên biến thể"
                          onClick={() => startRenameOptionByUid(optUid)}
                          aria-label="Đổi tên biến thể"
                        >
                          <Pencil size={16} />
                        </button>
                      </>
                    )}
                  </div>

                  {(!opt.values || opt.values.length === 0) && (
                    <div className="pc-option-empty">Chưa có giá trị</div>
                  )}
                </div>

                {(productData.optionDefs || []).length >= 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(optUid)}
                    title="Xoá biến thể này"
                    className="pc-order-mgmt-btn pc-delete-btn pc-btn-sm"
                    style={{ height: 30 }}
                  >
                    <Minus size={16} />
                  </button>
                )}
              </div>

              <div
                className="pc-option-editor"
                data-tour={isMediaOption ? "value-rows" : undefined}
              >
                {dupWarnings[optName] && (
                  <div className="pc-field-error" style={{ marginBottom: 8 }}>
                    {dupWarnings[optName]}
                  </div>
                )}
                <div className="pc-value-grid">
                  {(opt.values || []).map((v, i) => {
                    const chosen = isMediaOption
                      ? getMediaImageIndexFor(optName, v)
                      : "";
                    const chosenIdx = chosen === "" ? -1 : Number(chosen);
                    const preview =
                      isMediaOption &&
                      Number.isInteger(chosenIdx) &&
                      chosenIdx >= 0
                        ? imgPreviews[chosenIdx]
                        : // nếu ánh xạ tới ảnh cũ (URL), vẫn hiện được
                        isMediaOption &&
                          typeof chosen === "string" &&
                          /^https?:\/\//i.test(chosen)
                        ? { url: chosen, name: chosen.split("/").pop() }
                        : null;

                    return (
                      <div
                        key={`${optUid}-${v}-${i}`}
                        draggable
                        onDragStart={handleValueDragStart(optUid, i)}
                        onDragOver={handleOptionDragOver}
                        onDrop={handleValueDrop(optUid, i)}
                        title="Kéo để sắp xếp thứ tự giá trị"
                      >
                        <ValueCell
                          isMediaOption={isMediaOption}
                          value={v}
                          placeholder="Nhập"
                          imgPreview={preview}
                          onPickImage={(e) => {
                            if (!isMediaOption) return;
                            setPickerBind({
                              optionName: optName,
                              optionValue: v,
                            });
                            setPickerPos({ x: e.clientX, y: e.clientY });
                            setPickerOpen(true);
                          }}
                          onClearMedia={() => clearMediaImageFor(optName, v)}
                          onChange={() => {}}
                          onCommit={(newVal) =>
                            renameOptionValueByName(optName, v, newVal)
                          }
                          onRemove={() => removeOptionValueByName(optName, v)}
                        />
                      </div>
                    );
                  })}

                  {/* Ô rỗng chính */}
                  <ValueCell
                    isMediaOption={isMediaOption}
                    value={optionValueInputs[optName] || ""}
                    placeholder="Nhập"
                    imgPreview={null}
                    onPickImage={() => {}}
                    onClearMedia={() => {}}
                    onChange={(val) =>
                      setOptionValueInputs((p) => ({
                        ...p,
                        [optName]: (val || "").slice(
                          0,
                          OPTION_VALUE_CHAR_LIMIT
                        ),
                      }))
                    }
                    onCommit={() => addOptionValueFromInputByName(optName)}
                    onRemove={() =>
                      setOptionValueInputs((p) => ({ ...p, [optName]: "" }))
                    }
                  />

                  {(optionValueInputs[optName] || "").length > 0 && (
                    <ValueCell
                      isMediaOption={isMediaOption}
                      value=""
                      placeholder="Nhập"
                      imgPreview={null}
                      onPickImage={() => {}}
                      onClearMedia={() => {}}
                      onChange={(val) =>
                        setOptionValueInputs((p) => ({
                          ...p,
                          [optName]: (val || "").slice(
                            0,
                            OPTION_VALUE_CHAR_LIMIT
                          ),
                        }))
                      }
                      onCommit={() => addOptionValueFromInputByName(optName)}
                      onRemove={() => {}}
                      readOnly
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {(productData.optionDefs || []).length < MAX_OPTIONS && (
          <div
            style={{ marginTop: 8, display: "flex", justifyContent: "center" }}
          >
            <button
              type="button"
              onClick={handleAddOption}
              className="pc-order-mgmt-btn pc-outline pc-btn-sm"
            >
              <Plus size={18} /> Thêm biến thể
            </button>
          </div>
        )}

        {/* Bulk set panel (y chang Create) */}
        <div className="pc-bulk-card">
          <div className="pc-bulk-row">
            <input
              type="text"
              className="pc-form-input pc-input-compact pc-bulk-input"
              placeholder="Giá*"
              value={bulkAll.price}
              onChange={(e) =>
                setBulkAll((p) => ({
                  ...p,
                  price: formatWithComma(e.target.value),
                }))
              }
            />
            <input
              type="text"
              className="pc-form-input pc-input-compact pc-bulk-input"
              placeholder="Giá so sánh"
              value={bulkAll.compare}
              onChange={(e) =>
                setBulkAll((p) => ({
                  ...p,
                  compare: formatWithComma(e.target.value),
                }))
              }
            />
            <input
              type="text"
              className="pc-form-input pc-input-compact pc-bulk-input"
              placeholder="SL"
              value={bulkAll.qty}
              onChange={(e) =>
                setBulkAll((p) => ({
                  ...p,
                  qty: formatWithComma(e.target.value),
                }))
              }
            />

            <button
              type="button"
              onClick={applyBulkToAll}
              className="btnfos btnfos-3 pc-apply-btn"
              title="Áp dụng cho tất cả tổ hợp"
            >
              <span>Áp dụng</span>
            </button>
          </div>
        </div>

        {/* Bảng tổ hợp */}
        <div className="pc-variants-table-wrap" style={{ marginTop: 14 }}>
          {!(productData.variants || []).length ? (
            <div className="pc-empty">
              Hãy thêm giá trị biến thể để sinh tổ hợp.
            </div>
          ) : (
            <table className="pc-variants-table">
              <thead>
                <tr>
                  <th>{option1 || "Tuỳ chọn"}</th>
                  {hasTwoOptions && <th>{option2}</th>}
                  <th>* Giá</th>
                  <th>Giá so sánh</th>
                  <th>SL</th>
                </tr>
              </thead>
              <tbody>
                {!hasTwoOptions
                  ? (values1 || []).map((val1, j) => {
                      const variantIdx = findVariantIndex(val1, null);
                      const v = (productData.variants || [])[variantIdx] || {};
                      const chosen = getMediaImageIndexFor(option1, val1);
                      const chosenIdx = chosen === "" ? -1 : Number(chosen);
                      const preview =
                        Number.isInteger(chosenIdx) && chosenIdx >= 0
                          ? imgPreviews[chosenIdx]
                          : typeof chosen === "string" &&
                            /^https?:\/\//i.test(chosen)
                          ? { url: chosen, name: chosen.split("/").pop() }
                          : null;

                      return (
                        <tr key={`${val1}-${j}`}>
                          <td className="pc-cell-primary">
                            <div className="pc-primary-wrap pc-primary-stack">
                              <div className="pc-primary-name">{val1}</div>
                              <div className="pc-primary-thumb-wrap">
                                <button
                                  type="button"
                                  className="pc-thumb-pick pc-thumb-pick--inline"
                                  title="Chọn ảnh cho nhóm này"
                                  onClick={(e) => {
                                    setPickerBind({
                                      optionName: option1,
                                      optionValue: val1,
                                    });
                                    setPickerPos({
                                      x: e.clientX,
                                      y: e.clientY,
                                    });
                                    setPickerOpen(true);
                                  }}
                                >
                                  {preview?.url ? (
                                    <>
                                      <img
                                        src={preview.url}
                                        alt={preview.name || "preview"}
                                      />
                                      <button
                                        type="button"
                                        className="pc-thumb-close"
                                        title="Xoá gán ảnh"
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          clearMediaImageFor(option1, val1);
                                        }}
                                      >
                                        <X size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <div className="pc-thumb-placeholder">
                                      <ImageIcon size={16} />
                                      <span>Chọn ảnh</span>
                                    </div>
                                  )}
                                </button>
                              </div>
                            </div>
                          </td>

                          <td className="pc-tight">
                            <input
                              type="text"
                              className="pc-form-input pc-input-compact"
                              value={
                                v.price
                                  ? String(v.price).replace(
                                      /\B(?=(\d{3})+(?!\d))/g,
                                      ","
                                    )
                                  : ""
                              }
                              onChange={(e) =>
                                setProductData((prev) => {
                                  const vts = [...(prev.variants || [])];
                                  vts[variantIdx].price =
                                    Number(
                                      String(e.target.value || "").replace(
                                        /[^\d]/g,
                                        ""
                                      )
                                    ) || 0;
                                  return { ...prev, variants: vts };
                                })
                              }
                              placeholder="VD: 379000"
                            />
                          </td>

                          <td className="pc-tight">
                            <input
                              type="text"
                              className="pc-form-input pc-input-compact"
                              value={
                                v.compareAtPrice
                                  ? String(v.compareAtPrice).replace(
                                      /\B(?=(\d{3})+(?!\d))/g,
                                      ","
                                    )
                                  : ""
                              }
                              onChange={(e) =>
                                setProductData((prev) => {
                                  const vts = [...(prev.variants || [])];
                                  vts[variantIdx].compareAtPrice =
                                    Number(
                                      String(e.target.value || "").replace(
                                        /[^\d]/g,
                                        ""
                                      )
                                    ) || 0;
                                  return { ...prev, variants: vts };
                                })
                              }
                              placeholder="VD: 399000"
                            />
                          </td>

                          <td className="pc-tight">
                            <input
                              type="number"
                              min={0}
                              className="pc-form-input pc-input-compact"
                              value={v.quantity ?? 0}
                              onChange={(e) =>
                                setProductData((prev) => {
                                  const vts = [...(prev.variants || [])];
                                  vts[variantIdx].quantity =
                                    Number(
                                      String(e.target.value ?? "").replace(
                                        /\D/g,
                                        ""
                                      )
                                    ) || 0;
                                  return { ...prev, variants: vts };
                                })
                              }
                              placeholder="1000"
                            />
                          </td>
                        </tr>
                      );
                    })
                  : (values1 || []).flatMap((val1) => {
                      const rowCount = (values2 || []).length;
                      return (values2 || []).map((val2, j) => {
                        const variantIdx = findVariantIndex(val1, val2);
                        const v =
                          (productData.variants || [])[variantIdx] || {};
                        const chosen = getMediaImageIndexFor(option1, val1);
                        const chosenIdx = chosen === "" ? -1 : Number(chosen);
                        const preview =
                          Number.isInteger(chosenIdx) && chosenIdx >= 0
                            ? imgPreviews[chosenIdx]
                            : typeof chosen === "string" &&
                              /^https?:\/\//i.test(chosen)
                            ? { url: chosen, name: chosen.split("/").pop() }
                            : null;

                        return (
                          <tr key={`${val1}-${val2}-${j}`}>
                            {j === 0 && (
                              <td
                                rowSpan={rowCount}
                                className="pc-cell-primary"
                              >
                                <div className="pc-primary-wrap pc-primary-stack">
                                  <div className="pc-primary-name">{val1}</div>
                                  <div className="pc-primary-thumb-wrap">
                                    <button
                                      type="button"
                                      className="pc-thumb-pick pc-thumb-pick--inline"
                                      title="Chọn ảnh cho nhóm này"
                                      onClick={(e) => {
                                        setPickerBind({
                                          optionName: option1,
                                          optionValue: val1,
                                        });
                                        setPickerPos({
                                          x: e.clientX,
                                          y: e.clientY,
                                        });
                                        setPickerOpen(true);
                                      }}
                                    >
                                      {preview?.url ? (
                                        <>
                                          <img
                                            src={preview.url}
                                            alt={preview.name || "preview"}
                                          />
                                          <button
                                            type="button"
                                            className="pc-thumb-close"
                                            title="Xoá gán ảnh"
                                            onClick={(ev) => {
                                              ev.stopPropagation();
                                              clearMediaImageFor(option1, val1);
                                            }}
                                          >
                                            <X size={14} />
                                          </button>
                                        </>
                                      ) : (
                                        <div className="pc-thumb-placeholder">
                                          <ImageIcon size={16} />
                                          <span>Chọn ảnh</span>
                                        </div>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </td>
                            )}

                            <td className="pc-tight">
                              <span className="pc-badge">{val2}</span>
                            </td>

                            <td className="pc-tight">
                              <input
                                type="text"
                                className="pc-form-input pc-input-compact"
                                value={
                                  v.price
                                    ? String(v.price).replace(
                                        /\B(?=(\d{3})+(?!\d))/g,
                                        ","
                                      )
                                    : ""
                                }
                                onChange={(e) =>
                                  setProductData((prev) => {
                                    const vts = [...(prev.variants || [])];
                                    vts[variantIdx].price =
                                      Number(
                                        String(e.target.value || "").replace(
                                          /[^\d]/g,
                                          ""
                                        )
                                      ) || 0;
                                    return { ...prev, variants: vts };
                                  })
                                }
                                placeholder="VD: 379000"
                              />
                            </td>

                            <td className="pc-tight">
                              <input
                                type="text"
                                className="pc-form-input pc-input-compact"
                                value={
                                  v.compareAtPrice
                                    ? String(v.compareAtPrice).replace(
                                        /\B(?=(\d{3})+(?!\d))/g,
                                        ","
                                      )
                                    : ""
                                }
                                onChange={(e) =>
                                  setProductData((prev) => {
                                    const vts = [...(prev.variants || [])];
                                    vts[variantIdx].compareAtPrice =
                                      Number(
                                        String(e.target.value || "").replace(
                                          /[^\d]/g,
                                          ""
                                        )
                                      ) || 0;
                                    return { ...prev, variants: vts };
                                  })
                                }
                                placeholder="VD: 399000"
                              />
                            </td>

                            <td className="pc-tight">
                              <input
                                type="number"
                                min={0}
                                className="pc-form-input pc-input-compact"
                                value={v.quantity ?? 0}
                                onChange={(e) =>
                                  setProductData((prev) => {
                                    const vts = [...(prev.variants || [])];
                                    vts[variantIdx].quantity =
                                      Number(
                                        String(e.target.value ?? "").replace(
                                          /\D/g,
                                          ""
                                        )
                                      ) || 0;
                                    return { ...prev, variants: vts };
                                  })
                                }
                                placeholder="1000"
                              />
                            </td>
                          </tr>
                        );
                      });
                    })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 3. Xác nhận & Lưu / Gửi duyệt lại */}
      <div className="pc-card">
        <div className="pc-section-subtitle">
          <span className="pc-subtitle-icon">
            <CheckCircle />
          </span>
          <h3>3. Xác nhận & Lưu</h3>
        </div>

        <div className="pc-summary-card">
          <div className="pc-summary-header">
            <span className="pc-summary-icon">📦</span>
            <h4>Tóm tắt sản phẩm</h4>
          </div>
          <div className="pc-summary-content">
            <div className="pc-summary-item">
              <span className="pc-summary-label">Tên</span>
              <span className="pc-summary-value">
                {productData.name || "—"}
              </span>
            </div>
            <div className="pc-summary-item">
              <span className="pc-summary-label">Danh mục</span>
              <span className="pc-summary-value">
                {labelCategoryVN(
                  findCategoryById(productData.categoryId)?.name
                ) || "—"}
              </span>
            </div>
            <div className="pc-summary-item">
              <span className="pc-summary-label">Ảnh (sau cập nhật)</span>
              <span className="pc-summary-value">
                {oldImages.filter((_, i) => !markedRemoveOld.has(i)).length +
                  (productData.images || []).length}
                /{MAX_IMAGES}
              </span>
            </div>
            <div className="pc-summary-item">
              <span className="pc-summary-label">Biến thể</span>
              <span className="pc-summary-value">
                {(productData.variants || []).length}
              </span>
            </div>
          </div>
        </div>

        <div
          className="pc-submit-section"
          style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
        >
          <button
            onClick={() => window.history.back()}
            className="pc-order-mgmt-btn pc-ghost pc-btn-sm"
            disabled={submitting}
          >
            <X size={16} /> Hủy
          </button>

          {reRegisterMode ? (
            <button
              onClick={handleSubmitReRegister}
              className={`pc-order-mgmt-btn pc-confirm-bulk${
                submitting || !step1Valid ? " pc-disabled" : ""
              }`}
              disabled={submitting || !step1Valid}
              title={
                !step1Valid
                  ? "Vui lòng điền Danh mục & Tên sản phẩm"
                  : "Gửi duyệt lại cho Admin"
              }
            >
              <Send /> {submitting ? "Đang gửi..." : "Gửi duyệt lại"}
            </button>
          ) : (
            <button
              onClick={handleSubmitUpdate}
              className={`pc-order-mgmt-btn pc-confirm-bulk${
                submitting || !step1Valid ? " pc-disabled" : ""
              }`}
              disabled={submitting || !step1Valid}
              title={!step1Valid ? "Vui lòng điền Danh mục & Tên sản phẩm" : ""}
            >
              <Upload /> {submitting ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          )}
        </div>
      </div>

      {/* Modal chọn ảnh (dùng bộ ảnh mới) */}
      <ImagePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        items={pickerItems}
        onPick={(item) => {
          if (pickerBind?.optionName && pickerBind?.optionValue != null) {
            // item.imageValue: "0","1"... (ảnh mới) hoặc URL (ảnh cũ)
            setMediaImageFor(
              pickerBind.optionName,
              pickerBind.optionValue,
              item.imageValue
            );
          }
        }}
      />
    </div>
  );
}
