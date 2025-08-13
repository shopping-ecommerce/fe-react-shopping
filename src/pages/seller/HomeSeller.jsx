import React from "react";
import "../../styles/SellerHome.css";

export default function HomeSeller() {
  const steps = [
    {
      title: "Tài khoản & thông tin cửa hàng",
      status: "Hoàn thành!",
      done: true,
    },
    {
      title: "Địa chỉ kho hàng",
      status: "Vui lòng cung cấp địa chỉ kho lấy và trả hàng",
      done: false,
      highlight: true,
    },
    {
      title: "Giấy tờ pháp lý",
      status: "Hoàn thành!",
      done: true,
    },
    {
      title: "Kích hoạt hồ sơ",
      status: "Hoàn thành!",
      done: true,
    },
    {
      title: "Tài khoản ngân hàng",
      status: "",
      done: false,
    },
  ];

  return (
    <div className="seller-home-container">
      <div className="seller-progress">
        <h2>
          Hồ sơ nhà bán đã hoàn thành{" "}
          <span className="progress-badge">60%</span>
        </h2>
      </div>

      <div className="seller-steps">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`seller-step-card ${
              step.highlight ? "highlight" : ""
            } ${step.done ? "done" : ""}`}
          >
            <div className="icon-circle">
              {step.done ? "✔" : "🏛"}
            </div>
            <h4>{step.title}</h4>
            <p className="status-text">{step.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
