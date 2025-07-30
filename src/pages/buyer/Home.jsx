import React, { useState, useEffect, useRef } from 'react';

function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slideInterval = useRef();
  const totalSlides = 3; // Số lượng tổng slide

  // Dữ liệu cho slider
  const slides = [
    { left: "/img/cart1.png", right: "/img/cart.jpg" },
    { left: "/img/cart.jpg", right: "/img/cart1.png" },
    { left: "/img/cart1.png", right: "/img/cart.jpg" }
  ];

  // Dữ liệu cho thanh công cụ navigation
  const navItems = [
    { icon: "/img/cart1.png", text: "Thăng hạng TikiVIP" },
    { icon: "/img/cart1.png", text: "Tiki sáng nay rẻ" },
    { icon: "/img/cart1.png", text: "Tiki Trading" },
    { icon: "/img/cart1.png", text: "Coupon siêu hot" },
    { icon: "/img/cart1.png", text: "Xả kho giảm nửa giá" },
    { icon: "/img/cart1.png", text: "Combo siêu tiết kiệm" },
    { icon: "/img/cart1.png", text: "Đổi phố thời tiết" },
    { icon: "/img/cart1.png", text: "Top Sách bán chạy" },
    { icon: "/img/cart1.png", text: "Tân trang tổ ấm" },
    { icon: "/img/cart1.png", text: "Du lịch sành điệu" }
  ];

  // Dữ liệu cho phần promo (danh sách lớn hơn để hỗ trợ pagination)
  const allPromoItems = [
    { image: "/img/cart1.png", title: "Sản phẩm 1" },
    { image: "/img/cart.jpg", title: "Sản phẩm 2" },
    { image: "/img/cart1.png", title: "Sản phẩm 3" },
    { image: "/img/cart.jpg", title: "Sản phẩm 4" },
    { image: "/img/cart1.png", title: "Sản phẩm 5" },
    { image: "/img/cart.jpg", title: "Sản phẩm 6" },
    { image: "/img/cart1.png", title: "Sản phẩm 7" },
    { image: "/img/cart.jpg", title: "Sản phẩm 8" },
    { image: "/img/cart1.png", title: "Sản phẩm 9" },
    { image: "/img/cart.jpg", title: "Sản phẩm 10" }
  ];

  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(allPromoItems.length / itemsPerPage);

  // Lấy danh sách sản phẩm cho trang hiện tại
  const currentPromoItems = allPromoItems.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  // Hàm bắt đầu interval
  const startSlide = () => {
    stopSlide();
    slideInterval.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, 4000);
  };

  // Hàm dừng interval
  const stopSlide = () => {
    if (slideInterval.current) {
      clearInterval(slideInterval.current);
    }
  };

  // Xử lý chuyển slide thủ công
  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  // Chuyển trang sản phẩm
  const goToNextPage = () => {
    if (currentPage < totalPages - 1) setCurrentPage(currentPage + 1);
  };

  const goToPrevPage = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };

  // Chạy slider khi component mount và dừng khi unmount
  useEffect(() => {
    startSlide();
    return () => stopSlide();
  }, []);

  // Tính giá trị transform dựa trên slide hiện tại
  const translateValue = -(currentSlide * (100 / totalSlides));

  return (
    <div className="home-wrapper">
      <div className="home-container">
        {/* Phần slider banner */}
        <div className="banner-slider" onMouseEnter={stopSlide} onMouseLeave={startSlide}>
          <div className="banner-section" style={{ transform: `translateX(${translateValue}%)` }}>
            {slides.map((slide, index) => (
              <div key={index} className="banner-slide">
                <div className="banner-content">
                  <div className="banner-left">
                    <img
                      src={slide.left}
                      alt="Banner Left"
                      onError={(e) => { e.target.src = '/default_banner.png'; console.log('Error loading:', slide.left); }}
                    />
                  </div>
                  <div className="banner-right">
                    <img
                      src={slide.right}
                      alt="Banner Right"
                      onError={(e) => { e.target.src = '/default_banner.png'; console.log('Error loading:', slide.right); }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Nút prev/next */}
          <button className="prev-slide" onClick={() => goToSlide((currentSlide - 1 + totalSlides) % totalSlides)}>
            &lt;
          </button>
          <button className="next-slide" onClick={() => goToSlide((currentSlide + 1) % totalSlides)}>
            &gt;
          </button>
          {/* Dấu gạch ngang (dots) */}
          <div className="slider-dots">
            {slides.map((_, index) => (
              <span
                key={index}
                className={`slider-dot ${currentSlide === index ? 'active' : ''}`}
                onClick={() => goToSlide(index)}
              ></span>
            ))}
          </div>
        </div>

        {/* Phần thanh công cụ navigation */}
        <div className="nav-section">
          {navItems.map((item, index) => (
            <div key={index} className="nav-item">
              <img
                src={item.icon}
                alt={item.text}
                onError={(e) => { e.target.src = '/default_icon.png'; console.log('Error loading:', item.icon); }}
              />
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Phần promo mới bên dưới nav-section */}
        <div className="promo-section">
          <div className="promo-header">
            <h2 className="promo-title">Tìm kiếm hàng đầu</h2>
            <a href="#" className="promo-see-all">Xem tất cả &gt;</a>
          </div>
          <hr className="promo-divider" />
          <div className="promo-items">
            {currentPromoItems.map((item, index) => (
              <div key={index} className="promo-item">
                <img
                  src={item.image}
                  alt={item.title}
                  onError={(e) => { e.target.src = '/default_icon.png'; console.log('Error loading:', item.image); }}
                />
                <span className="promo-item-title">{item.title}</span>
              </div>
            ))}
          </div>
          <button
            className="promo-prev"
            onClick={goToPrevPage}
            style={{ visibility: currentPage === 0 ? 'hidden' : 'visible' }}
          >
            &lt;
          </button>
          <button
            className="promo-next"
            onClick={goToNextPage}
            style={{ visibility: currentPage === totalPages - 1 ? 'hidden' : 'visible' }}
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;