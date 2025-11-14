// src/pages/seller/policy/SellerPolicy.jsx
import React from "react";
import MDEditor from "@uiw/react-md-editor";
import rehypeSanitize from "rehype-sanitize";
import { AuthContext } from "../../../contexts/AuthContext";
import { apiUrl, API_CONFIG } from "../../../config/api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilePdf, faRotate } from "@fortawesome/free-solid-svg-icons";

// ===== Helpers =====
const POLICY_CODE = "seller-tos";

const pad = (n) => String(n).padStart(2, "0");
const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const makeUrl = (path) => {
  if (typeof apiUrl === "function") return apiUrl(path);
  const base =
    (typeof apiUrl === "string" && apiUrl) ? apiUrl : API_CONFIG?.baseUrl || "";
  return `${base}${path}`;
};

export default function SellerPolicy() {
  const { authFetch } = React.useContext(AuthContext) || {};

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [policy, setPolicy] = React.useState(null);

  const [at] = React.useState(todayYMD());

  const fetchPolicy = React.useCallback(async () => {
    if (!authFetch) return;
    setLoading(true);
    setError("");
    try {
      const url = makeUrl(
        `/policy/policies/${POLICY_CODE}/effective?at=${encodeURIComponent(at)}`
      );
      const res = await authFetch(url, { headers: { Accept: "application/json" } });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      const json = JSON.parse(text || "{}");
      setPolicy(json || null);
    } catch (e) {
      console.error("[SellerPolicy] load fail:", e);
      setError(e?.message || "Không tải được chính sách.");
      setPolicy(null);
    } finally {
      setLoading(false);
    }
  }, [authFetch, at]);

  React.useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const openPdf = () => {
    if (policy?.pdfUrl) {
      window.open(policy.pdfUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="seller-policy-page" data-color-mode="light" style={{ padding: 16 }}>
      {/* Header gọn, nút nhỏ, bỏ “Mã: seller-tos” */}
      <div
        className="sp-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          margin: "16px 0",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 6px" }}>Chính sách dành cho Người bán</h1>
          <div style={{ fontSize: 14, color: "#555" }}>
            <b>Thời điểm tra cứu:</b> {at}
            {policy?.version ? (
              <>
                &nbsp;•&nbsp;<b>Version:</b> {policy.version}
              </>
            ) : null}
            {policy?.startDate ? (
              <>
                &nbsp;•&nbsp;<b>Hiệu lực:</b> {policy.startDate}
              </>
            ) : null}
            {typeof policy?.commissionPercent === "number" ? (
              <>
                &nbsp;•&nbsp;<b>Hoa hồng:</b> {policy.commissionPercent}%
              </>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={fetchPolicy}
            className="btn"
            title="Tải lại"
            style={{
              padding: "6px 10px",
              fontSize: 13,
              lineHeight: 1.1,
              border: "1px solid #ddd",
              background: "#fff",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            <FontAwesomeIcon icon={faRotate} />&nbsp; Tải lại
          </button>
          <button
            type="button"
            onClick={openPdf}
            className="btn"
            disabled={!policy?.pdfUrl}
            title={policy?.pdfUrl ? "Mở PDF" : "Chưa có PDF"}
            style={{
              padding: "6px 10px",
              fontSize: 13,
              lineHeight: 1.1,
              border: "1px solid #e33",
              color: "#fff",
              background: policy?.pdfUrl ? "#e53935" : "#aaa",
              borderRadius: 8,
              cursor: policy?.pdfUrl ? "pointer" : "not-allowed",
            }}
          >
            <FontAwesomeIcon icon={faFilePdf} />&nbsp; Xem PDF
          </button>
        </div>
      </div>

      {/* Thân chỉ hiển thị Markdown */}
      {loading ? (
        <div style={{ padding: 16 }}>Đang tải nội dung…</div>
      ) : error ? (
        <div
          style={{
            padding: 16,
            background: "#ffebee",
            border: "1px solid #ffcdd2",
            color: "#c62828",
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      ) : (
        <div
          className="sp-body"
          style={{
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <MDEditor.Markdown
            source={policy?.contentMd || ""}
            rehypePlugins={[rehypeSanitize]}
          />
        </div>
      )}
    </div>
  );
}
