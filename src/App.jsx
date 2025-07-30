import { Routes, Route, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import React, { useState } from 'react';
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup'; // Giữ nếu cần cho người dùng thông thường
import OTPVerification from './components/auth/OTPVerification';
import ForgotPassword from './pages/auth/ForgotPassword';
import Home from './pages/buyer/Home';
import ProductList from './pages/buyer/ProductList';
import ProductDetail from './pages/buyer/ProductDetail';
import Cart from './pages/buyer/Cart';
import OrderHistory from './pages/buyer/OrderHistory';
import Dashboard from './pages/seller/Dashboard';
import OrderManagement from './pages/seller/OrderManagement';
import Analytics from './pages/seller/Analytics';
import AdminDashboard from './pages/admin/Dashboard';
import CategoryManagement from './pages/admin/CategoryManagement';
import Sidebar from './components/common/Sidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLeaf } from '@fortawesome/free-solid-svg-icons';
import SignupSeller from './pages/seller/SignupSeller'; // Import SignupSeller

function AppContent() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/otp-verification' || location.pathname === '/forgot-password' || location.pathname === '/seller/signup'; // Cập nhật isAuthPage
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="app-container">
      {!isAuthPage && <Header onToggleSidebar={toggleSidebar} />}
      <div className={`main-content ${location.pathname === '/signup' ? 'signup-page' : location.pathname === '/login' ? 'login-page' : location.pathname === '/otp-verification' ? 'otp-page' : location.pathname === '/forgot-password' ? 'login-page' : ''}`}>
        {/* Loại bỏ 'signup-page' cho /seller/signup */}
        <div className="content-layout">
          {!isAuthPage && (
            <>
              <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
              {!isSidebarOpen && (
                <div className="sidebar-toggle-floating" onClick={toggleSidebar}>
                  <FontAwesomeIcon icon={faLeaf} />
                </div>
              )}
            </>
          )}
          <div className="page-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<ProductList />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} /> {/* Giữ nếu cần */}
              <Route path="/otp-verification" element={<OTPVerification />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
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
              <Route
                path="/seller"
                element={
                  <ProtectedRoute role="seller">
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/seller/orders"
                element={
                  <ProtectedRoute role="seller">
                    <OrderManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/seller/analytics"
                element={
                  <ProtectedRoute role="seller">
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/seller/signup" // Route cho SignupSeller không áp dụng signup-page
                element={<SignupSeller />}
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute role="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/categories"
                element={
                  <ProtectedRoute role="admin">
                    <CategoryManagement />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </div>
        </div>
      </div>
      <Footer className="footer" />
    </div>
  );
}

function App() {
  return <AppContent />;
}

export default App;