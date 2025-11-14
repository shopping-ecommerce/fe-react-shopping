// src/services/api.js
import { apiUrl } from "../config/api";

async function postJSON(path, body, opts = {}) {
  const url = typeof apiUrl === "function" ? apiUrl(path) : path;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(opts.headers || {}),
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }
  if (!res.ok)
    throw new Error(json?.message || `Request failed (${res.status})`);
  return json;
}

// Gửi OTP quên mật khẩu
export function forgotPasswordSendOtp(email) {
  return postJSON("/authentication/forgot-password/send-otp", { email });
}

// Xác thực OTP quên mật khẩu (nếu cần dùng)
export function forgotPasswordVerifyOtp({ email, otp }) {
  return postJSON("/authentication/forgot-password/verify-otp", { email, otp });
}
// === Forgot Password: Reset password ===
export function forgotPasswordResetPassword({
  email,
  new_password,
  confirm_password,
}) {
  return postJSON("/authentication/forgot-password/reset-password", {
    email,
    new_password,
    confirm_password,
  });
}
