import { CRow, CCol, CCard, CCardBody, CCardHeader } from "@coreui/react";
import { placehold } from '../../utils/placehold'; // chỉnh đường dẫn cho đúng

// ... dùng như trên


export default function AdminDashboard() {
  return (
    <CRow>
      <CCol xs={12} md={6} xl={3}>
        <CCard className="mb-4">
          <CCardHeader>Đơn hàng hôm nay</CCardHeader>
          <CCardBody style={{ fontSize: 28, fontWeight: 700 }}>152</CCardBody>
        </CCard>
      </CCol>
      <CCol xs={12} md={6} xl={3}>
        <CCard className="mb-4">
          <CCardHeader>Doanh thu</CCardHeader>
          <CCardBody style={{ fontSize: 28, fontWeight: 700 }}>18.2 triệu</CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
}
placehold.co