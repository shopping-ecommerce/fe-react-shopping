import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../styles/SellerHome.css";
import { useNavigate } from "react-router-dom";

export default function HomeSeller() {
  const navigate = useNavigate(); // ✅ khai báo trong component

  const steps = useMemo(
    () => [
      {
        title: "Tài khoản & thông tin cửa hàng",
        status: "Hoàn thành!",
        done: true,
        go: "/seller/profile", // đường dẫn khi click
      },
      {
        title: "Địa chỉ kho hàng",
        status: "Vui lòng cung cấp địa chỉ kho lấy và trả hàng",
        done: false,
        highlight: true,
      },
      { title: "Giấy tờ pháp lý", status: "Hoàn thành!", done: true },
      { title: "Kích hoạt hồ sơ", status: "Hoàn thành!", done: true },
      { title: "Tài khoản ngân hàng", status: "", done: false },
    ],
    []
  );

  // ----- Slides / banner -----
  const slides = useMemo(
    () => [
      {
        id: "warehouse",
        tag: "Cung cấp",
        h1: "Địa chỉ kho lấy và",
        h2: "trả hàng",
        sub: "Vui lòng điền địa chỉ kho của bạn để tránh gây chậm trễ trong quá trình lấy hàng!",
        cta: "Thêm kho hàng",
      },
      {
        id: "create",
        tag: "Tạo sản phẩm",
        h1: "Bán hàng ngay hôm nay!",
        h2: "",
        sub: "Cửa hàng của bạn đã sẵn sàng để nhận những đơn hàng đầu tiên! Hãy bắt đầu tạo sản phẩm nào!",
        cta: "Tạo sản phẩm",
      },
    ],
    []
  );
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  const next = () => setIdx((i) => (i + 1) % slides.length);
  const prev = () => setIdx((i) => (i - 1 + slides.length) % slides.length);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(next, 3000);
    return () => clearInterval(timerRef.current);
  }, [paused, slides.length]);

  return (
    <div className="seller-home-container">
      {/* Header progress */}
      <div className="seller-progress">
        <h2>
          Hồ sơ nhà bán đã hoàn thành{" "}
          <span className="progress-badge">60%</span>
        </h2>
      </div>

    
      {/* Steps */}
      <div className="seller-steps">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`seller-step-card ${step.highlight ? "highlight" : ""} ${step.done ? "done" : ""} ${step.go ? "clickable" : ""}`}
            onClick={() => step.go && navigate(step.go)}
            role={step.go ? "button" : undefined}
            tabIndex={step.go ? 0 : undefined}
          >
            <div className="icon-circle">{step.done ? "✔" : "🏛"}</div>
            <h4>{step.title}</h4>
            <p className="status-text">{step.status}</p>
          </div>
        ))}
      </div>

      {/* Carousel banner */}
      <div
        className="seller-carousel"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <button
          className="sc-arrow sc-arrow--left"
          onClick={prev}
          aria-label="Trước"
        >
          ‹
        </button>

        <div className="sc-viewport">
  <div
    className="sc-track"
    style={{ transform: `translateX(-${idx * 100}%)` }}
  >
    {slides.map((s) => (
      <div key={s.id} className={`sc-slide sc-${s.id}`}>
        {/* Minh họa bên trái */}
        <div className="sc-art" aria-hidden />

        {/* Nội dung 2 cột: trái (tag + headline), phải (sub + CTA) */}
        <div className="sc-content">
          <div className="sc-left">
            <div className="sc-tag">{s.tag}</div>
            <h3 className="sc-headline">
              <span className="line1">{s.h1}</span>
              {s.h2 && <span className="line2">{s.h2}</span>}
            </h3>
          </div>

          <div className="sc-right">
            <p className="sc-sub">{s.sub}</p>
            <button className="sc-cta">{s.cta}</button>
          </div>
        </div>
      </div>
    ))}
  </div>
</div>


        <button
          className="sc-arrow sc-arrow--right"
          onClick={next}
          aria-label="Tiếp"
        >
          ›
        </button>

        <div className="sc-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={`dot ${i === idx ? "active" : ""}`}
              onClick={() => setIdx(i)}
              aria-label={`Tới slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
