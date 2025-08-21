import React from "react";
import { NavLink } from "react-router-dom";
import "../../../styles/SellerLegal.css"; // style riêng cho màn legal

export default function ProfileLegal() {
  const [fileFront, setFileFront] = React.useState(null);
  const [fileBack, setFileBack] = React.useState(null);
  const [fileFace, setFileFace] = React.useState(null);
  const [frontURL, setFrontURL] = React.useState(null);
  const [backURL, setBackURL] = React.useState(null);
  const [faceURL, setFaceURL] = React.useState(null);
  // --- State cho địa chỉ ---
  const [vnTree, setVnTree] = React.useState([]); // full data (tỉnh -> quận -> phường)
  const [province, setProvince] = React.useState(null); // { code, name, ... }
  const [district, setDistrict] = React.useState(null); // { code, name, ... }
  const [ward, setWard] = React.useState(null); // { code, name, ... }
  const [addressLine, setAddressLine] = React.useState("");
  function pickFile(e, setFile, setUrl) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setUrl(url);
  }

  // tải dữ liệu tỉnh/quận/phường
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("https://provinces.open-api.vn/api/?depth=3");
        const data = await res.json();
        setVnTree(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Load provinces failed:", e);
      }
    })();
  }, []);

  // các list phụ thuộc
  const provinces = vnTree;
  const districts = React.useMemo(() => {
    if (!province) return [];
    const p = vnTree.find((x) => x.code === province.code);
    return p?.districts || [];
  }, [vnTree, province]);

  const wards = React.useMemo(() => {
    if (!district) return [];
    const d = districts.find((x) => x.code === district.code);
    return d?.wards || [];
  }, [districts, district]);

  // handlers
  const handleProvinceChange = (code) => {
    const p = provinces.find((x) => String(x.code) === String(code));
    setProvince(p || null);
    setDistrict(null);
    setWard(null);
  };
  const handleDistrictChange = (code) => {
    const d = districts.find((x) => String(x.code) === String(code));
    setDistrict(d || null);
    setWard(null);
  };
  const handleWardChange = (code) => {
    const w = wards.find((x) => String(x.code) === String(code));
    setWard(w || null);
  };
  return (
    <div className="sp-page">
      {/* Header giống profile, bỏ nút lịch sử */}
      <div className="sp-header">
        <div className="sp-breadcrumb">
          <NavLink to="/seller/home" className="sp-crumb-link">
            Trang chủ
          </NavLink>
          <span className="sp-crumb-sep">/</span>
          <NavLink to="/seller/profile" className="sp-crumb-link">
            Hồ sơ nhà bán
          </NavLink>
          <span className="sp-crumb-sep">/</span>
          <span className="sp-crumb-current">Giấy tờ pháp lý</span>
        </div>

        <div className="sp-head-row">
          <h1 className="sp-title">Giấy tờ pháp lý</h1>
        </div>
      </div>

      {/* Section trắng chứa toàn bộ nội dung */}
      <div className="sp-section">
        <div className="sp-section-head">
          <h2>Giấy tờ tùy thân</h2>
        </div>
        <div className="sp-subdesc">
          Cung cấp Giấy tờ tùy thân (Chứng minh nhân dân, Căn cước công dân hoặc
          Hộ chiếu) để xác thực thông tin cá nhân.
        </div>

        {/* Lưới 2 cột: trái form – phải ghi chú + upload */}
        <div className="legal-grid">
          {/* Cột trái */}
          <div className="legal-left">
            {/* Loại giấy tờ */}
            <div className="form-row">
              <label>Loại giấy tờ tùy thân</label>
              <div className="control">
                <select defaultValue="cccd">
                  <option value="cccd">CMND/CCCD</option>
                  <option value="passport">Hộ chiếu</option>
                  <option value="id">Giấy tờ khác</option>
                </select>
              </div>
            </div>

            {/* Số giấy tờ */}
            <div className="form-row">
              <label>Số giấy tờ tùy thân</label>
              <div className="control">
                <input type="text" placeholder="XXXXXXXXX" />
              </div>
            </div>

            {/* MST cá nhân */}
            <div className="form-row">
              <label>
                Mã số thuế thu nhập cá nhân
                <span
                  className="hint"
                  title="Điền mã số thuế thu nhập cá nhân của bạn"
                >
                  ⓘ
                </span>
              </label>
              <div className="control">
                <input type="text" placeholder="XXXXXXXXX" />
              </div>
            </div>

            {/* Họ và tên */}
            <div className="form-row">
              <label>Họ và tên</label>
              <div className="control">
                <input type="text" defaultValue="Nguyễn Quốc Thái" />
              </div>
            </div>

            {/* Email */}
            <div className="form-row">
              <label>Email</label>
              <div className="control">
                <input
                  type="email"
                  defaultValue="nguyenquocthai001005@gmail.com"
                />
              </div>
            </div>
          </div>

          {/* Cột phải */}
          <div className="legal-right">
            {/* Lưu ý */}
            <div className="tip-box">
              <div className="tip-title">Lưu ý</div>
              <ul>
                <li>Giấy tờ tùy thân phải là bản gốc và còn hiệu lực.</li>
                <li>
                  Cần chụp ảnh chân dung của Nhà Bán cùng với mặt trước của giấy
                  tờ tùy thân. Đảm bảo khuôn mặt, chữ và giấy tờ nằm gọn trong
                  khung hình.
                  <button className="link-inline" type="button">
                    Xem ảnh chụp mẫu
                  </button>
                </li>
              </ul>
            </div>

            <div className="upload-grid">
              {/* Mặt trước */}
              <label className={`upload-card ${frontURL ? "has-image" : ""}`}>
                <input
                  type="file"
                  className="u-input"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => pickFile(e, setFileFront, setFrontURL)}
                />
                {frontURL ? (
                  <img src={frontURL} alt="Mặt trước" className="preview" />
                ) : (
                  <>
                    <span className="plus">+</span>
                    <span className="utitle">
                      Tải lên mặt trước giấy tờ tùy thân
                    </span>
                  </>
                )}
              </label>

              {/* Mặt sau */}
              <label className={`upload-card ${backURL ? "has-image" : ""}`}>
                <input
                  type="file"
                  className="u-input"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => pickFile(e, setFileBack, setBackURL)}
                />
                {backURL ? (
                  <img src={backURL} alt="Mặt sau" className="preview" />
                ) : (
                  <>
                    <span className="plus">+</span>
                    <span className="utitle">
                      Tải lên mặt sau giấy tờ tùy thân
                    </span>
                  </>
                )}
              </label>

              {/* Ảnh chân dung cầm giấy */}
              <label
                className={`upload-card tall ${faceURL ? "has-image" : ""}`}
              >
                <input
                  type="file"
                  className="u-input"
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => pickFile(e, setFileFace, setFaceURL)}
                />
                {faceURL ? (
                  <img src={faceURL} alt="Ảnh chân dung" className="preview" />
                ) : (
                  <>
                    <span className="plus">+</span>
                    <span className="utitle">
                      Tải ảnh chụp chân dung có cầm giấy tờ tùy thân trước mặt
                    </span>
                  </>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* ===== ĐỊA CHỈ KINH DOANH ===== */}
        <div className="addr-block">
          <div className="addr-head">Địa chỉ kinh doanh</div>
          <p className="addr-desc">
            Hệ thống sẽ xuất hoá đơn theo địa chỉ này.
          </p>

          {/* Tỉnh/TP + Quận/Huyện */}
          <div className="row-2">
            <div className="form-row">
              <label>Tỉnh/Thành phố</label>
              <div className="control">
                <select
                  value={province?.code || ""}
                  onChange={(e) => handleProvinceChange(e.target.value)}
                  disabled={!provinces.length} // khoá khi chưa load xong
                >
                  <option value="" disabled>
                    Chọn
                  </option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <label>Quận/Huyện</label>
              <div className="control">
                <select
                  value={district?.code || ""}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  disabled={!province}
                >
                  <option value="" disabled>
                    Chọn
                  </option>
                  {districts.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Phường/Xã + Địa chỉ chi tiết */}
          <div className="row-2">
            <div className="form-row">
              <label>Phường/Xã</label>
              <div className="control">
                <select
                  value={ward?.code || ""}
                  onChange={(e) => handleWardChange(e.target.value)}
                  disabled={!district}
                >
                  <option value="" disabled>
                    Chọn
                  </option>
                  {wards.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <label>Địa chỉ</label>
              <div className="control">
                <input
                  type="text"
                  placeholder="Nhập địa chỉ (số nhà, đường...)"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* (tuỳ chọn) hiển thị chuỗi địa chỉ đã chọn */}
          {/* <div className="addr-preview">
    {[
      addressLine,
      ward?.name,
      district?.name,
      province?.name
    ].filter(Boolean).join(", ")}
  </div> */}
        </div>
        {/* ===== /ĐỊA CHỈ KINH DOANH ===== */}

        {/* ===== LỊCH SỬ CHẤP NHẬN ĐIỀU KHOẢN ===== */}
        <div className="terms-section">
          <div className="terms-head">
            <h2>Lịch sử chấp nhận Điều khoản sử dụng</h2>
          </div>

          <div className="terms-table-wrap">
            <table className="terms-table">
              <thead>
                <tr>
                  <th>Phiên bản Chính sách và Điều khoản</th>
                  <th>Người đã đồng ý</th>
                  <th>Thời gian & địa điểm (Địa chỉ IP máy tính)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <a href="#" className="terms-link">
                      Tiki_Dieu khoan su dung san_01-07-2027
                    </a>
                  </td>
                  <td>
                    Nguyễn Quốc Thái
                    <br />
                    <span className="muted">
                      nguyenquocthai001005@gmail.com
                    </span>
                  </td>
                  <td>
                    12/08/2025 23:00:03
                    <br />
                    <span className="muted">(tại 171.250.9.138)</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Dòng xác nhận – tách xa ra, nền cùng màu trang, text lock, link vẫn click */}
        <div className="terms-ack">
          <input type="checkbox" defaultChecked disabled />
          <span className="ack-text">
            Bằng việc ấn chọn và gửi hồ sơ, Nhà Bán xác nhận đã đọc và đồng ý
            với{" "}
            <a href="#" className="terms-inline-link">
              Chính sách và điều khoản của Tiki
            </a>
            .
          </span>
        </div>
        {/* ===== FOOTER ACTION BAR ===== */}
        <div className="legal-footer">
          <div className="lf-actions">
            <button type="button" className="lf-btn outline">
              Quay lại
            </button>
            <button type="button" className="lf-btn outline">
              Lưu nháp
            </button>
            <button type="button" className="lf-btn primary">
              Gửi hồ sơ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
