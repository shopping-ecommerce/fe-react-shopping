// src/components/common/Footer.jsx
import React from "react";
import "../../styles/footer.css";

function Footer() {
  const year = new Date().getFullYear();

  const scrollToTop = () =>
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });

  const handleNewsletterClick = () => {
    // TODO: gọi API đăng ký nếu bạn có endpoint
    alert("Đăng ký nhận tin thành công!");
  };

  return (
    <footer className="ft">
      <div className="ft__inner">
        {/* Brand + short about */}
        <div className="ft__col">
          <div className="ft__brand">
            <div className="ft__logo">
              {/* Cart đen trên nền trắng */}
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.7 12.3a2 2 0 0 0 2 1.7h7.8a2 2 0 0 0 2-1.6l1.6-8.4H6.1"></path>
              </svg>
            </div>
            <div>
              <h3 className="ft__title">Shopping</h3>
              <p className="ft__tagline">
                Mua sắm nhẹ nhàng – Giao nhanh, giá tốt, chăm sóc tận tâm.
              </p>
            </div>
          </div>

          <ul className="ft__socials">
            <li>
              <a
                href="https://www.facebook.com/?locale=vi_VN" // đổi link FB nếu cần
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path
                    fill="currentColor"
                    d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.06 5.66 21.2 10.44 22v-7.03H7.9v-2.9h2.53v-2.2c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.9H13.6V22C18.38 21.2 22 17.06 22 12.06z"
                  />
                </svg>
              </a>
            </li>
            <li>
              <a
                href="https://www.instagram.com/imcuoc_thai/"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
              >
                {/* Instagram: stroke đen, fill none */}
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" ry="5"></rect>

                  <circle cx="12" cy="12" r="3.5"></circle>

                  <circle
                    cx="17.5"
                    cy="6.5"
                    r="1.25"
                    fill="currentColor"
                    stroke="none"
                  ></circle>
                </svg>
              </a>
            </li>
          </ul>
        </div>

        {/* Links */}
        <div className="ft__col">
          <h4 className="ft__col-title">Về Shopping</h4>
          <ul className="ft__links">
            <li>
              <a href="#">Giới thiệu</a>
            </li>
            <li>
              <a href="#">Tuyển dụng</a>
            </li>
            <li>
              <a href="#">Blog</a>
            </li>
            <li>
              <a href="#">Khuyến mãi</a>
            </li>
          </ul>
        </div>

        <div className="ft__col">
          <h4 className="ft__col-title">Hỗ trợ</h4>
          <ul className="ft__links">
            <li>
              <a href="#">Trung tâm trợ giúp</a>
            </li>
            <li>
              <a href="#">Giao hàng &amp; đổi trả</a>
            </li>
            <li>
              <a href="#">Câu hỏi thường gặp</a>
            </li>
            <li>
              <a href="#">Liên hệ hỗ trợ</a>
            </li>
          </ul>
        </div>

        {/* Contact + newsletter (DIV thay cho FORM để tránh lỗi form) */}
        <div className="ft__col">
          <h4 className="ft__col-title">Liên hệ</h4>
          <ul className="ft__contact">
            <li>📍 123 Shopping Street, HCMC</li>
            <li>📞 0358 097 747</li>
            <li>✉️ support@shopping.vn</li>
          </ul>

          <div
            className="ft__newsletter"
            role="group"
            aria-label="Đăng ký nhận ưu đãi"
          >
            <input
              type="email"
              placeholder="Nhập email nhận ưu đãi"
              aria-label="Email"
            />
            <button type="button" onClick={handleNewsletterClick}>
              Đăng ký
            </button>
          </div>

          <div className="ft__badges">
            <span className="ft__badge">COD</span>
            <span className="ft__badge">Visa</span>
            <span className="ft__badge">Mastercard</span>
            <span className="ft__badge">Momo</span>
          </div>
        </div>
      </div>

      <hr className="ft__divider" />

      <div className="ft__bottom">
        <p>© {year} Shopping. All rights reserved.</p>
        <div className="ft__bottom-right">
          <ul className="ft__policies">
            <li>
              <a href="#">Điều khoản</a>
            </li>
            <li>
              <a href="#">Bảo mật</a>
            </li>
            <li>
              <a href="#">Cookies</a>
            </li>
          </ul>
          <button
            className="ft__top"
            onClick={scrollToTop}
            aria-label="Lên đầu trang"
            title="Lên đầu trang"
          >
            ↑
          </button>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
