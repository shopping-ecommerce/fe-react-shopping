// src/services/chatShop.js
import { API_CONFIG, apiUrl } from "../config/api";

/** Gửi message (text/emoji/files) – POST multipart/form-data
 * Endpoint: POST /messages/sendmedia (yêu cầu Bearer token)
 */
export async function sendMediaMessage({ token, from, to, text = "", emoji = "", files = [] }) {
  const url = apiUrl("/messages/sendmedia");

  const fd = new FormData();
  if (from) fd.append("from", from); // nếu backend cần from
  fd.append("to", to);
  fd.append("text", text || "");
  fd.append("emoji", emoji || "");
  (Array.isArray(files) ? files : [files]).forEach((f) => f && fd.append("files", f));

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }, // KHÔNG set Content-Type cho multipart
    body: fd,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.msg || `HTTP ${res.status}`);
  return data; // { msg, message: {...} }
}

/** Lấy danh sách hội thoại cuối cùng của 1 actor – GET
 * Endpoint: GET /messages/lastmessages/{actorId}
 */
export async function fetchLastMessages({ token, actorId }) {
  const url = apiUrl(`/messages/lastmessages/${encodeURIComponent(actorId)}`);

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });

  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && (data.message || data.msg)) || `HTTP ${res.status}`);
  return Array.isArray(data) ? data : [];
}

/** Lấy toàn bộ tin nhắn giữa 2 người – POST JSON
 * Endpoint: POST /messages/getmsg  (yêu cầu token)
 * Body: { from, to }
 */
export async function fetchMessagesBetween({ token, from, to }) {
  const url = apiUrl(`/messages/getmsg`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ from, to }),
  });

  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && (data.message || data.msg)) || `HTTP ${res.status}`);
  return Array.isArray(data) ? data : [];
}
