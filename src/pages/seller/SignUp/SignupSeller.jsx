import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../../styles/SignupSeller.css';

function IntroPaint({ onDone }) {
  const [progress, setProgress] = useState(0); // 0 -> 1
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduce) {
      setProgress(1);
      setFading(true);
      const t = setTimeout(onDone, 100);
      return () => clearTimeout(t);
    }

    const dur = 1800; // thời gian lăn sơn (ms)
    const start = performance.now();
    let raf = 0;

    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      setProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setFading(true);
        setTimeout(onDone, 260); // chờ fade-out nhẹ
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  const styleVars = { '--intro-cover': (1 - progress) * 100 };

  return (
    <div className={`intro-overlay ${fading ? 'is-fading' : ''}`} style={styleVars} aria-hidden="true">
      {/* Phần chưa sơn: che nội dung phía sau */}
      <div className="intro-cover" />

      {/* Vệt sơn màu #2A93B4 */}
      <div className="intro-strip">
        <div className="intro-edge" />
      </div>

      {/* Cây lăn sơn */}
      <div className="intro-roller">
        <svg width="160" height="90" viewBox="0 0 320 180" className="roller-svg" aria-label="Paint roller">
          {/* Tay cầm */}
          <rect x="210" y="95" width="22" height="70" rx="12" fill="#333" />
          {/* Khung */}
          <path d="M220 95 L170 75 L120 75" stroke="#333" strokeWidth="10" fill="none" strokeLinecap="round" />
          {/* Ống lăn */}
          <g className="roller-wheel">
            <rect x="20" y="40" width="110" height="55" rx="14" fill="#dfe8ee" stroke="#96a8b6" strokeWidth="8"/>
            <rect x="20" y="40" width="110" height="55" rx="14" fill="#2A93B4" opacity="0.18"/>
          </g>
          {/* Sơn bám trên ống lăn */}
          <rect x="22" y="86" width="106" height="8" fill="#2A93B4" opacity="0.9"/>
        </svg>
      </div>
    </div>
  );
}

