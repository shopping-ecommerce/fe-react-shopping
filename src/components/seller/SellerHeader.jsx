import React from 'react';

export default function SellerHeader({ onToggleSidebar }) {
  return (
    <header className="seller-header">
      <div className="seller-header__left">
        <button onClick={onToggleSidebar} className="btn--ghost">☰</button>
        <h1 className="seller-title">Seller Console</h1>
      </div>
      <div className="seller-header__right">
        {/* chỗ cho notifications / profile / store switcher */}
        <span className="badge">Store #A12</span>
      </div>
    </header>
  );
}
