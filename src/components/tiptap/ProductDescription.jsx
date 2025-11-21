// src/components/ProductDescription.jsx
import React from "react";
import DOMPurify from "dompurify";
// Nếu server trả đã escape dạng &lt;p&gt;... thì bật dòng dưới:
// import he from "he"; // npm i he

export default function ProductDescription({ html, isEscaped = false }) {
  const raw = String(html || "");
  // Nếu cần decode (tuỳ API), bật dòng dưới và truyền isEscaped={true}
  // const decoded = isEscaped ? he.decode(raw) : raw;

  const clean = DOMPurify.sanitize(/* decoded */ raw, {
    ALLOWED_TAGS: [
      "p","br","em","strong","ul","ol","li","h1","h2","h3","blockquote","code","hr"
    ],
    ALLOWED_ATTR: []
  });

  return <div className="product-description" dangerouslySetInnerHTML={{ __html: clean }} />;
}
