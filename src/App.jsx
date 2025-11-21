import React, { useState, useEffect } from "react";
import { Routes, Route, Outlet, useLocation, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/auth/ProtectedRoute";

import Header from "./components/common/Header";
import Footer from "./components/common/Footer";
import Sidebar from "./components/common/Sidebar";
import FloatingAssistant from "./components/common/FloatingAssistant"; // 👈 FAB shopping

import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import EmailOTPVerification from "./components/auth/EmailOTPVerification";
import ForgotPassword from "./pages/auth/ForgotPassword";
import OTPVerification from "./components/auth/OTPVerification";

import Home from "./pages/buyer/home/HomeProduct";
import ProductList from "./pages/buyer/home/ProductList";
import OrderHistory from "./pages/buyer/order/OrderHistory";

import OrderManagement from "./pages/seller/order/OrderManagement";
import Analytics from "./pages/seller/Analytics";
import SignupSeller from "./pages/seller/SignUp/SignupSeller";
import Welcome from "./pages/seller/Welcome";
import HomeSeller from "./pages/seller/HomeSeller";
import SellerLayout from "./layouts/SellerLayout";

import AdminDashboard from "./pages/admin/Dashboard";
import CategoryManagement from "./pages/admin/CategoryManagement";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLeaf } from "@fortawesome/free-solid-svg-icons";
import ProfileSeller from "./pages/seller/Updateinformation/ProfileSeller";
import ProfileLegal from "./pages/seller/Updateinformation/ProfileLegal";
import BankAccount from "./pages/seller/Updateinformation/BankAccount";
import InvoiceList from "./pages/seller/order/InvoiceList";
import CreateProductPage from "./pages/seller/product/createproducts";
import BusinessEfficiency from "./pages/seller/Dashboard/BusinessEfficiency";

import AccountLayout from "./layouts/AccountLayout";
import AccountProfile from "./pages/buyer/account/AccountProfile";
import AccountNotifications from "./pages/buyer/account/AccountNotifications";
import AccountFavorites from "./pages/buyer/account/AccountFavorites";
import AccountAddresses from "./pages/buyer/account/AccountAddresses";

import AdminCoreUI from "./layouts/AdminCoreUI";

import ProductDetail from "./pages/buyer/home/ProductDetail";
import CartPage from "./pages/cart/CartPage";
import SellersProducts from "./pages/buyer/home/SellersProducts";
import CheckoutPage from "./pages/buyer/checkout/CheckoutPage";
import OrderSuccess from "./pages/buyer/checkout/OrderSuccess";
import SellerProductsTable from "./pages/seller/product/SellerProductsTable";
import SearchResults from "./pages/buyer/home/SearchResults";

import ShopChatPage from "./components/chat/ShopChatPage";

import SellerChatPage from "./pages/seller/chat/SellerChatPage";

import SellerWallet from "./pages/seller/wallet/SellerWallet";

import WithdrawPage from "./pages/seller/wallet/WithdrawPage";

import UserWallet from "./pages/buyer/wallet/UserWallet";

import UserWithdrawPage from "./pages/buyer/wallet/UserWithdrawPage";

import VoucherManagementPage from "./pages/seller/marketing/VoucherManagementPage";

import OrderDetail from "./pages/buyer/order/OrderDetail";

import ProductEdit from "./pages/seller/product/ProductEdit";

import SellerPolicy from "./pages/buyer/policy/SellerPolicy";

import SellerPolicyregister from "./pages/seller/SellerPolicyregister";

import SuspendedProductsTable from "./pages/seller/product/SuspendedProductsTable";

import OrderDetailSeller from "./pages/seller/order/OrderDetailSeller";

import SellerViolationsPage from "./pages/seller/violations/SellerViolationsPage";

import UserReportsPage from "./pages/buyer/report/UserReportsPage";

import InventoryPage from "./pages/seller/Inventory/Inventory";

import SellerAppealsHistory from "./pages/seller/appeals/SellerAppealsHistory";

import AccountPolicies from "./pages/buyer/account/AccountPolicies";

import ResetPassword from "./pages/auth/ResetPassword";

/** Layout không header/footer/sidebar: dùng cho các trang auth */
function AuthLayout() {
  const location = useLocation();
  const classNameForPage = [
    location.pathname === "/signup" ? "signup-page" : "",
    ["/login", "/forgot-password"].includes(location.pathname)
      ? "login-page"
      : "",
    location.pathname === "/otp-verification" ? "otp-background" : "",
    location.pathname === "/seller/welcome" ? "welcome-page" : "",
  ].join(" ");

  return (
    <div className="app-container">
      <div className={`main-content ${classNameForPage}`}>
        <div className="content-layout">
          <div className="page-content">
            <Outlet />
          </div>
        </div>
      </div>
      {/* AuthLayout KHÔNG render Footer */}
    </div>
  );
}

/** Layout chính có Header/Sidebar/Footer: dùng cho buyer và phần chung */
function MainLayout({ hideFooterOn = [], hideSidebarOn = [] }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const toggleSidebar = () => setIsSidebarOpen((s) => !s);

  const path = location.pathname;
  const shouldHideFooter = hideFooterOn.some(
    (p) => path === p || path.startsWith(p)
  );
  const shouldHideSidebar = hideSidebarOn.some(
    (p) => path === p || path.startsWith(p)
  );

  return (
    <div className="app-container">
      <Header onToggleSidebar={toggleSidebar} />

      <div className="main-content">
        <div className="content-layout">
          {/* Ẩn Sidebar khi shouldHideSidebar = true */}
          {!shouldHideSidebar && (
            <>
              <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
              {!isSidebarOpen && (
                <div
                  className="sidebar-toggle-floating"
                  onClick={toggleSidebar}
                >
                  <FontAwesomeIcon icon={faLeaf} />
                </div>
              )}
            </>
          )}

          <div className="page-content">
            <Outlet />
          </div>
        </div>
      </div>

      {/* Nút tròn “shopping” cố định góc phải dưới — luôn hiển thị */}
      <FloatingAssistant />

      {!shouldHideFooter && <Footer className="footer" />}
    </div>
  );
}

