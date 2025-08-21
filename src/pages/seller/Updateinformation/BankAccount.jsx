// src/pages/seller/BankAccount.jsx
import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import "../../../styles/SellerBank.css";

export default function BankAccount() {
  // ======= state danh mục từ API =======
  const [banks, setBanks] = useState([]);         // từ vietqr
  const [provinces, setProvinces] = useState([]); // từ provinces.open-api
  const [loading, setLoading] = useState(true);

  // fallback nếu call API lỗi (để form vẫn dùng được)
  const fallbackBanks = useMemo(
    () => [
      { code: "VCB", shortName: "Vietcombank", name: "Ngân hàng TMCP Ngoại Thương Việt Nam" },
      { code: "CTG", shortName: "VietinBank", name: "Ngân hàng TMCP Công Thương Việt Nam" },
      { code: "BIDV", shortName: "BIDV", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam" },
      { code: "TCB", shortName: "Techcombank", name: "Ngân hàng TMCP Kỹ thương Việt Nam" },
      { code: "MBB", shortName: "MB Bank", name: "Ngân hàng TMCP Quân đội" },
    ],
    []
  );

  const fallbackProvinces = useMemo(
    () => [
      { code: "79", name: "TP. Hồ Chí Minh" },
      { code: "01", name: "Hà Nội" },
      { code: "48", name: "Đà Nẵng" },
    ],
    []
  );

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        // banks
        const b = await fetch("https://api.vietqr.io/v2/banks", { cache: "no-store" }).then(r => r.json());
        // provinces
        const p = await fetch("https://provinces.open-api.vn/api/?depth=1", { cache: "no-store" }).then(r => r.json());

        if (!alive) return;

        const bankData = Array.isArray(b?.data) ? b.data : [];
        setBanks(bankData);

        const provData = Array.isArray(p) ? p.map(x => ({ code: x.code, name: x.name })) : [];
        // sort theo ABC
        provData.sort((a, b) => a.name.localeCompare(b.name, "vi"));
        setProvinces(provData);
      } catch (e) {
        // dùng fallback
        setBanks(fallbackBanks);
        setProvinces(fallbackProvinces);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [fallbackBanks, fallbackProvinces]);

  // ======= state form =======
  const [form, setForm] = useState({
    province: "",
    bankCode: "",
    branch: "",
    accountName: "",
    accountNumber: "",
  });

  const onChange = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const onSave = () => {
    if (
      !form.province ||
      !form.bankCode ||
      !form.branch ||
      !form.accountName ||
      !form.accountNumber
    ) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc.");
      return;
    }
    // TODO: gọi API lưu
    console.log("Payload gửi server:", form);
    alert("Đã lưu thông tin tài khoản ngân hàng!");
  };

  // lấy tên hiển thị ngân hàng theo bankCode
  const bankLabel = (b) =>
    b.shortName ? `${b.shortName} (${b.code || ""})` : b.name || b.code;

  return (
    <div className="sp-page">
      {/* HEADER */}
      <div className="sp-header">
        <div className="sp-breadcrumb">
          <NavLink to="/seller/home" className="sp-crumb-link">Trang chủ</NavLink>
          <span className="sp-crumb-sep">/</span>
          <NavLink to="/seller/profile" className="sp-crumb-link">Hồ sơ nhà bán</NavLink>
          <span className="sp-crumb-sep">/</span>
          <span className="sp-crumb-current">Tài khoản ngân hàng</span>
        </div>

        <div className="sp-head-row">
          <h1 className="sp-title">Tài khoản ngân hàng</h1>

          <div className="bkp-pill">
            <span className="i">i</span>
            <strong>Kỳ thanh toán Thường (Local)</strong>&nbsp;2 lần/ tháng
          </div>
        </div>

        <p className="bkp-sub">Cung cấp tài khoản ngân hàng để nhận doanh thu từ nền tảng.</p>
      </div>

      {/* SECTION FORM */}
      <div className="sp-section bkp-section">
        <div className="bkp-grid">
          {/* Tỉnh/Thành phố */}
          <div className="form-row">
            <label>Tỉnh/Thành phố</label>
            <div className="control">
              <select value={form.province} onChange={onChange("province")} disabled={loading}>
                <option value="" disabled>Chọn</option>
                {(provinces.length ? provinces : fallbackProvinces).map((p) => (
                  <option key={p.code} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tên ngân hàng */}
          <div className="form-row">
            <label>Tên ngân hàng</label>
            <div className="control">
              <select value={form.bankCode} onChange={onChange("bankCode")} disabled={loading}>
                <option value="" disabled>Chọn</option>
                {(banks.length ? banks : fallbackBanks)
                  .sort((a, b) => bankLabel(a).localeCompare(bankLabel(b), "vi"))
                  .map((b) => (
                    <option key={b.code || b.bin || b.shortName} value={b.code || b.shortName}>
                      {bankLabel(b)}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Chi nhánh ngân hàng (free text + datalist gợi ý nếu bạn có dataset) */}
          <div className="form-row">
            <label>Chi nhánh ngân hàng</label>
            <div className="control">
              <input
                list="branch-list"
                type="text"
                placeholder="Nhập chi nhánh (VD: CN Quận 1)"
                value={form.branch}
                onChange={onChange("branch")}
              />
              {/* Nếu có dữ liệu gợi ý, đổ vào đây */}
              <datalist id="branch-list">
                {/* <option value="Chi nhánh Quận 1" />
                <option value="Chi nhánh Tân Bình" /> */}
              </datalist>
            </div>
          </div>

          {/* Tên tài khoản ngân hàng */}
          <div className="form-row">
            <label>Tên tài khoản ngân hàng</label>
            <div className="control">
              <input
                type="text"
                placeholder="VD: NGUYEN VAN A"
                value={form.accountName}
                onChange={onChange("accountName")}
              />
            </div>
          </div>

          {/* Số tài khoản */}
          <div className="form-row">
            <label>Số tài khoản</label>
            <div className="control">
              <input
                type="text"
                placeholder="Nhập số tài khoản"
                value={form.accountNumber}
                onChange={onChange("accountNumber")}
              />
            </div>
          </div>
        </div>

        <div className="bkp-actions">
          <button className="sp-btn ghost" onClick={() => window.history.back()}>Quay lại</button>
          <button className="sp-btn outline" onClick={() => alert("Đã lưu nháp!")}>Lưu nháp</button>
          <button className="sp-btn primary" onClick={onSave}>Lưu thông tin</button>
        </div>
      </div>
    </div>
  );
}
