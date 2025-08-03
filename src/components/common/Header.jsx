import { Link } from 'react-router-dom';
import { useContext, useState } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch,
  faShoppingCart,
  faBell,
  faQuestionCircle,
  faGlobe,
  faChevronDown,
  faTimesCircle, // Thêm để dùng cho nút xóa tìm kiếm
} from '@fortawesome/free-solid-svg-icons';
import { faFacebookF, faInstagram } from '@fortawesome/free-brands-svg-icons'; // Sửa faFacebook thành faFacebookF

function Header() {
  const { user, logout } = useContext(AuthContext);
  const [searchText, setSearchText] = useState('');

  return (
    <header className="header">
      <div className="header-top">
        <div className="header-top-content">
          <div className="header-top-left">
            <Link to="/seller" className="header-link">Kênh Người Bán</Link>
            <div className="divider">|</div>
            <Link to="/seller/signup" className="header-link">Trở thành Người bán Shopping</Link>
          </div>
          <div className="header-top-right">
            <Link to="/notifications" className="header-link">
              <FontAwesomeIcon icon={faBell} /> Thông Báo
            </Link>
            <Link to="/help" className="header-link">
              <FontAwesomeIcon icon={faQuestionCircle} /> Hỗ Trợ
            </Link>
            <div className="language-selector">
              <FontAwesomeIcon icon={faGlobe} /> Tiếng Việt{' '}
              <FontAwesomeIcon icon={faChevronDown} />
            </div>
            {user ? (
              <>
                <span className="user-email">Chào, {user.email}</span>
                <button onClick={logout} className="logout-btn">Đăng xuất</button>
              </>
            ) : (
              <>
                <Link to="/signup" className="header-link">Đăng Ký</Link>
                <div className="divider">|</div>
                <Link to="/login" className="header-link">Đăng Nhập</Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="header-main">
        <div className="header-main-content">
          <Link to="/" className="logo">
            <img src="/img/iconwweb.png" alt="T2Store" className="logo-img" />
          </Link>
          
          <div className="search-bar">
            <div className="search-input-container">
              <input
                type="text"
                placeholder="T2Store bao ship 0Đ - Đăng ký ngay!"
                className="search-input"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {searchText && (
                <span className="search-clear" onClick={() => setSearchText('')}>
                  <FontAwesomeIcon icon={faTimesCircle} />
                </span>
              )}
            </div>
            <button className="search-button">
              <FontAwesomeIcon icon={faSearch} />
            </button>
          </div>
          
          <Link to="/cart" className="cart-icon">
            <FontAwesomeIcon icon={faShoppingCart} />
          </Link>
        </div>
      </div>
    </header>
  );
}

export default Header;