export default function SignupSeller() {
  const navigate = useNavigate();
  const [introDone, setIntroDone] = useState(false);

  const goWelcome = () => {
    // Đi thẳng sang trang Welcome, bỏ OTP
    navigate('/seller/welcome', {
      replace: false,
      state: {
        email: 'seller@example.com',
        message: 'Chào mừng bạn đến với Shopping – bắt đầu hành trình bán hàng ngay hôm nay!',
      },
    });
  };

  useEffect(() => {
    // Reveal on scroll
    const revealEls = document.querySelectorAll('.reveal');
    const ro = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            ro.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => ro.observe(el));

    // CountUp cho stats
    const nums = document.querySelectorAll('.countup');
    const format = (v, target) => {
      if (target >= 1_000_000) return Math.round(v / 1_000_000) + 'M+';
      if (target >= 1_000) return Math.round(v / 1_000) + 'K+';
      return Math.round(v);
    };
    const co = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-target') || '0', 10);
          const dur = 1400;
          const start = performance.now();
          const tick = (now) => {
            const p = Math.min((now - start) / dur, 1);
            el.textContent = format(target * p, target);
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          co.unobserve(el);
        });
      },
      { threshold: 0.4 }
    );
    nums.forEach((n) => co.observe(n));

    return () => {
      ro.disconnect();
      co.disconnect?.();
    };
  }, []);

  return (
    <div className="seller-landing">
      {/* INTRO overlay lăn sơn */}
      {!introDone && <IntroPaint onDone={() => setIntroDone(true)} />}

      {/* NAV chỉ logo */}
      <header className="sl-nav">
        <Link to="/" className="sl-logo" aria-label="Trang chủ Shopping">
          <img src="/img/iconwweb.png" alt="Shopping" />
          <span>Shopping</span>
        </Link>
      </header>

      {/* HERO */}
      <section className="sl-hero">
        {/* Floating blobs (trang trí) */}
        <div className="sl-floaters" aria-hidden="true">
          <span className="blob b1" />
          <span className="blob b2" />
          <span className="blob b3" />
        </div>

        <div className="sl-hero-inner">
          <div className="sl-hero-badge">✨ Nền tảng thương mại điện tử đa kênh</div>
          <h1 className="sl-hero-title">
            Xây dựng thương hiệu & tăng trưởng doanh số trên <span>Shopping</span>
          </h1>
          <p className="sl-hero-subtitle">
            Shopping là hệ sinh thái thương mại điện tử giúp bạn khởi tạo gian hàng nhanh chóng,
            tiếp cận khách hàng lớn, quản trị vận hành hiệu quả, và tối ưu chi phí marketing.
            Từ người bán cá nhân đến thương hiệu quy mô, mọi công cụ đều sẵn sàng cho bạn.
          </p>

          {/* Chỉ 1 CTA duy nhất */}
          <div className="sl-hero-cta">
            <button className="sl-btn cta huge" onClick={goWelcome} aria-label="Đăng ký ngay để bắt đầu">
              🚀 Đăng ký ngay
            </button>
          </div>

          {/* Marquee từ khóa */}
          <div className="sl-marquee" aria-hidden="true">
            <div className="track">
              <span>#Livestream</span><span>#FlashSale</span><span>#MãGiảmGiá</span>
              <span>#SEO</span><span>#ĐốiSoátMinhBạch</span><span>#Fulfillment</span>
              <span>#QuảngCáo</span><span>#BảoMật</span><span>#CSKH</span>
            </div>
          </div>
        </div>
      </section>

      {/* INTRO dài */}
      <section id="why" className="sl-section sl-intro reveal">
        <h2>Shopping là gì?</h2>
        <div className="sl-intro-body">
          <p>
            <strong>Shopping</strong> là nền tảng thương mại điện tử định hướng <em>tăng trưởng bền vững</em> cho Nhà Bán:
            bạn sở hữu không gian thương hiệu của riêng mình, quản lý sản phẩm – tồn kho – đơn hàng – vận chuyển trong
            một bảng điều khiển hợp nhất. Hệ thống quảng cáo, chương trình khuyến mãi và phân tích dữ liệu được thiết kế
            để dễ dùng nhưng vẫn đủ sâu để tối ưu chi phí theo từng mục tiêu.
          </p>
          <p>
            Với mạng lưới đối tác vận chuyển rộng, thanh toán an toàn, đối soát rõ ràng, Shopping giảm tối đa công việc
            thủ công để bạn tập trung vào điều quan trọng nhất: <strong>sản phẩm và khách hàng</strong>. Từ lúc mở shop
            đến khi tạo ra đơn hàng đầu tiên, trải nghiệm được “lót đường” bằng quy trình rõ ràng, tài liệu minh họa,
            và đội ngũ hỗ trợ sát cánh 24/7.
          </p>
          <p>
            Dù bạn là người bán mới hay thương hiệu đang mở rộng kênh online, Shopping cung cấp các lớp công cụ theo
            nhu cầu: từ <em>đăng bán nhanh</em>, <em>SEO sản phẩm</em>, <em>livestream</em>, <em>quản lý chiến dịch</em>,
            đến <em>data studio</em> để nhìn rõ hiệu quả &amp; biên lợi nhuận theo thời gian thực.
          </p>
        </div>
      </section>

      {/* PILLARS chi tiết */}
      <section className="sl-section sl-pillars reveal">
        <h2>Nền tảng vững chắc để bạn bứt tốc</h2>
        <div className="sl-grid-4">
          <div className="sl-card">
            <div className="sl-ico">📊</div>
            <h3>Phân tích &amp; dữ liệu</h3>
            <p>
              Dashboard theo dõi doanh số, chuyển đổi, nguồn traffic, hiệu quả chương trình.
              Báo cáo tự động giúp bạn ra quyết định nhanh và chính xác.
            </p>
          </div>
          <div className="sl-card">
            <div className="sl-ico">🧰</div>
            <h3>Marketing toolkit</h3>
            <p>
              Mã giảm giá, Flash Sale, gói Combo, quảng cáo theo từ khóa, lookalike audience
              và retargeting – đủ bộ để tăng trưởng bền vững.
            </p>
          </div>
          <div className="sl-card">
            <div className="sl-ico">🚚</div>
            <h3>Hậu cần &amp; đối soát</h3>
            <p>
              Kết nối nhiều hãng vận chuyển, COD/online payment, đối soát minh bạch.
              SLA rõ ràng, thông báo real-time ở từng chặng.
            </p>
          </div>
          <div className="sl-card">
            <div className="sl-ico">🔒</div>
            <h3>Bảo mật &amp; an toàn</h3>
            <p>
              Bảo vệ tài khoản đa lớp, phát hiện gian lận, mã hóa dữ liệu.
              Đảm bảo trải nghiệm mua sắm tin cậy cho khách hàng của bạn.
            </p>
          </div>
        </div>
      </section>

      {/* STATS với CountUp */}
      <section className="sl-section sl-stats reveal">
        <div className="sl-stats-grid">
          <div className="sl-stat">
            <div className="num countup" data-target="10000000">0</div>
            <div className="lab">Người mua hoạt động</div>
          </div>
          <div className="sl-stat">
            <div className="num countup" data-target="500000">0</div>
            <div className="lab">Nhà bán tin dùng</div>
          </div>
          <div className="sl-stat">
            <div className="num">99.9%</div>
            <div className="lab">An toàn giao dịch</div>
          </div>
          <div className="sl-stat">
            <div className="num">24/7</div>
            <div className="lab">Hỗ trợ đối tác</div>
          </div>
        </div>
      </section>

      {/* HÀNH TRÌNH BẮT ĐẦU */}
      <section className="sl-section sl-journey reveal">
        <h2>Hành trình bắt đầu bán hàng</h2>
        <ol className="sl-timeline">
          <li>
            <span className="dot">1</span>
            <h4>Tạo hồ sơ Nhà Bán</h4>
            <p>Đăng ký một chạm, xác thực cơ bản. Mọi thứ đều có hướng dẫn chi tiết.</p>
          </li>
          <li>
            <span className="dot">2</span>
            <h4>Thiết lập gian hàng</h4>
            <p>Đặt tên, tải logo, cấu hình vận chuyển &amp; thanh toán trong vài phút.</p>
          </li>
          <li>
            <span className="dot">3</span>
            <h4>Đăng sản phẩm &amp; ra mắt</h4>
            <p>SEO, nội dung, hình ảnh – công cụ hỗ trợ sẵn sàng. Bắt đầu chiến dịch đầu tiên.</p>
          </li>
        </ol>
      </section>

      {/* TESTIMONIAL */}
      <section className="sl-section sl-testimonial reveal">
        <div className="sl-quote">
          <p>
            “Chúng tôi tăng gấp 3 lần doanh số trong quý đầu trên Shopping.
            Bộ công cụ quảng cáo dễ dùng, đối soát minh bạch và hỗ trợ cực nhanh.”
          </p>
          <div className="person">
            <img src="https://i.pravatar.cc/80?img=14" alt="Chủ shop" />
            <div>
              <div className="name">Minh Anh</div>
              <div className="role">Chủ shop phụ kiện thời trang</div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="sl-footer">
        <div className="sl-footer-inner">
          <div className="text">
            © {new Date().getFullYear()} Shopping · Nền tảng thương mại điện tử dành cho mọi Nhà Bán
          </div>
        </div>
      </footer>
    </div>
  );
}
