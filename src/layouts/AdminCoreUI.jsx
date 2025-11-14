import React, { useEffect, useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import {
  CContainer,
  CHeader,
  CHeaderBrand,
  CSidebar,
  CSidebarBrand,
  CSidebarNav,
  CNavItem,
} from "@coreui/react";
import CIcon from "@coreui/icons-react";
import { cilSpeedometer, cilTags } from "@coreui/icons";

// NẠP CSS động để tránh ảnh hưởng trang buyer/seller
export default function AdminCoreUI() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // CSS chỉ được nạp khi vào /admin
    import("bootstrap/dist/css/bootstrap.min.css");
    import("@coreui/coreui/dist/css/coreui.min.css");
  }, []);

  return (
    <div className="bg-light min-vh-100 d-flex">
      {/* Sidebar */}
      <CSidebar
        visible={visible}
        onVisibleChange={(v) => setVisible(v)}
        className="border-end"
        unfoldable
      >
        <CSidebarBrand className="d-none d-md-flex px-3 py-3">
          Admin Panel
        </CSidebarBrand>

        <CSidebarNav>
          <CNavItem component={NavLink} to="/admin" end>
            <CIcon icon={cilSpeedometer} className="me-2" />
            Dashboard
          </CNavItem>

          <CNavItem component={NavLink} to="/admin/categories">
            <CIcon icon={cilTags} className="me-2" />
            Danh mục
          </CNavItem>

          {/* Ví dụ thêm menu:
          <CNavItem component={NavLink} to="/admin/products">
            <CIcon icon={cilTags} className="me-2" />
            Sản phẩm
          </CNavItem>
          */}
        </CSidebarNav>
      </CSidebar>

      {/* Content */}
      <div className="wrapper d-flex flex-column w-100">
        <CHeader className="border-bottom bg-white">
          <CHeaderBrand className="mx-2">Quản trị</CHeaderBrand>
        </CHeader>

        <CContainer className="flex-grow-1 py-3">
          <Outlet />
        </CContainer>
      </div>
    </div>
  );
}
