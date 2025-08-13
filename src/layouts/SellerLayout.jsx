import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import SellerHeader from '../components/seller/SellerHeader';
import SellerSidebar from '../components/seller/SellerSidebar';
import Footer from '../components/common/Footer';

export default function SellerLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const toggleSidebar = () => setIsSidebarOpen(s => !s);

  return (

      <div className="seller-app">
        <SellerHeader onToggleSidebar={toggleSidebar} />
        <div className="seller-main">
          <SellerSidebar isOpen={isSidebarOpen} />
          <div className="seller-page">
            <Outlet />
          </div>
        </div>
        <Footer />
      </div>

  );
}
