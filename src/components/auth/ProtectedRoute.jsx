// ProtectedRoute.jsx
import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";

export default function ProtectedRoute({ children, role, roles: rolesProp }) {
  const { isAuthenticated, user, roles: ctxRoles, authReady } = useContext(AuthContext);
  const location = useLocation();

  // ⛔ Chưa init xong -> chưa quyết định
  if (!authReady) return null; // hoặc loader nhỏ

  // 1) Chưa đăng nhập -> /login (nhớ lại trang cũ)
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 2) Kiểm tra quyền (giữ nguyên normalize BUYER -> CUSTOMER như bạn đã làm)
  const required = rolesProp || (role ? [role] : []);
  if (required.length) {
    const userRoles =
      ctxRoles?.length ? ctxRoles
      : (user?.roles?.length ? user.roles
      : (user?.role ? [user.role] : []));

    const normalize = (r) => {
      if (!r) return "";
      let up = String(r).toUpperCase();
      if (up.startsWith("ROLE_")) up = up.slice(5);
      if (up === "BUYER") up = "CUSTOMER";
      return up;
    };

    const need = new Set(required.map(normalize));
    const has = (userRoles || []).some((r) => need.has(normalize(r)));
    if (!has) return <Navigate to="/" replace />;
  }

  return children;
}
