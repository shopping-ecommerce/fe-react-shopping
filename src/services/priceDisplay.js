// === Helpers giống QuickView ===
const normalize = (v) => (v == null ? "" : String(v)).trim();
const nkey = (s) => normalize(s).toLowerCase();

// Hiển thị tiền với hậu tố "đ"
export const fmtPrice = (n) =>
  Number.isFinite(Number(n)) ? Number(n).toLocaleString("vi-VN") + "đ" : "-đ";

// Lọc variants theo lựa chọn (Favorites chưa chọn gì -> trả về tất cả)
const filterVariantsBySelection = (variants = [], selection = {}) => {
  if (!Array.isArray(variants)) return [];
  const keys = Object.keys(selection || {}).filter(
    (k) => selection[k] !== undefined && selection[k] !== null && selection[k] !== ""
  );
  if (!keys.length) return variants.slice();
  return variants.filter((v) => {
    const ops = v?.options || {};
    return keys.every((k) => nkey(ops[k]) === nkey(selection[k]));
  });
};

// Tính trạng thái giá: exact | single | range | none
export const computePriceState = (product, selectedOptions = {}, selectedSizeLegacy = null) => {
  const hasVariants = Array.isArray(product?.variants) && product.variants.length > 0;
  const sizeListLegacy = Array.isArray(product?.sizes) ? product.sizes : [];

  if (hasVariants) {
    const selKeys = Object.keys(selectedOptions || {});
    if (selKeys.length) {
      const exact = product.variants.find((v) => {
        const ops = v?.options || {};
        return (
          selKeys.length === Object.keys(ops).length &&
          selKeys.every((k) => nkey(ops[k]) === nkey(selectedOptions[k]))
        );
      });
      if (exact && Number.isFinite(Number(exact.price))) {
        const price = Number(exact.price);
        const cmp = Number(exact.compareAtPrice);
        return {
          mode: "exact",
          price,
          compare: Number.isFinite(cmp) && cmp > price ? cmp : null,
        };
      }
    }

    const pool = filterVariantsBySelection(product.variants, selectedOptions);
    const prices = pool.map((v) => Number(v?.price)).filter((n) => Number.isFinite(n));
    if (prices.length) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (min === max) {
        const compares = pool
          .map((v) => Number(v?.compareAtPrice))
          .filter((n) => Number.isFinite(n) && n > min);
        let compare = null;
        if (compares.length) {
          const unique = Array.from(new Set(compares));
          if (unique.length === 1 && unique[0] > min) compare = unique[0];
        }
        return { mode: "single", price: min, compare };
      }
      return { mode: "range", priceMin: min, priceMax: max };
    }
  }

  if (!hasVariants && sizeListLegacy.length) {
    if (selectedSizeLegacy) {
      const s = sizeListLegacy.find((it) => nkey(it?.size) === nkey(selectedSizeLegacy));
      const p = Number(s?.price);
      const c = Number(s?.compareAtPrice);
      if (Number.isFinite(p)) {
        return {
          mode: "exact",
          price: p,
          compare: Number.isFinite(c) && c > p ? c : null,
        };
      }
    }

    const prices = sizeListLegacy.map((s) => Number(s?.price)).filter((n) => Number.isFinite(n));
    if (prices.length) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (min === max) {
        const compares = sizeListLegacy
          .map((s) => Number(s?.compareAtPrice))
          .filter((n) => Number.isFinite(n) && n > min);
        let compare = null;
        if (compares.length) {
          const unique = Array.from(new Set(compares));
          if (unique.length === 1 && unique[0] > min) compare = unique[0];
        }
        return { mode: "single", price: min, compare };
      }
      return { mode: "range", priceMin: min, priceMax: max };
    }
  }

  return { mode: "none" };
};
