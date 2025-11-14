// src/services/realtime.js
import { io } from "socket.io-client";

let socket = null;
// Lưu các room/id đã join để tự động join lại khi reconnect
const joined = new Set();

/**
 * Khởi tạo socket một lần cho toàn app.
 * @param {string} actorId  id chính của client (userId hoặc sellerUserId)
 * @param {string=} token   Bearer token (nếu server có kiểm tra)
 * @param {object=} opts    { baseUrl, path }
 */
export function initSocket(actorId, token, opts = {}) {
  // Ưu tiên URL/path từ .env, sau đó đến opts, cuối cùng fallback 5000
  const BASE_URL =
    (import.meta.env?.VITE_SOCKET_URL && String(import.meta.env.VITE_SOCKET_URL)) ||
    opts.baseUrl ||
    "http://localhost:5000";

  const PATH =
    (import.meta.env?.VITE_SOCKET_PATH && String(import.meta.env.VITE_SOCKET_PATH)) ||
    opts.path ||
    "/socket.io";

  if (!socket) {
    socket = io(BASE_URL, {
      path: PATH,
      // Cho phép fallback nếu WS bị chặn qua proxy; thứ tự ưu tiên websocket trước
      transports: ["websocket", "polling"],
      withCredentials: false,
      // Dùng auth để server đọc ở socket.handshake.auth
      auth: {
        userId: actorId || "",
        token: token || "",
      },
    });

    socket.on("connect", () => {
      console.log("[socket] connected:", socket.id);
      // join lại toàn bộ room đã lưu (kể cả actorId)
      if (actorId) join(actorId);
      joined.forEach((id) => join(id));
    });

    // Khi server/c mạng làm rớt kết nối → tự join lại các room
    socket.on("reconnect", () => {
      console.log("[socket] reconnected:", socket.id);
      joined.forEach((id) => join(id));
    });

    socket.on("connect_error", (err) => {
      console.error("[socket] connect_error:", err?.message || err);
    });
  } else {
    // socket đã có: chỉ cần join actorId nếu có
    if (actorId) join(actorId);
  }

  return socket;
}

/**
 * Join một room/id (userId hoặc sellerId).
 * FE sẽ gọi join(mySellerId) để seller nhận tin “to = mySellerId”.
 */
export function join(id) {
  if (!socket || !id) return;
  socket.emit("add-user", id);
  joined.add(id);
}

export function getSocket() {
  return socket;
}

/** Đăng ký/huỷ đăng ký listener */
export function onTyping(cb)       { socket?.on("typing", cb); }
export function offTyping(cb)      { socket?.off("typing", cb); }
export function onStopTyping(cb)   { socket?.on("stop-typing", cb); }
export function offStopTyping(cb)  { socket?.off("stop-typing", cb); }
export function onUserStatus(cb)   { socket?.on("userStatusUpdate", cb); }
export function offUserStatus(cb)  { socket?.off("userStatusUpdate", cb); }

// Tin nhắn server push có thể dùng 1 trong 2 event tuỳ backend
export function onMessage(cb) {
  socket?.on("msg-receive", cb);
  socket?.on("message", cb);
}
export function offMessage(cb) {
  socket?.off("msg-receive", cb);
  socket?.off("message", cb);
}

/** Emit helpers */
export function emitTyping({ from, to }) {
  socket?.emit("typing", { from, to });
}
export function emitStopTyping({ from, to }) {
  socket?.emit("stop-typing", { from, to });
}

export function disconnectSocket() {
  if (socket) {
    try { socket.disconnect(); } catch (_) {}
    socket = null;
    joined.clear();
  }
}
