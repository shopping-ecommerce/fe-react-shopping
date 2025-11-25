// src/pages/common/EventsPage.jsx
import React from "react";

// 👉 Bạn chỉ cần sửa đường dẫn ảnh + text ở đây là đủ
const EVENT_BANNERS = [
  {
    id: 1,
    title: "Săn deal giờ vàng",
    subtitle: "Giảm sâu trong khung giờ 20:00 - 22:00 mỗi ngày",
    left: "/img/cartBaner1.jpg", // dùng lại ảnh giống Home hoặc thay ảnh riêng
    right: "/img/cartBaner2.png",
    tag: "Đang diễn ra",
  },
  {
    id: 2,
    title: "Tuần lễ thương hiệu",
    subtitle: "Ưu đãi lớn cho các thương hiệu đối tác",
    left: "/img/cartbaner3.png",
    right: "/img/cartbaner4.png",
    tag: "Sắp diễn ra",
  },
  {
    id: 3,
    title: "Siêu hội hoàn xu",
    subtitle: "Hoàn xu cho đơn hàng đủ điều kiện",
    left: "/img/cartbaner5.png",
    right: "/img/cartbaner6.png",
    tag: "Đang diễn ra",
  },
];

const CURRENT_EVENTS = [
  {
    id: 1,
    title: "🎉 Flash Sale cuối tháng",
    time: "25/11 - 30/11",
    desc: "Giảm giá đến 50% cho các sản phẩm thời trang, giày dép và phụ kiện.",
    note: "Số lượng có hạn, áp dụng cho đơn từ 300.000₫.",
  },
  {
    id: 2,
    title: "🎁 Tặng voucher cho thành viên mới",
    time: "Áp dụng toàn thời gian",
    desc: "Thành viên mới nhận voucher giảm 30.000₫ cho đơn đầu tiên.",
    note: "Áp dụng cho đơn từ 199.000₫ trở lên.",
  },
];

const UPCOMING_EVENTS = [
  {
    id: 1,
    title: "🔥 Siêu sale 12.12",
    time: "Diễn ra ngày 12/12",
    desc: "Đồng loạt giảm giá trên toàn sàn, cộng thêm nhiều voucher độc quyền.",
  },
  {
    id: 2,
    title: "💳 Hoàn tiền khi thanh toán ví điện tử",
    time: "Dự kiến: 15/12 - 20/12",
    desc: "Hoàn một phần giá trị đơn hàng khi thanh toán qua ví liên kết.",
  },
];

const PAST_EVENTS = [
  {
    id: 1,
    title: "✅ Sale 11.11 - Kết thúc",
    time: "Đã diễn ra: 11/11",
    desc: "Chương trình đã kết thúc. Cảm ơn bạn đã tham gia!",
  },
];

const EventsPage = () => {
  return (
    <div
      className="events-page"
      style={{
        padding: "24px 16px 40px",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <header
        style={{
          marginBottom: 24,
          padding: "16px 20px",
          borderRadius: 12,
          background:
            "linear-gradient(135deg, rgba(255,116,116,0.08), rgba(255,184,0,0.12))",
          border: "1px solid rgba(0,0,0,0.05)",
          textAlign: "center", // 👈 căn giữa nội dung
          marginLeft: -35,
        }}
      >
        <div
          style={{
            maxWidth: 720, // 👈 cho đoạn text không bị quá dài
            margin: "0 auto",
          }}
        >
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Thông báo & Sự kiện
          </h1>
        </div>
      </header>

      {/* Banner giống Home nhưng có thêm nội dung */}
      <section className="section-card" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 12,
            gap: 12,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Sự kiện nổi bật
            </h2>
            <p style={{ margin: 0, color: "#666", fontSize: 14 }}></p>
          </div>
        </div>

        <div
          className="events-banner-grid"
          style={{
            display: "grid",
            gap: 16,
          }}
        >
          {EVENT_BANNERS.map((b) => (
            <article
              key={b.id}
              className="events-banner-card"
              style={{
                borderRadius: 12,
                border: "1px solid #eee",
                padding: 12,
                background: "#fff",
                boxShadow: "0 2px 6px rgba(15,23,42,0.03)",
              }}
            >
              {/* Ảnh banner trái/phải giống Home */}
              <div
                className="events-banner-images"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 1.4fr",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <div
                  className="events-banner-left"
                  style={{
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "#f3f4f6",
                  }}
                >
                  <img
                    src={b.left}
                    alt={b.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
                <div
                  className="events-banner-right"
                  style={{
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "#f3f4f6",
                  }}
                >
                  <img
                    src={b.right}
                    alt={b.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
              </div>

              {/* Text mô tả banner */}
              <div
                className="events-banner-info"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    {b.title}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "#555",
                    }}
                  >
                    {b.subtitle}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background:
                      b.tag === "Đang diễn ra"
                        ? "rgba(34,197,94,0.08)"
                        : "rgba(59,130,246,0.08)",
                    color: b.tag === "Đang diễn ra" ? "#16a34a" : "#2563eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  {b.tag}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Sự kiện đang diễn ra */}
      <section className="section-card" style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          Sự kiện đang diễn ra
        </h2>
        <div
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          {CURRENT_EVENTS.map((e) => (
            <article
              key={e.id}
              style={{
                borderRadius: 10,
                border: "1px solid #eee",
                padding: 12,
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 4,
                  flexWrap: "wrap",
                }}
              >
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  {e.title}
                </h3>
                <span
                  style={{
                    fontSize: 12,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: "rgba(34,197,94,0.08)",
                    color: "#16a34a",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.time}
                </span>
              </div>
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: 14,
                  color: "#555",
                }}
              >
                {e.desc}
              </p>
              {e.note && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "#6b7280",
                  }}
                >
                  Ghi chú: {e.note}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* Sắp diễn ra + đã kết thúc: 2 cột */}
      <section
        className="section-card"
        style={{
          display: "grid",
          gap: 20,
          gridTemplateColumns: "minmax(0,1.1fr) minmax(0,0.9fr)",
        }}
      >
        {/* Sắp diễn ra */}
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            Sự kiện sắp diễn ra
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            {UPCOMING_EVENTS.map((e) => (
              <article
                key={e.id}
                style={{
                  borderRadius: 10,
                  border: "1px solid #eee",
                  padding: 10,
                  background: "#fafafa",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 4,
                  }}
                >
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      margin: 0,
                    }}
                  >
                    {e.title}
                  </h3>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: "rgba(59,130,246,0.08)",
                      color: "#2563eb",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {e.time}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#555",
                  }}
                >
                  {e.desc}
                </p>
              </article>
            ))}
          </div>
        </div>

        {/* Đã kết thúc */}
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            Sự kiện đã kết thúc
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            {PAST_EVENTS.map((e) => (
              <article
                key={e.id}
                style={{
                  borderRadius: 10,
                  border: "1px solid #eee",
                  padding: 10,
                  background: "#f9fafb",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 3,
                  }}
                >
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      margin: 0,
                    }}
                  >
                    {e.title}
                  </h3>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: "rgba(148,163,184,0.15)",
                      color: "#475569",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {e.time}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  {e.desc}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default EventsPage;
