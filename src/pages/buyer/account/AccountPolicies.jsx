import React, { useEffect, useState, useContext } from "react";
import { API_CONFIG, apiUrl } from "../../../config/api";
import { AuthContext } from "../../../contexts/AuthContext";
import "../../../styles/AccountPolicies.css";

const fmtDate = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
};

export default function AccountPolicies() {
  const { authFetch } = useContext(AuthContext) || {};
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const doFetch = async () => {
      setLoading(true);
      setError("");
      try {
        const token =
          localStorage.getItem("access_token") || localStorage.getItem("token") || "";

        const res = authFetch
          ? await authFetch(apiUrl(API_CONFIG.endpoints.policiesLatest), {
              headers: { Accept: "application/json" },
            })
          : await fetch(apiUrl(API_CONFIG.endpoints.policiesLatest), {
              headers: {
                Accept: "application/json",
                Authorization: token ? `Bearer ${token}` : "",
              },
            });

        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
        const list = Array.isArray(data?.result) ? data.result : [];
        setPolicies(list);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Lỗi tải chính sách");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    doFetch();
    return () => (cancelled = true);
  }, [authFetch]);

  if (loading)
    return (
      <div className="account-content account-policies">
        <div className="account-policies__loading">Đang tải chính sách...</div>
      </div>
    );

  if (error)
    return (
      <div className="account-content account-policies">
        <div className="account-policies__error">Lỗi: {error}</div>
      </div>
    );

  return (
    <div className="account-content account-policies">
      <div className="account-policies__header">
        <h2 className="account-policies__title">Chính sách của bạn</h2>
        <span className="account-policies__count">
          Có {policies.length} chính sách đang áp dụng
        </span>
      </div>

      <div className="account-policies__grid">
        {policies.map((p) => (
          <details key={p.id} className="policy-card">
            <summary>
              <span className="policy-card__caret" />
              <div className="policy-card__line">
                <span className="policy-card__title">{p.title}</span>
                <span className="policy-badge policy-badge--code">{p.code}</span>
                <span className="policy-badge policy-badge--version">{p.version}</span>
                <span className="policy-badge policy-badge--date">
                  Hiệu lực: {fmtDate(p.effectiveDate)}
                </span>
              </div>
            </summary>

            <div className="policy-card__body">
              {/* Hiển thị raw markdown dưới dạng “đẹp” nhờ CSS policy-md */}
              <div className="policy-md">{p.contentMarkdown}</div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