/** Layout riêng cho Admin */
function AdminLayout() {
  return (
    <ProtectedRoute role="admin">
      <AdminCoreUI />
    </ProtectedRoute>
  );
}

function AdminExternalRedirect() {
  useEffect(() => {
    const adminBase = (
      import.meta.env.VITE_ADMIN_URL || "http://localhost:5174"
    ).replace(/\/$/, "");
    const { pathname, search, hash } = window.location;
    const subpath = pathname.replace(/^\/admin\/?/, "");
    const target = `${adminBase}/${subpath}${search || ""}${hash || ""}`;
    console.log("[Admin redirect] →", target);
    window.location.replace(target);
  }, []);

  return <div style={{ padding: 16 }}>Đang chuyển sang trang Admin…</div>;
}

function App() {
  return (
    <Routes>
      {/* Nhóm Auth pages */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/otp-verification" element={<OTPVerification />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/email-otp-verification"
          element={<EmailOTPVerification />}
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        {/* Seller public flow */}
        <Route path="/seller/signup" element={<SignupSeller />} />
        <Route path="/seller/welcome" element={<Welcome />} />
        <Route element={<AuthLayout />}>
          <Route
            path="/seller/policys"
            element={<SellerPolicyregister />}
          />
        </Route>
      </Route>

      {/* Nhóm Buyer + trang chung */}
      <Route
        element={
          <MainLayout
            hideFooterOn={
              [
                "/cart",
                "/checkout",
                "/order-success",
                "/chat-shop",
              ] /* thêm /checkout */
            }
            hideSidebarOn={
              [
                "/cart",
                "/checkout",
                "/products",
                "/shop",
                "/order-success",
                "/chat-shop",
              ] /* ẩn sidebar các trang */
            }
          />
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        {/* 👇 Route trang shop */}
        <Route path="/shop/:sellerId" element={<SellersProducts />} />

        <Route
          path="/cart"
          element={
            <ProtectedRoute role="buyer">
              <CartPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-success"
          element={
            <ProtectedRoute role="buyer">
              <OrderSuccess />
            </ProtectedRoute>
          }
        />

        {/* 👇 Route CHECKOUT nội bộ */}
        <Route
          path="/checkout"
          element={
            <ProtectedRoute role="buyer">
              <CheckoutPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders"
          element={
            <ProtectedRoute role="buyer">
              <OrderHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:orderId"
          element={
            <ProtectedRoute role="buyer">
              <OrderDetail />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat-shop"
          element={
            <ProtectedRoute>
              <ShopChatPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Nhóm Seller */}
      <Route path="/seller" element={<SellerLayout />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<HomeSeller />} />
        <Route path="orders" element={<OrderManagement />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="profile" element={<ProfileSeller />} />
        <Route path="legal" element={<ProfileLegal />} />
        <Route path="bank-account" element={<BankAccount />} />
        <Route path="invoices" element={<InvoiceList />} />
        <Route path="create-products" element={<CreateProductPage />} />
        <Route path="business-efficiency" element={<BusinessEfficiency />} />
        <Route path="products" element={<SellerProductsTable />} />
        {/* (tuỳ chọn nếu muốn truyền sellerId qua URL) */}
        <Route path=":sellerId/products" element={<SellerProductsTable />} />
        <Route path="chat-customers" element={<SellerChatPage />} />
        <Route path="wallet" element={<SellerWallet />} />
        <Route path="wallet/withdraw" element={<WithdrawPage />} />
        <Route path="vouchers" element={<VoucherManagementPage />} />
        <Route path="products/edit/:id" element={<ProductEdit />} />
        <Route path="policy" element={<SellerPolicy />} />
        <Route path="/seller/policys" element={<SellerPolicyregister />} />
        <Route path="/seller/products-suspended" element={<SuspendedProductsTable />} />
        <Route path="orders/:orderId" element={<OrderDetailSeller />} />
        <Route path="violations" element={<SellerViolationsPage />} />
        <Route path="/seller/inventory" element={<InventoryPage />} />
        <Route path="/seller/appeals-history" element={<SellerAppealsHistory />} />
      </Route>

      {/* NHÓM ACCOUNT: dùng AccountLayout riêng, có sidebar riêng */}
      <Route
        path="/account"
        element={
          <ProtectedRoute role="buyer">
            <AccountLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="profile" replace />} />
        <Route path="profile" element={<AccountProfile />} />
        <Route path="notifications" element={<AccountNotifications />} />
        <Route path="orders" element={<OrderHistory />} />
        <Route path="orders/:orderId" element={<OrderDetail />} />
        <Route path="favorites" element={<AccountFavorites />} />
        <Route path="addresses" element={<AccountAddresses />} />
        <Route path="policies" element={<AccountPolicies />} />

        {/* MỚI: Thêm route cho trang ví của user */}
        <Route path="wallet" element={<UserWallet />} />
        <Route path="wallet/withdraw" element={<UserWithdrawPage />} />
        <Route path="reports" element={<UserReportsPage />} />
      </Route>

      {/* Redirect toàn bộ /admin/* sang app admin riêng */}
      <Route path="/admin/*" element={<AdminExternalRedirect />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
