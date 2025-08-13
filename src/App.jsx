import React, { useState } from 'react';
import { Routes, Route, Outlet, useLocation, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';

import Header from './components/common/Header';
import Footer from './components/common/Footer';
import Sidebar from './components/common/Sidebar';

import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import EmailOTPVerification from './components/auth/EmailOTPVerification';
import ForgotPassword from './pages/auth/ForgotPassword';

import Home from './pages/buyer/Home';
import ProductList from './pages/buyer/ProductList';
import ProductDetail from './pages/buyer/ProductDetail';
import Cart from './pages/buyer/Cart';
import OrderHistory from './pages/buyer/OrderHistory';

import Dashboard from './pages/seller/Dashboard';
import OrderManagement from './pages/seller/OrderManagement';
import Analytics from './pages/seller/Analytics';
import SignupSeller from './pages/seller/SignupSeller';
import Welcome from './pages/seller/Welcome';

import AdminDashboard from './pages/admin/Dashboard';
import CategoryManagement from './pages/admin/CategoryManagement';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLeaf } from '@fortawesome/free-solid-svg-icons';
import HomeSeller from './pages/seller/HomeSeller';
import OTPVerification from './components/auth/OTPVerification';
import SellerLayout from './layouts/SellerLayout';

/** Layout không header/footer/sidebar: dùng cho các trang auth */
function AuthLayout() {
  const location = useLocation();
  const classNameForPage = [
    location.pathname === '/signup' ? 'signup-page' : '',
    ['/login', '/forgot-password'].includes(location.pathname) ? 'login-page' : '',
    location.pathname === '/otp-verification' ? 'otp-background' : '',
    location.pathname === '/seller/welcome' ? 'welcome-page' : '',
  ].join(' ');

  return (
    <div className={`app-container`}>
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
function MainLayout({ hideFooterOn = [] }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const toggleSidebar = () => setIsSidebarOpen((s) => !s);

  const shouldHideFooter = hideFooterOn.includes(location.pathname);

  return (
    <div className="app-container">
      <Header onToggleSidebar={toggleSidebar} />
      <div className="main-content">
        <div className="content-layout">
          <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
          {!isSidebarOpen && (
            <div className="sidebar-toggle-floating" onClick={toggleSidebar}>
              <FontAwesomeIcon icon={faLeaf} />
            </div>
          )}
          <div className="page-content">
            <Outlet />
          </div>
        </div>
      </div>
      {!shouldHideFooter && <Footer className="footer" />}
    </div>
  );
}


/** Layout riêng cho Admin */
function AdminLayout() {
  return (
    <ProtectedRoute role="admin">
      <MainLayout>
        <Outlet />
      </MainLayout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <Routes>
      {/* Nhóm Auth pages */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/otp-verification" element={<OTPVerification />} />
        <Route path="/email-otp-verification" element={<EmailOTPVerification />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        {/* Seller public flow */}
        <Route path="/seller/signup" element={<SignupSeller />} />
        <Route path="/seller/welcome" element={<Welcome />} />
      </Route>

      {/* Nhóm Buyer + trang chung, ẩn footer ở /cart nếu bạn muốn */}
      <Route element={<MainLayout hideFooterOn={['/cart']} />}>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/product/:id" element={<ProductDetail />} />

        <Route
          path="/cart"
          element={
            <ProtectedRoute role="buyer">
              <Cart />
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
      </Route>

     {/* Nhóm Seller */}
<Route element={<SellerLayout />}>
  <Route path="/seller" element={<Navigate to="/seller/home" replace />} />
  <Route path="/seller/home" element={<HomeSeller />} />
  <Route path="/seller/orders" element={<OrderManagement />} />
  <Route path="/seller/analytics" element={<Analytics />} />
</Route>


      {/* Nhóm Admin */}
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/categories" element={<CategoryManagement />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
