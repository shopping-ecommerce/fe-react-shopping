// Dọn HTML từ tiptap trước khi lưu &/hoặc trước khi render
import DOMPurify from "dompurify";

export function cleanEditorHtml(src = "") {
  let s = String(src || "");

  // Bỏ marker "— Gợi ý mô tả —"
  s = s.replace(/<p><em>—\s*Gợi ý mô tả\s*—<\/em><\/p>/gi, "");

  // Bỏ các <p> rỗng (chỉ space/&nbsp;)
  s = s.replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "");

  // Gộp <br> dư thừa (3+ về 2)
  s = s.replace(/(?:<br\s*\/?>\s*){3,}/gi, "<br><br>");

  // (Chặn rò rỉ giá / số đt / email do AI lỡ chèn) — optional
  s = s.replace(/<p>[^<]*(Giá:|Đặt hàng:)[\s\S]*?<\/p>/gi, "");
  s = s.replace(/\b\d{9,11}\b/g, "");                // SĐT đơn giản
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ""); // email

  // Khử XSS & chỉ cho phép một số tag cơ bản
  const clean = DOMPurify.sanitize(s, {
    ALLOWED_TAGS: [
      "p","br","em","strong","ul","ol","li","h1","h2","h3","blockquote","code","hr"
    ],
    ALLOWED_ATTR: []
  });

  return clean.trim();
}
