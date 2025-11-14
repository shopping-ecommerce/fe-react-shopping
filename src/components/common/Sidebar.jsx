import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLeaf } from "@fortawesome/free-solid-svg-icons";
import { AuthContext } from "../../contexts/AuthContext";
import { API_CONFIG, apiUrl } from "../../config/api";

const CATEGORY_TRANSLATIONS = {
  Electronics: "Điện tử",
  Fashion: "Thời trang",
  Books: "Sách",
  Home: "Nhà cửa",
  Sports: "Thể thao",
  Beauty: "Làm đẹp",
  Toys: "Đồ chơi",
  Automotive: "Ô tô - Xe máy",
  Health: "Sức khỏe",
  Grocery: "Tạp hóa",
  SecondHand: "Đồ cũ",
  All: "Tất cả",
};

const CATEGORY_ICONS = {
  Electronics: "/img/icon-sidebar/man-hinh-may-tinh-5-800x450-1.jpg",
  Fashion: "/img/icon-sidebar/lovepik-fashion-womens-summer-shopping-image-picture_500961857.jpg",
  Books: "/img/icon-sidebar/images.jpeg",
  Home: "/img/icon-sidebar/anh-mo-ta.jpeg",
  Sports: "/img/icon-sidebar/the-thao.jpg",
  Beauty: "/img/icon-sidebar/lam-dep.jpg",
  Toys: "/img/icon-sidebar/do_choi.jpg",
  Automotive: "/img/icon-sidebar/oto-xemay.jpg",
  Health: "/img/icon-sidebar/suc-khoe1.jpg",
  Grocery: "/img/icon-sidebar/tap-hoa.jpeg",
  SecondHand: "/img/icon-sidebar/do-cu.jpeg",
  All: "/img/icon-sidebar/all.jpg",
};

const Sidebar = ({ isOpen, onToggle }) => {
  const { authFetch } = useContext(AuthContext);
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(apiUrl(API_CONFIG.endpoints.categories), {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const data = await res.json();
        setCategories(data.result || []);
      } catch (err) {
        console.error("❌ Lỗi load categories:", err);
      }
    })();
  }, [authFetch]);

  const goCategory = (cat) => {
    navigate(`/?categoryId=${encodeURIComponent(cat.id)}&name=${encodeURIComponent(cat.name)}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className={`sidebar ${isOpen ? "active" : ""}`}>
      <div className="sidebar-header">
        <h2>Danh mục</h2>
        <div className="sidebar-toggle" onClick={onToggle}>
          <FontAwesomeIcon icon={faLeaf} />
        </div>
      </div>

      <ul className="sidebar-menu">
        {categories.map((cat, idx) => {
          const viName = CATEGORY_TRANSLATIONS[cat.name] || cat.name;
          const iconPath = CATEGORY_ICONS[cat.name] || "/img/default.png";
          return (
            <li
              key={cat.id}
              className="menu-item"
              onClick={() => goCategory(cat)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && goCategory(cat)}
              // anchor tour ở item đầu tiên
              data-tour={idx === 0 ? "sidebar-category" : undefined}
            >
              <img src={iconPath} alt={viName} />
              <span>{viName}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Sidebar;
