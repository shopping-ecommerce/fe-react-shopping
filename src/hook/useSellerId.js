// src/hooks/useSellerId.js
import { useEffect, useState } from "react";
import { apiUrl, API_CONFIG } from "../config/api";

export function useSellerId(authFetch, { sellerIdFromUrl } = {}) {
  const [sellerId, setSellerId] = useState(sellerIdFromUrl || "");
  const [loading, setLoading] = useState(!sellerIdFromUrl);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!authFetch) return;
      // 1) Nếu có sẵn trên URL → xong luôn
      if (sellerIdFromUrl) {
        setLoading(false);
        setSellerId(sellerIdFromUrl);
        return;
      }

      // 2) Thử lấy từ cache (nếu có)
      const cached = localStorage.getItem("seller_id");
      if (cached) {
        setSellerId(cached);
        setLoading(false);
        return;
      }

      // 3) Gọi API getMyProfile → searchSellerByUserId
      try {
        setLoading(true);
        setError("");

        const resProf = await authFetch(apiUrl(API_CONFIG.endpoints.getMyProfile), {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const dataProf = await resProf.json().catch(() => ({}));
        if (!resProf.ok) throw new Error(dataProf?.message || `HTTP ${resProf.status}`);

        const userId = dataProf?.result?.id;
        if (!userId) throw new Error("Không lấy được userId từ profile.");

        const resSeller = await authFetch(
          apiUrl(API_CONFIG.endpoints.searchSellerByUserId(userId)),
          { method: "GET", headers: { Accept: "application/json" } }
        );
        const dataSeller = await resSeller.json().catch(() => ({}));
        if (!resSeller.ok) throw new Error(dataSeller?.message || `HTTP ${resSeller.status}`);

        const sid = dataSeller?.result?.id;
        if (!sid) throw new Error("Tài khoản chưa có sellerId.");

        if (!cancelled) {
          setSellerId(sid);
          localStorage.setItem("seller_id", sid);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Không xác định được sellerId.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authFetch, sellerIdFromUrl]);

  return { sellerId, loading, error };
}
