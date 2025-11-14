import i18n from "../services/i18n";
export function tt(key, opts) {
  return i18n.t(key, { ...(opts || {}), keySeparator: false });
}
