import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import SellerHeader from '../components/seller/SellerHeader';
import SellerSidebar from '../components/seller/SellerSidebar';
import Footer from '../components/common/Footer';
import '../styles/SellerLayout.css';   // <-- nhớ import

export default function SellerLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const toggleSidebar = () => setIsSidebarOpen(s => !s);

  return (
    <div className="seller-app">
      <SellerHeader onToggleSidebar={toggleSidebar} />
      {/* dùng grid 2 cột cho phần dưới header */}
      <div className={`seller-main ${isSidebarOpen ? 'open' : 'collapsed'}`}>
        <SellerSidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
        <main className="seller-page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
