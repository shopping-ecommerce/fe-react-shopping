// src/services/profile.js
import { API_CONFIG, apiUrl } from "../config/api";
import { createAuthFetch } from "./auth";

const safeJson = async (res) => {
  const t = await res.text();
  if (!t) return {};
  try { return JSON.parse(t); } catch { return { message: t }; }
};

/**
 * Lấy profile hiện tại bằng Bearer token (đọc token từ storage qua createAuthFetch()).
 * Trả về nguyên payload từ BE: { code, result, ... }
 * Lấy userId: data.result.id
 */
export async function getMyProfile() {
  const authFetch = createAuthFetch();
  const endpoint = apiUrl(API_CONFIG.endpoints.getMyProfile);

  const res = await authFetch(endpoint, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data;
}
