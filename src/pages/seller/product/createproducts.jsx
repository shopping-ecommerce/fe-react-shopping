// src/pages/seller/products/CreateProductPage.jsx
import React, { useState, useEffect, useContext, useMemo, useRef } from "react";
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
  Pencil,
  GripVertical,
} from "lucide-react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import "../../../styles/ProductCreation.css";
import { fetchCategories, createProduct } from "../../../services/products";
import { API_CONFIG, apiUrl } from "../../../config/api";
import { AuthContext } from "../../../contexts/AuthContext";
import { showToast } from "../../../utils/toast";
import Portal from "../product/Portal";
import { useSellerId } from "../../../hook/useSellerId";
import { useParams } from "react-router-dom";
import TiptapEditor from "../../../components/tiptap/TiptapEditor";
import { CreateMLCEngine, prebuiltAppConfig } from "@mlc-ai/web-llm";
import { cleanEditorHtml } from "../../../utils/html";

/* ===== Helpers ===== */
const genUid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `uid_${Math.random().toString(36).slice(2)}_${Date.now()}`;

/* ===== Local draft key ===== */
const DRAFT_KEY = "create_product_draft_v2";

/* ===== Category VN mapping ===== */
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

/* ===== BASELINE TEMPLATE ===== */
const BASELINE_TEMPLATE = [
  { uid: genUid(), name: "Màu sắc", values: ["Đen", "Trắng"] },
  { uid: genUid(), name: "Kích cỡ", values: ["M", "L"] },
];

/* ===== DEFAULT TEMPLATES ===== */
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

/* ===== Image rules ===== */
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

// ✅ THÊM: kích thước tối thiểu
const MIN_IMG_W = 800;
const MIN_IMG_H = 800;

/* ===== Option/Variant rules ===== */
const MAX_NAME_WORDS = 20;
const MAX_WORD_LEN = 10;
const MAX_OPTIONS = 2; // chỉ tối đa 2 biến thể
const OPTION_VALUE_CHAR_LIMIT = 20;

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

/* ===== Tour key ===== */
const STEP2_TOUR_SEEN_KEY = "create_product_step2_tour_seen_v2";

/* ===== Utils ===== */
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

/* === Helpers ảnh: File <-> dataURL để lưu nháp === */
const fileToDataURL = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

const dataURLtoFile = (dataUrl, fallbackName = "image.jpg") => {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bstr = atob(arr[1] || "");
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  const ext = mime.includes("png") ? "png" : "jpg";
  return new File(
    [u8arr],
    fallbackName.endsWith(`.${ext}`) ? fallbackName : `${fallbackName}.${ext}`,
    { type: mime }
  );
};

const formatWithComma = (s) => {
  const digits = String(s || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// ✅ THÊM: đọc kích thước ảnh trước khi nhận file
const readImageDimensions = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      URL.revokeObjectURL(url);
      resolve({ width: w, height: h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });

/* ===== Modal chọn ảnh ===== */
function ImagePickerModal({ open, onClose, images, previews, onPick }) {
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

          {images?.length ? (
            <div className="pc-modal-grid">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className="pc-modal-thumb"
                  onClick={() => {
                    onPick(i);
                    onClose();
                  }}
                  title={`Chọn ảnh #${i + 1}`}
                >
                  <img
                    src={previews[i]?.url}
                    alt={previews[i]?.name || "img"}
                  />
                  <div className="pc-modal-thumb-name">{previews[i]?.name}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="pc-empty">Chưa có ảnh. Hãy tải ảnh ở Bước 1.</div>
          )}
        </div>
      </div>
    </Portal>
  );
}

/* ===== 1 cell giá trị ===== */
const ValueCell = ({
  isMediaOption,
  value,
  placeholder,
  imgPreview,
  onPickImage,
  onClearMedia,
  onChange, // giữ nguyên prop để ô rỗng dùng
  onCommit, // <-- SẼ GỌI onCommit(draft)
  onRemove,
  readOnly = false,
}) => {
  const [draft, setDraft] = React.useState(value ?? "");

  // Đồng bộ khi prop value đổi (ví dụ rename từ bên ngoài)
  React.useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

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
            if (readOnly) return; // ô phụ hiển thị mờ thì không nhập
            setDraft(next); // <-- chỉ cập nhật local, KHÔNG rename ngay
            onChange?.(next); // để ô rỗng vẫn dùng được
          }}
          onBlur={() => onCommit?.(draft)} // <-- commit khi blur
          onKeyDown={handleKeyDown} // <-- commit khi Enter
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

