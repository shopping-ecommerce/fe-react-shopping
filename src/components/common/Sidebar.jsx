import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLeaf } from '@fortawesome/free-solid-svg-icons';

const Sidebar = ({ isOpen, onToggle }) => {
  return (
    <div className={`sidebar ${isOpen ? 'active' : ''}`}>
      <div className="sidebar-header">
        <h2>Danh mục</h2>
        <div className="sidebar-toggle" onClick={onToggle}>
          <FontAwesomeIcon icon={faLeaf} />
        </div>
      </div>
      <ul className="sidebar-menu">
        <li className="menu-item">
          <img src="https://via.placeholder.com/40?text=Nhà+Sách+Tiki" alt="Nhà Sách Tiki" />
          <span>Nhà Sách Shopping</span>
        </li>
        <li className="menu-item">
          <img src="https://via.placeholder.com/40?text=Nhà+Cửa" alt="Nhà Cửa - Đời Sống" />
          <span>Nhà Cửa - Đời Sống</span>
        </li>
        <li className="menu-item">
          <img src="https://via.placeholder.com/40?text=Điện+Thoại" alt="Điện Thoại - Máy Tính Bảng" />
          <span>Điện Thoại - Máy Tính Bảng</span>
        </li>
        <li className="menu-item">
          <img src="https://via.placeholder.com/40?text=Đồ+Chơi" alt="Đồ Chơi - Mẹ & Bé" />
          <span>Đồ Chơi - Mẹ & Bé</span>
        </li>
        <li className="menu-item">
          <img src="https://via.placeholder.com/40?text=Thiết+Bị+Số" alt="Thiết Bị Số - Phụ Kiện Số" />
          <span>Thiết Bị Số - Phụ Kiện Số</span>
        </li>
        <li className="menu-item">
          <img src="https://via.placeholder.com/40?text=Điện+Gia+Dụng" alt="Điện Gia Dụng" />
          <span>Điện Gia Dụng</span>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;