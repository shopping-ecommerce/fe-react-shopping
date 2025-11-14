import React, { useState, useEffect, useLayoutEffect } from 'react';
import { Outlet } from 'react-router-dom';
import SellerHeader from '../components/seller/SellerHeader';
import SellerSidebar from '../components/seller/SellerSidebar';
import Footer from '../components/common/Footer';
import '../styles/SellerLayout.css';

export default function SellerLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const toggleSidebar = () => setIsSidebarOpen(s => !s);

  // Ẩn outer scroll khi ở seller
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('seller-lock-outer');
    return () => html.classList.remove('seller-lock-outer');
  }, []);

  // ✅ Đo header + banner để tính chiều cao phần dưới cho chính xác
  useLayoutEffect(() => {
    const setHeaderVar = () => {
      const header = document.querySelector('.tk-header.tk-lg') || document.querySelector('header');
      const banner = document.querySelector('.tos-snooze-banner');
      const h = (header?.offsetHeight || 72) + (banner?.offsetHeight || 0);
      document.documentElement.style.setProperty('--header-h', `${h}px`);
    };
    setHeaderVar();
    window.addEventListener('resize', setHeaderVar);
    const mo = new MutationObserver(setHeaderVar);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });
    return () => {
      window.removeEventListener('resize', setHeaderVar);
      mo.disconnect();
    };
  }, []);

  return (
    <div className="seller-app">
      <SellerHeader onToggleSidebar={toggleSidebar} />
      <div className={`seller-main ${isSidebarOpen ? 'open' : 'collapsed'}`}>
        <SellerSidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
        <main className="seller-page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