export default function CreateProductPage() {
  // === AI (WebLLM) state ===
  const [llm, setLlm] = useState(null); // engine
  const [aiBusy, setAiBusy] = useState(false);
  const [aiInit, setAiInit] = useState(false);
  const [aiProgress, setAiProgress] = useState(0); // 0..100
  const [aiErr, setAiErr] = useState("");
  const descrEditorRef = useRef(null); // ref tới TiptapEditor

  const { authFetch } = useContext(AuthContext) || {};
  const params = useParams();
  const {
    sellerId,
    loading: sellerLoading,
    error: sellerErr,
  } = useSellerId(authFetch, {
    sellerIdFromUrl: params?.sellerId, // nếu route có /seller/:sellerId/create
  });
  const [submitting, setSubmitting] = useState(false);

  // Categories
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catErr, setCatErr] = useState("");

  const [bulkAll, setBulkAll] = useState({ price: "", compare: "", qty: "" });

  // Product form
  const [productData, setProductData] = useState({
    name: "",
    categoryId: "",
    description: "",
    images: [], // File[]
    optionDefs: BASELINE_TEMPLATE.map((o) => ({ ...o })),
    variants: [],
    mediaByOption: [],
  });

  // Ảnh base64 để lưu nháp
  const [imagesB64, setImagesB64] = useState([]);

  // Errors/UI state
  const [nameErr, setNameErr] = useState("");
  const [step2Err, setStep2Err] = useState("");
  const step2Ref = useRef(null);

  // Duplicate warnings theo từng option name
  const [dupWarnings, setDupWarnings] = useState({}); // { [optName]: "msg" }

  // Modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerBind, setPickerBind] = useState(null);
  const [pickerPos, setPickerPos] = useState(null);

  // Baseline
  const baselineRef = useRef(BASELINE_TEMPLATE.map((o) => ({ ...o })));

  // Media key (theo tên)
  const pickMediaKey = (opts) => {
    const colorOpt =
      (opts || []).find((o) => isColorName(o.name || "")) || (opts || [])[0];
    return colorOpt?.name || "";
  };
  const [mediaKey, setMediaKey] = useState(
    pickMediaKey(productData.optionDefs)
  );

  // Previews
  const [imgPreviews, setImgPreviews] = useState([]);
  const [flaggedIdxSet, setFlaggedIdxSet] = useState(new Set());
  const [flaggedMsgs, setFlaggedMsgs] = useState({});
  const [rejectedFiles, setRejectedFiles] = useState([]);

  // input rỗng theo optName
  const [optionValueInputs, setOptionValueInputs] = useState({});

  // rename option name state
  const [editingOptionUid, setEditingOptionUid] = useState(null);
  const [editingNameInput, setEditingNameInput] = useState("");

  // Drag state
  const dragOptionUidRef = useRef(null);
  const dragValueRef = useRef(null); // { optUid, index }

  // Bulk set
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkCompareAt, setBulkCompareAt] = useState("");
  const [bulkQty, setBulkQty] = useState("");

  /* ===== Fetch categories ===== */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setCatLoading(true);
      setCatErr("");
      try {
        const list = await fetchCategories(authFetch);
        if (mounted) setCategories(list);
      } catch (e) {
        if (mounted) setCatErr(e.message || "Không tải được danh mục");
      } finally {
        if (mounted) setCatLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authFetch]);

  const findCategoryById = (id) => categories.find((c) => c.id === id);
  const getCategoryEnName = (id) => findCategoryById(id)?.name || "";

  /* ===== Khi đổi danh mục ===== */
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

  useEffect(() => {
    if (!productData.categoryId) return;
    const nextOpts = buildOptionDefsFromCat(productData.categoryId);
    setProductData((prev) => ({
      ...prev,
      optionDefs: nextOpts,
      mediaByOption: [],
    }));
    setOptionValueInputs({});
    setDupWarnings({});
    setFlaggedIdxSet(new Set());
    setFlaggedMsgs({});
    setMediaKey(pickMediaKey(nextOpts));
  }, [productData.categoryId, categories.length]);

  useEffect(() => {
    setMediaKey(pickMediaKey(productData.optionDefs));
  }, [productData.optionDefs]);

  /* ======= REBUILD VARIANTS (giữ tối đa dữ liệu cũ) ======= */
  const rebuildVariantsFromOptionDefs = (nextOptionDefs, prevVariants) => {
    const active = (nextOptionDefs || []).filter(
      (o) => o.name && (o.values || []).length
    );
    if (!active.length) return [];
    const names = active.map((o) => o.name);
    const combos = cartesian(active.map((o) => o.values));

    const byKey = new Map(
      (prevVariants || []).map((v) => [
        JSON.stringify(v.options || {}),
        { ...v },
      ])
    );

    return combos.map((arr) => {
      const options = {};
      names.forEach((n, i) => (options[n] = arr[i]));
      const key = JSON.stringify(options);
      const old = byKey.get(key);
      return {
        options,
        price: old ? old.price : 0,
        compareAtPrice: old ? old.compareAtPrice : 0,
        quantity: old ? old.quantity : 0,
        available: old ? !!old.available : true,
      };
    });
  };

  /* ===== Biến thể tự rebuild khi optionDefs đổi ===== */
  useEffect(() => {
    const next = rebuildVariantsFromOptionDefs(
      productData.optionDefs,
      productData.variants
    );
    setProductData((prev) => ({ ...prev, variants: next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productData.optionDefs]);

  /* ===== Helpers ===== */
  const step1Valid = !!(
    productData.name.trim() && productData.categoryId.trim()
  );

  // (tuỳ chọn) đặt biến cho gọn, ngay trước return
  const createBtnDisabled = submitting || !step1Valid;
  const createBtnTitle = !step1Valid
    ? "Vui lòng điền Danh mục & Tên sản phẩm"
    : "";

  const handleInputChange = (field, value) => {
    if (field === "name") {
      setProductData((prev) => ({ ...prev, name: value }));
      const bad = findTooLongWord(value);
      setNameErr(bad ? `Từ “${bad}” dài hơn ${MAX_WORD_LEN} ký tự` : "");
      return;
    }
    setProductData((prev) => ({ ...prev, [field]: value }));
  };

  /* ====== Giá trị biến thể ====== */
  const addOptionValueFromInputByName = (optName) => {
    const raw = (optionValueInputs[optName] || "")
      .slice(0, OPTION_VALUE_CHAR_LIMIT)
      .trim();
    if (!raw) return;
    const lower = raw.toLowerCase();

    const idx = productData.optionDefs.findIndex((o) => o.name === optName);
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
    const idx = productData.optionDefs.findIndex((o) => o.name === optName);
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
    opts[idx] = { ...opts[idx], values: replaced };

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
    setDupWarnings((w) => ({ ...w, [optName]: "" }));
  };

  const removeOptionValueByName = (optName, value) => {
    const idx = productData.optionDefs.findIndex((o) => o.name === optName);
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

  // ===== Đổi tên biến thể (option name) — theo UID =====
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

  /* ===== Variants (tổ hợp) memo để render ===== */
  const combinations = useMemo(() => {
    const active = (productData.optionDefs || []).filter(
      (o) => o.name && (o.values || []).length
    );
    if (!active.length) return [];
    const names = active.map((o) => o.name);
    const combos = cartesian(active.map((o) => o.values));
    return combos.map((arr) => {
      const obj = {};
      names.forEach((n, i) => (obj[n] = arr[i]));
      return obj;
    });
  }, [productData.optionDefs]);

  const updateVariantField = (rowIdx, field, value) => {
    const vts = [...productData.variants];
    if (field === "price" || field === "compareAtPrice") {
      vts[rowIdx][field] =
        Number(String(value || "").replace(/[^\d]/g, "")) || 0;
    } else if (field === "quantity") {
      vts[rowIdx][field] = Number(String(value ?? "").replace(/\D/g, "")) || 0;
    } else if (field === "available") {
      vts[rowIdx][field] = !!value;
    }
    setProductData((prev) => ({ ...prev, variants: vts }));
  };

  /* ===== Ảnh ===== */
  useEffect(() => {
    return () => {
      imgPreviews.forEach((p) => p?.url && URL.revokeObjectURL(p.url));
    };
  }, [imgPreviews]);

  const handleImagesUpload = async (e) => {
    const incoming = Array.from(e.target.files || []);
    if (!incoming.length) return;

    setRejectedFiles([]);
    setFlaggedIdxSet(new Set());
    setFlaggedMsgs({});

    if (productData.images.length >= MAX_IMAGES) {
      alert(`Đã đủ tối đa ${MAX_IMAGES} ảnh.`);
      return;
    }
    const remaining = MAX_IMAGES - productData.images.length;

    const valid = [];
    const invalidNames = [];

    // Lọc theo định dạng + dung lượng trước
    for (const f of incoming) {
      if (valid.length >= remaining) {
        invalidNames.push(`${f.name} (vượt quá số lượng tối đa ${MAX_IMAGES})`);
        continue;
      }
      const extOk = ALLOWED_EXT.includes(getExt(f.name));
      const mimeOk = ALLOWED_MIME.includes(f.type);
      if (!(mimeOk || (!f.type && extOk))) {
        invalidNames.push(`${f.name} (định dạng không hỗ trợ)`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        invalidNames.push(
          `${f.name} (> ${Math.round(MAX_FILE_SIZE / 1024)}KB)`
        );
        continue;
      }
      valid.push(f);
    }

    // ✅ Kiểm tra kích thước tối thiểu 800×800
    const accepted = [];
    for (const f of valid) {
      const { width, height } = await readImageDimensions(f);
      if (width >= MIN_IMG_W && height >= MIN_IMG_H) {
        accepted.push(f);
      } else {
        invalidNames.push(
          `${f.name} (quá nhỏ: ${width}×${height}px, cần ≥ ${MIN_IMG_W}×${MIN_IMG_H}px)`
        );
      }
    }

    if (accepted.length) {
      const previews = accepted.map((f) => ({
        url: URL.createObjectURL(f),
        name: f.name,
        size: f.size,
        type: f.type,
      }));
      const b64s = await Promise.all(accepted.map((f) => fileToDataURL(f)));

      setProductData((prev) => ({
        ...prev,
        images: [...prev.images, ...accepted],
      }));
      setImgPreviews((prev) => [...prev, ...previews]);
      setImagesB64((prev) => [...prev, ...b64s]);
    }

    if (invalidNames.length) {
      setRejectedFiles(invalidNames);
      showToast?.({
        title: "Một số ảnh không hợp lệ",
        text: "Có ảnh bị từ chối do kích thước/định dạng/dung lượng.",
        type: "warning",
      });
    }
  };

  const removeImageAt = (idx) => {
    setProductData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
      mediaByOption: (prev.mediaByOption || [])
        .filter((m) => String(m.image) !== String(idx))
        .map((m) => {
          const old = Number(m.image);
          return { ...m, image: String(old > idx ? old - 1 : old) };
        }),
    }));
    setImgPreviews((prev) => {
      const cp = [...prev];
      const removed = cp.splice(idx, 1)[0];
      if (removed?.url) URL.revokeObjectURL(removed.url);
      return cp;
    });
    setImagesB64((prev) => {
      const cp = [...prev];
      cp.splice(idx, 1);
      return cp;
    });
    setFlaggedIdxSet((prev) => {
      const n = new Set(prev);
      n.delete(idx);
      return new Set(Array.from(n).map((i) => (i > idx ? i - 1 : i)));
    });
    setFlaggedMsgs((prev) => {
      const n = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        if (i === idx) return;
        n[i > idx ? i - 1 : i] = v;
      });
      return n;
    });
  };

  /* ===== Media map ===== */
  const setMediaImageFor = (optName, optValue, imgIndexStr) => {
    const list = [...(productData.mediaByOption || [])];
    const idx = list.findIndex(
      (m) => m.optionName === optName && m.optionValue === optValue
    );
    const item = {
      optionName: optName,
      optionValue: optValue,
      image: String(imgIndexStr),
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

  /* ===== Submit ===== */
  const VALIDATE_ENDPOINT =
    API_CONFIG?.endpoints?.fileValidateMany || "/file/s3/validate-many";

  const validateBeforeSubmit = () => {
    if (!sellerId) return alert("Không tìm thấy Seller ID."), false;
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
    if (productData.images.length === 0)
      return alert("Vui lòng chọn ít nhất 1 ảnh."), false;
    if (productData.images.length > MAX_IMAGES)
      return alert(`Tối đa ${MAX_IMAGES} ảnh.`), false;
    return true;
  };

  const serverValidateImages = async () => {
    const formData = new FormData();
    productData.images.forEach((f) => formData.append("files", f, f.name));
    const res = await authFetch(apiUrl(VALIDATE_ENDPOINT), {
      method: "POST",
      body: formData,
    });
    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { message: text };
    }
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json;
  };

  const scrollToStep2 = () => {
    try {
      step2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {}
  };

  const handleSubmitForReview = async () => {
    if (!validateBeforeSubmit()) return;

    const hasAnyPrice = (productData.variants || []).some(
      (v) => Number(v.price) > 0
    );
    if (!hasAnyPrice) {
      setStep2Err(
        "Vui lòng nhập giá cho ít nhất 1 biến thể trước khi tạo sản phẩm."
      );
      scrollToStep2();
      return;
    }

    try {
      setSubmitting(true);
      const val = await serverValidateImages();
      const list = Array.isArray(val?.result) ? val.result : [];
      const bad = list.filter((it) => it && it.passed === false);
      if (bad.length > 0) {
        const idxSet = new Set();
        const msgMap = {};
        bad.forEach((b) => {
          const i = Number(b.index);
          if (Number.isInteger(i) && i >= 0 && i < productData.images.length) {
            idxSet.add(i);
            msgMap[i] = b.reason || "Ảnh chứa nội dung không phù hợp.";
          }
        });
        setFlaggedIdxSet(idxSet);
        setFlaggedMsgs(msgMap);
        setSubmitting(false);
        return;
      }
    } catch (err) {
      alert(
        "Không thể kiểm duyệt ảnh tự động: " +
          (err?.message || "Lỗi không xác định")
      );
      setSubmitting(false);
      return;
    }

    const payload = {
      sellerId,
      name: sanitizeName(productData.name),
      description: cleanEditorHtml(productData.description),
      status: "AVAILABLE",
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
        (m) => m.optionName && m.optionValue && m.image != null
      ),
    };

    try {
      await createProduct(authFetch, payload, productData.images);

      showToast?.({
        title: "Tạo sản phẩm",
        text: "Tạo sản phẩm thành công!",
        type: "success",
        duration: 2600,
      });

      localStorage.removeItem(DRAFT_KEY);

      imgPreviews.forEach((p) => p?.url && URL.revokeObjectURL(p.url));
      setImgPreviews([]);
      setImagesB64([]);
      setProductData({
        name: "",
        categoryId: "",
        description: "",
        images: [],
        optionDefs: baselineRef.current.map((o) => ({
          uid: o.uid || genUid(),
          name: o.name,
          values: [...o.values],
        })),
        variants: [],
        mediaByOption: [],
      });
      setOptionValueInputs({});
      setDupWarnings({});
      setFlaggedIdxSet(new Set());
      setFlaggedMsgs({});
      setRejectedFiles([]);
      setMediaKey(pickMediaKey(baselineRef.current));
      setStep2Err("");
      setNameErr("");
    } catch (e) {
      alert("Tạo sản phẩm thất bại: " + (e?.message || "Lỗi không xác định"));
    } finally {
      setSubmitting(false);
    }
  };

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
  const handleManualGuide = () => {
    localStorage.setItem(STEP2_TOUR_SEEN_KEY, "true");
    runStep2Tour();
  };

  /* ===== Re-order optionDefs: mediaKey lên trước (chỉ sắp xếp hiển thị) ===== */
  const orderedOptionDefs = useMemo(() => {
    const src = productData.optionDefs || [];
    // Không ép mediaKey lên đầu nữa khi đã drag & drop — chỉ giữ nguyên thứ tự người dùng
    return src;
  }, [productData.optionDefs]);

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
  const handleValueDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
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

  /* ====== Handlers: Thêm/Xoá biến thể (option) ====== */

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

      const rebuilt = rebuildVariantsFromOptionDefs(next, prev.variants);
      const nextInputs = { ...optionValueInputs };
      if (
        toRemove.name &&
        Object.prototype.hasOwnProperty.call(nextInputs, toRemove.name)
      ) {
        delete nextInputs[toRemove.name];
      }
      setOptionValueInputs(nextInputs);
      setMediaKey(pickMediaKey(next));

      if (editingOptionUid === uid) {
        setEditingOptionUid(null);
        setEditingNameInput("");
      }

      return {
        ...prev,
        optionDefs: next,
        mediaByOption: nextMedia,
        variants: rebuilt,
      };
    });
  };

  /* ===== Bulk set for all variants ===== */
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

  /* ===== Render helpers ===== */
  const opt1 = orderedOptionDefs?.[0];
  const opt2 = orderedOptionDefs?.[1];
  const option1 = opt1?.name || "";
  const option2 = opt2?.name || "";
  const values1 = opt1?.values || [];
  const values2 = opt2?.values || [];
  const hasTwoOptions = Boolean(option1 && option2 && values2.length > 0);

  const findVariantIndex = (o1, o2) =>
    productData.variants.findIndex((v) => {
      const a = v.options || {};
      if (hasTwoOptions) {
        return a[option1] === o1 && a[option2] === o2;
      }
      return a[option1] === o1;
    });

  /* ===== Khôi phục nháp khi vào trang ===== */
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (!saved) return;
      const {
        productData: pd = {},
        imagesB64: b64s = [],
        nameErr: nerr = "",
        step2Err: sErr = "",
      } = saved;

      (async () => {
        const files = await Promise.all(
          (b64s || []).map((d, i) => dataURLtoFile(d, `draft_${i + 1}.jpg`))
        );
        const previews = files.map((f) => ({
          url: URL.createObjectURL(f),
          name: f.name,
          size: f.size,
          type: f.type,
        }));

        const restoredOptionDefs = Array.isArray(pd.optionDefs)
          ? pd.optionDefs.map((o) => ({
              uid: o.uid || genUid(),
              name: o.name,
              values: Array.isArray(o.values) ? o.values : [],
            }))
          : BASELINE_TEMPLATE.map((o) => ({ ...o }));

        setProductData({
          name: pd.name || "",
          categoryId: pd.categoryId || "",
          description: pd.description || "",
          images: files,
          optionDefs: restoredOptionDefs,
          variants: Array.isArray(pd.variants) ? pd.variants : [],
          mediaByOption: Array.isArray(pd.mediaByOption)
            ? pd.mediaByOption
            : [],
        });
        setImgPreviews(previews);
        setImagesB64(b64s || []);
        setNameErr(nerr || "");
        setStep2Err(sErr || "");
        setMediaKey(pickMediaKey(restoredOptionDefs || []));
      })();
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===== Auto save nháp ===== */
  const saveDraft = useRef(null);
  useEffect(() => {
    if (saveDraft.current) clearTimeout(saveDraft.current);
    saveDraft.current = setTimeout(() => {
      try {
        const { images, ...restPd } = productData;
        const payload = {
          productData: restPd,
          imagesB64,
          nameErr,
          step2Err,
          ts: Date.now(),
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      } catch {}
    }, 400);
    return () => clearTimeout(saveDraft.current);
  }, [productData, imagesB64, nameErr, step2Err]);

  useEffect(() => {
    let mounted = true;

    const CANDIDATES = [
      "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
      "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    ];

    const pickFirstAvailable = () => {
      const availableModels = prebuiltAppConfig?.model_list || [];

      if (availableModels.length === 0) {
        setAiErr(
          "Không có model nào được cài đặt. Vui lòng kiểm tra cấu hình @mlc-ai/web-llm."
        );
        return;
      }

      const ids = new Set(availableModels.map((m) => m.model_id));

      console.log("📦 Available models:", Array.from(ids));

      const found = CANDIDATES.find((id) => ids.has(id));
      const result = found || availableModels[0]?.model_id || "";

      console.log("✅ Selected model:", result);
      return result;
    };

    (async () => {
      try {
        if (!("gpu" in navigator)) {
          setAiErr(
            "Trình duyệt không hỗ trợ WebGPU. Hãy dùng Chrome/Edge mới."
          );
          return;
        }

        const modelId = pickFirstAvailable();

        // ✅ KIỂM TRA modelId là string hợp lệ
        if (!modelId || typeof modelId !== "string") {
          console.error("❌ Invalid model_id:", modelId);
          setAiErr("Không tìm thấy model trong prebuiltAppConfig.");
          return;
        }

        console.log("🚀 Initializing WebLLM with model:", modelId);

        const engine = await CreateMLCEngine(modelId, {
          initProgressCallback: (p) => {
            if (mounted) setAiProgress(Math.round((p || 0) * 100));
          },
        });

        if (!mounted) return;
        setLlm(engine);
        setAiInit(true);
        setAiErr("");
        console.log("✅ WebLLM initialized successfully");
      } catch (e) {
        console.error("❌ WebLLM init error:", e);
        if (mounted) {
          setAiErr(`Không khởi tạo được AI: ${e.message || "Unknown error"}`);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const textToHtml = (txt) => {
    if (!txt) return "";
    const blocks = String(txt)
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);
    return blocks
      .map((b) => {
        const lines = b.split("\n");
        const allChecks = lines.every((l) => l.trim().startsWith("✅"));
        if (allChecks) {
          const items = lines
            .map((l) => l.replace(/^✅\s*/, "").trim())
            .filter(Boolean)
            .map((li) => `<li>${li}</li>`)
            .join("");
          return `<ul>${items}</ul>`;
        }
        return `<p>${b.replace(/\n/g, "<br/>")}</p>`;
      })
      .join("");
  };
  const handleAiSuggest = async () => {
    try {
      if (!llm) {
        showToast?.({
          title: "AI",
          text: "AI chưa sẵn sàng.",
          type: "warning",
        });
        return;
      }
      const name = (productData.name || "").trim();
      const catName = findCategoryById(productData.categoryId)?.name || "";
      const category = labelCategoryVN(catName);
      if (!name || !category) {
        showToast?.({
          title: "AI",
          text: "Hãy nhập Tên & chọn Danh mục trước.",
          type: "warning",
        });
        return;
      }

      const sys =
        "Bạn là copywriter TMĐT. Viết tiếng Việt, súc tích, thân thiện, không bịa thông số.";
      const user = `
Sản phẩm: ${name}
Danh mục: ${category}

Yêu cầu:
- 3–5 gạch đầu dòng (mỗi dòng bắt đầu bằng "✅").
- 1 đoạn mô tả 4–6 câu làm rõ tính năng/chất liệu/đối tượng dùng/lợi ích.
- Thêm 1 dòng hướng dẫn bảo quản hoặc cách dùng nếu phù hợp.
- 1–2 dòng về đổi trả/người bán cam kết (ngắn).
- Không ghi giá, không ghi thông tin liên hệ.
`;

      setAiBusy(true);
      setAiErr("");

      // LẤY từ state thay vì ref
      const originalHtml = productData.description || "";
      const prefix =
        originalHtml.trim().length > 0 ? `<p><em>— Gợi ý mô tả —</em></p>` : "";

      let acc = "";
      const stream = await llm.chat.completions.create({
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 380,
      });

      for await (const chunk of stream) {
        const delta = chunk?.choices?.[0]?.delta?.content || "";
        if (!delta) continue;
        acc += delta;
        const html = textToHtml(acc);
        const finalHtml = (originalHtml ? originalHtml + prefix : "") + html;

        // CẬP NHẬT STATE ==> editor sẽ hiện ngay
        handleInputChange("description", finalHtml);
      }

      if (!acc.trim()) {
        showToast?.({
          title: "AI",
          text: "Không nhận được gợi ý.",
          type: "warning",
        });
      } else {
        showToast?.({ title: "AI", text: "Đã gợi ý mô tả.", type: "success" });
      }
    } catch (e) {
      console.error(e);
      setAiErr("Gợi ý thất bại.");
      showToast?.({ title: "AI", text: "Gợi ý thất bại.", type: "error" });
    } finally {
      setAiBusy(false);
    }
  };

  const handleAiCancel = () => {
    try {
      llm?.interruptGenerate?.();
    } catch {}
  };

  /* ===== Import template theo ngành hàng (nút riêng) ===== */
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
    const rebuilt = rebuildVariantsFromOptionDefs(next, productData.variants);
    setProductData((prev) => ({
      ...prev,
      optionDefs: next,
      mediaByOption: [],
      variants: rebuilt,
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

  return (
    <div className="pc-onepage">
      {/* Tiêu đề + hướng dẫn + reload */}
      <div className="pc-card" style={{ marginBottom: 16 }}>
        <div className="pc-order-mgmt-head-row">
          <h1 className="pc-order-mgmt-title">
            <span className="pc-title-icon">🛒</span> Tạo sản phẩm mới
          </h1>
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

        {sellerLoading ? (
          <div className="pc-upload-note" style={{ marginBottom: 12 }}>
            <span className="pc-note-icon">i</span>
            <span>Đang kiểm tra quyền seller…</span>
          </div>
        ) : sellerErr ? (
          <div className="pc-upload-note" style={{ marginBottom: 12 }}>
            <span className="pc-note-icon">!</span>
            <span>{sellerErr}</span>
          </div>
        ) : null}

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

            {/* Hàng nút AI */}
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 6,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="pc-order-mgmt-btn pc-outline pc-btn-sm"
                onClick={handleAiSuggest}
                disabled={
                  aiBusy ||
                  !aiInit ||
                  !productData.name ||
                  !productData.categoryId
                }
                title={!aiInit ? `Đang tải AI: ${aiProgress}%` : ""}
              >
                {aiBusy ? "🤖 Đang gợi ý..." : "🤖 Gợi ý mô tả"}
              </button>
              {aiBusy && (
                <button
                  type="button"
                  className="pc-order-mgmt-btn pc-ghost pc-btn-sm"
                  onClick={handleAiCancel}
                >
                  Hủy
                </button>
              )}
              {!aiInit && (
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Tải AI: {aiProgress}%
                </div>
              )}
              {aiErr && (
                <div className="pc-field-error" style={{ marginLeft: 4 }}>
                  {aiErr}
                </div>
              )}
            </div>

            <TiptapEditor
              ref={descrEditorRef}
              value={productData.description}
              onChange={(html) => handleInputChange("description", html)}
              placeholder="Nhập mô tả chi tiết sản phẩm..."
            />
          </div>

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
                Gợi ý: <b>{RECOMMENDED_DIM}px</b> &nbsp;|&nbsp;
                <b>
                  Kích thước tối thiểu: {MIN_IMG_W}×{MIN_IMG_H}px
                </b>{" "}
                &nbsp;|&nbsp; dung lượng nên ≤{" "}
                <b>{Math.round(WARN_FILE_SIZE / 1024)}KB</b>, tối đa{" "}
                <b>{MAX_IMAGES}</b> ảnh.
              </span>
            </div>

            {productData.images.length > 0 && (
              <>
                <div className="pc-uploaded-files">
                  Đã chọn: {productData.images.length}/{MAX_IMAGES} hình ảnh
                </div>
                {rejectedFiles.length > 0 && (
                  <div
                    className="pc-img-error"
                    role="alert"
                    style={{ marginTop: 8 }}
                  >
                    <strong>Các tệp không hợp lệ</strong>:{" "}
                    {rejectedFiles.join(", ")}
                  </div>
                )}
                <div className="pc-image-grid" style={{ marginTop: 10 }}>
                  {productData.images.map((f, idx) => {
                    const flagged = flaggedIdxSet.has(idx);
                    const msg = flaggedMsgs[idx];
                    const p = imgPreviews[idx];
                    return (
                      <div
                        key={idx}
                        className={`pc-image-thumb ${
                          flagged ? "pc-flagged" : ""
                        }`}
                      >
                        <img src={p?.url} alt={f.name} />
                        {flagged && (
                          <div
                            className="pc-flag-badge"
                            title={msg || "Ảnh vi phạm"}
                          >
                            Cảnh báo
                          </div>
                        )}
                        <div className="pc-thumb-meta">
                          <div className="pc-thumb-name" title={f.name}>
                            {f.name}
                          </div>
                          <div className="pc-thumb-size">
                            {Math.round((f.size || 0) / 1024)} KB
                          </div>
                        </div>
                        <button
                          onClick={() => removeImageAt(idx)}
                          className="pc-thumb-remove"
                          type="button"
                          aria-label="Xoá ảnh"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
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
              onClick={handleManualGuide}
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
              onClick={() => {
                const baseline = baselineRef.current.map((o) => ({
                  uid: o.uid || genUid(),
                  name: o.name,
                  values: [...(o.values || [])],
                }));
                const rebuilt = rebuildVariantsFromOptionDefs(
                  baseline,
                  productData.variants
                );
                setProductData((prev) => ({
                  ...prev,
                  optionDefs: baseline,
                  mediaByOption: [],
                  variants: rebuilt,
                }));
                setOptionValueInputs({});
                setDupWarnings({});
                setMediaKey(pickMediaKey(baseline));
                showToast?.({
                  title: "Khôi phục biến thể",
                  text: "Đã khôi phục bộ biến thể mặc định.",
                  type: "info",
                });
              }}
              className="pc-order-mgmt-btn pc-outline pc-btn-sm"
              title="Khôi phục biến thể hỗ trợ ban đầu"
            >
              <RefreshCw size={16} />
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
                        : null;

                    return (
                      <ValueCell
                        key={`${optName}-${v}-${i}`}
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
                        onChange={() => {
                          /* không rename ở đây, để ô rỗng vẫn nhận onChange */
                        }}
                        onCommit={(newVal) =>
                          renameOptionValueByName(optName, v, newVal)
                        } // <-- chỉ commit ở đây
                        onRemove={() => removeOptionValueByName(optName, v)}
                      />
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

        {/* Bulk set panel */}
        {/* Bulk set panel */}
        <div className="pc-bulk-card">
          {/* Áp dụng cho tất cả tổ hợp – có nhãn trên từng ô */}
          <div className="pc-bulk-row pc-bulk-row--labeled">
            <div className="pc-bulk-field">
              <label className="pc-bulk-label">Giá (áp dụng cho tất cả)</label>
              <input
                type="text"
                className="pc-form-input pc-input-compact pc-bulk-input"
                placeholder="VD: 379,000"
                aria-label="Giá cho tất cả biến thể"
                value={bulkAll.price}
                onChange={(e) =>
                  setBulkAll((p) => ({
                    ...p,
                    price: formatWithComma(e.target.value),
                  }))
                }
              />
            </div>

            <div className="pc-bulk-field">
              <label className="pc-bulk-label">Giá so sánh (tùy chọn)</label>
              <input
                type="text"
                className="pc-form-input pc-input-compact pc-bulk-input"
                placeholder="VD: 399,000"
                aria-label="Giá so sánh cho tất cả biến thể"
                value={bulkAll.compare}
                onChange={(e) =>
                  setBulkAll((p) => ({
                    ...p,
                    compare: formatWithComma(e.target.value),
                  }))
                }
              />
            </div>

            <div className="pc-bulk-field">
              <label className="pc-bulk-label">
                Số lượng (áp dụng cho tất cả)
              </label>
              <input
                type="text"
                className="pc-form-input pc-input-compact pc-bulk-input"
                placeholder="VD: 1000"
                aria-label="Số lượng cho tất cả biến thể"
                value={bulkAll.qty}
                onChange={(e) =>
                  setBulkAll((p) => ({
                    ...p,
                    qty: formatWithComma(e.target.value),
                  }))
                }
              />
            </div>

            <button
              type="button"
              onClick={applyBulkToAll}
              className="btnfos btnfos-3 pc-apply-btn"
              title="Áp dụng giá/giá so sánh/số lượng cho tất cả biến thể"
            >
              <span>Áp dụng</span>
            </button>
          </div>
        </div>

        {/* Bảng tổ hợp */}
        <div className="pc-variants-table-wrap" style={{ marginTop: 14 }}>
          {productData.variants.length === 0 ? (
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
                  <th>SỐ LƯỢNG</th>
                </tr>
              </thead>
              <tbody>
                {!hasTwoOptions
                  ? // ONE option only
                    (values1 || []).map((val1, j) => {
                      const variantIdx = findVariantIndex(val1, null);
                      const v = productData.variants[variantIdx] || {};
                      const chosen = getMediaImageIndexFor(option1, val1);
                      const chosenIdx = chosen === "" ? -1 : Number(chosen);
                      const preview =
                        Number.isInteger(chosenIdx) && chosenIdx >= 0
                          ? imgPreviews[chosenIdx]
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
                                updateVariantField(
                                  variantIdx,
                                  "price",
                                  e.target.value
                                )
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
                                updateVariantField(
                                  variantIdx,
                                  "compareAtPrice",
                                  e.target.value
                                )
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
                                updateVariantField(
                                  variantIdx,
                                  "quantity",
                                  e.target.value
                                )
                              }
                              placeholder="1000"
                            />
                          </td>
                        </tr>
                      );
                    })
                  : // TWO options
                    (values1 || []).flatMap((val1) => {
                      const rowCount = (values2 || []).length;
                      return (values2 || []).map((val2, j) => {
                        const variantIdx = findVariantIndex(val1, val2);
                        const v = productData.variants[variantIdx] || {};
                        const chosen = getMediaImageIndexFor(option1, val1);
                        const chosenIdx = chosen === "" ? -1 : Number(chosen);
                        const preview =
                          Number.isInteger(chosenIdx) && chosenIdx >= 0
                            ? imgPreviews[chosenIdx]
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
                                  updateVariantField(
                                    variantIdx,
                                    "price",
                                    e.target.value
                                  )
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
                                  updateVariantField(
                                    variantIdx,
                                    "compareAtPrice",
                                    e.target.value
                                  )
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
                                  updateVariantField(
                                    variantIdx,
                                    "quantity",
                                    e.target.value
                                  )
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

      {/* 3. Xác nhận & Gửi duyệt */}
      <div className="pc-card">
        <div className="pc-section-subtitle">
          <span className="pc-subtitle-icon">
            <CheckCircle />
          </span>
          <h3>3. Xác nhận & Gửi duyệt</h3>
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
              <span className="pc-summary-label">Ảnh</span>
              <span className="pc-summary-value">
                {productData.images.length}/{MAX_IMAGES}
              </span>
            </div>
            <div className="pc-summary-item">
              <span className="pc-summary-label">Biến thể</span>
              <span className="pc-summary-value">
                {productData.variants.length}
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
          <button
            onClick={handleSubmitForReview}
            className={`pc-order-mgmt-btn pc-confirm-bulk${
              createBtnDisabled ? " pc-disabled" : ""
            }`}
            disabled={createBtnDisabled}
            title={createBtnTitle}
          >
            <Upload /> {submitting ? "Đang gửi..." : "Tạo sản phẩm"}
          </button>
        </div>
      </div>

      {/* Modal chọn ảnh */}
      <ImagePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        images={productData.images}
        previews={imgPreviews}
        onPick={(idx) => {
          if (pickerBind?.optionName && pickerBind?.optionValue != null) {
            setMediaImageFor(
              pickerBind.optionName,
              pickerBind.optionValue,
              String(idx)
            );
          }
        }}
        position={pickerPos}
      />
    </div>
  );
}
