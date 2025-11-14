// src/services/policy.js
import { apiUrl } from "../config/api";

/**
 * POST /policy/policies/seller-tos/consents/sellers/{sellerId}/accept
 */
export async function acceptSellerPolicy(authFetch, sellerId, opts = {}) {
  if (!authFetch) throw new Error("Missing authFetch");
  if (!sellerId) throw new Error("Missing sellerId");

  const url = apiUrl(
    `/policy/policies/seller-tos/consents/sellers/${encodeURIComponent(
      sellerId
    )}/accept`
  );

  const headers = {
    Accept: "application/json",
    ...(opts.forwardedFor ? { "X-Forwarded-For": opts.forwardedFor } : {}),
  };

  const res = await authFetch(url, { method: "POST", headers });

  if ([200, 201, 204].includes(res.status)) {
    let data = null;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : null; // 204 No Content => null
    } catch {}
    return { ok: true, status: res.status, data };
  }

  if (res.status === 409) {
    // đã accept trước đó
    let data = null;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : null;
    } catch {}
    return { ok: true, status: res.status, data, alreadyAccepted: true };
  }

  const errorText = await res.text();
  return { ok: false, status: res.status, error: errorText || `HTTP ${res.status}` };
}
