import { Outlet } from "react-router-dom";
import Header from "../components/common/Header";
import Footer from "../components/common/Footer";
import AccountSidebar from "../pages/buyer/account/AccountSidebar";
import "../styles/account.css";

export default function AccountLayout() {
  return (
    <div className="app-container">
      <Header />
      <div className="account-main">  {/* đổi main-content thành account-main */}
        <div className="account-layout"> 
          <AccountSidebar />
          <div className="account-page">
            <Outlet />
          </div>
        </div>
      </div>
      <Footer className="footer" />
    </div>
  );
}
