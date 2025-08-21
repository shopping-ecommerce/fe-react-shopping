"use client"

import { useState, useEffect } from "react"
import "../../../styles/InvoiceList.css"

const InvoiceList = () => {
  const [invoices, setInvoices] = useState([])
  const [filteredInvoices, setFilteredInvoices] = useState([])
  const [activeTab, setActiveTab] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [showModal, setShowModal] = useState(false)

  // Dữ liệu mẫu hóa đơn
  const sampleInvoices = [
    {
      id: "HD001",
      customerName: "Nguyễn Văn An",
      customerPhone: "0901234567",
      orderDate: "2024-01-15",
      totalAmount: 1250000,
      status: "completed",
      items: [
        { name: "iPhone 15 Pro", quantity: 1, price: 1200000 },
        { name: "Ốp lưng iPhone", quantity: 1, price: 50000 },
      ],
      shippingAddress: "123 Nguyễn Huệ, Q1, TP.HCM",
    },
    {
      id: "HD002",
      customerName: "Trần Thị Bình",
      customerPhone: "0912345678",
      orderDate: "2024-01-16",
      totalAmount: 850000,
      status: "pending",
      items: [
        { name: "Samsung Galaxy A54", quantity: 1, price: 800000 },
        { name: "Cáp sạc USB-C", quantity: 1, price: 50000 },
      ],
      shippingAddress: "456 Lê Lợi, Q3, TP.HCM",
    },
    {
      id: "HD003",
      customerName: "Lê Minh Cường",
      customerPhone: "0923456789",
      orderDate: "2024-01-17",
      totalAmount: 2100000,
      status: "shipping",
      items: [
        { name: "MacBook Air M2", quantity: 1, price: 2000000 },
        { name: "Chuột Magic Mouse", quantity: 1, price: 100000 },
      ],
      shippingAddress: "789 Võ Văn Tần, Q3, TP.HCM",
    },
    {
      id: "HD004",
      customerName: "Phạm Thị Dung",
      customerPhone: "0934567890",
      orderDate: "2024-01-18",
      totalAmount: 450000,
      status: "cancelled",
      items: [
        { name: "Tai nghe AirPods", quantity: 1, price: 400000 },
        { name: "Hộp đựng AirPods", quantity: 1, price: 50000 },
      ],
      shippingAddress: "321 Pasteur, Q1, TP.HCM",
    },
    {
      id: "HD005",
      customerName: "Hoàng Văn Em",
      customerPhone: "0945678901",
      orderDate: "2024-01-19",
      totalAmount: 1800000,
      status: "processing",
      items: [
        { name: "iPad Pro 11 inch", quantity: 1, price: 1750000 },
        { name: "Bút Apple Pencil", quantity: 1, price: 50000 },
      ],
      shippingAddress: "654 Điện Biên Phủ, Q10, TP.HCM",
    },
  ]

  useEffect(() => {
    setInvoices(sampleInvoices)
    setFilteredInvoices(sampleInvoices)
  }, [])

  const statusTabs = [
    { key: "all", label: "Tất cả", count: invoices.length },
    { key: "pending", label: "Chờ xử lý", count: invoices.filter((inv) => inv.status === "pending").length },
    { key: "processing", label: "Đang xử lý", count: invoices.filter((inv) => inv.status === "processing").length },
    { key: "shipping", label: "Đang giao", count: invoices.filter((inv) => inv.status === "shipping").length },
    { key: "completed", label: "Hoàn thành", count: invoices.filter((inv) => inv.status === "completed").length },
    { key: "cancelled", label: "Đã hủy", count: invoices.filter((inv) => inv.status === "cancelled").length },
  ]

  const getStatusText = (status) => {
    const statusMap = {
      pending: "Chờ xử lý",
      processing: "Đang xử lý",
      shipping: "Đang giao",
      completed: "Hoàn thành",
      cancelled: "Đã hủy",
    }
    return statusMap[status] || status
  }

  const getStatusClass = (status) => {
    return `status-${status}`
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("vi-VN")
  }

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey)
    filterInvoices(tabKey, searchTerm)
  }

  const handleSearch = (term) => {
    setSearchTerm(term)
    filterInvoices(activeTab, term)
  }

  const filterInvoices = (status, search) => {
    let filtered = invoices

    if (status !== "all") {
      filtered = filtered.filter((invoice) => invoice.status === status)
    }

    if (search) {
      filtered = filtered.filter(
        (invoice) =>
          invoice.id.toLowerCase().includes(search.toLowerCase()) ||
          invoice.customerName.toLowerCase().includes(search.toLowerCase()) ||
          invoice.customerPhone.includes(search),
      )
    }

    setFilteredInvoices(filtered)
  }

  const handleViewDetails = (invoice) => {
    setSelectedInvoice(invoice)
    setShowModal(true)
  }

  const handlePrintInvoice = (invoiceId) => {
    alert(`In hóa đơn ${invoiceId}`)
  }

  const handleUpdateStatus = (invoiceId, newStatus) => {
    const updatedInvoices = invoices.map((invoice) =>
      invoice.id === invoiceId ? { ...invoice, status: newStatus } : invoice,
    )
    setInvoices(updatedInvoices)
    filterInvoices(activeTab, searchTerm)
    alert(`Đã cập nhật trạng thái hóa đơn ${invoiceId}`)
  }

  return (
    <div className="invoice-list-container">
      <div className="invoice-header">
        <h1>Quản lý hóa đơn</h1>
        <div className="header-actions">
          <button className="btn-export">Xuất Excel</button>
          <button className="btn-create">Tạo hóa đơn mới</button>
        </div>
      </div>

      <div className="invoice-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Tìm kiếm theo mã hóa đơn, tên khách hàng, số điện thoại..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>
      </div>

      <div className="status-tabs">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-button ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div className="invoice-table">
        <div className="table-header">
          <div className="col-invoice-id">Mã hóa đơn</div>
          <div className="col-customer">Khách hàng</div>
          <div className="col-date">Ngày đặt</div>
          <div className="col-amount">Tổng tiền</div>
          <div className="col-status">Trạng thái</div>
          <div className="col-actions">Thao tác</div>
        </div>

        <div className="table-body">
          {filteredInvoices.map((invoice) => (
            <div key={invoice.id} className="table-row">
              <div className="col-invoice-id">
                <strong>{invoice.id}</strong>
              </div>
              <div className="col-customer">
                <div className="customer-info">
                  <div className="customer-name">{invoice.customerName}</div>
                  <div className="customer-phone">{invoice.customerPhone}</div>
                </div>
              </div>
              <div className="col-date">{formatDate(invoice.orderDate)}</div>
              <div className="col-amount">
                <strong>{formatCurrency(invoice.totalAmount)}</strong>
              </div>
              <div className="col-status">
                <span className={`status-badge ${getStatusClass(invoice.status)}`}>
                  {getStatusText(invoice.status)}
                </span>
              </div>
              <div className="col-actions">
                <button className="btn-action btn-view" onClick={() => handleViewDetails(invoice)}>
                  Xem
                </button>
                <button className="btn-action btn-print" onClick={() => handlePrintInvoice(invoice.id)}>
                  In
                </button>
                {invoice.status === "pending" && (
                  <button
                    className="btn-action btn-process"
                    onClick={() => handleUpdateStatus(invoice.id, "processing")}
                  >
                    Xử lý
                  </button>
                )}
                {invoice.status === "processing" && (
                  <button className="btn-action btn-ship" onClick={() => handleUpdateStatus(invoice.id, "shipping")}>
                    Giao hàng
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {filteredInvoices.length === 0 && (
        <div className="empty-state">
          <p>Không tìm thấy hóa đơn nào</p>
        </div>
      )}

      {/* Modal chi tiết hóa đơn */}
      {showModal && selectedInvoice && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Chi tiết hóa đơn {selectedInvoice.id}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="invoice-details">
                <div className="detail-section">
                  <h3>Thông tin khách hàng</h3>
                  <p>
                    <strong>Tên:</strong> {selectedInvoice.customerName}
                  </p>
                  <p>
                    <strong>Số điện thoại:</strong> {selectedInvoice.customerPhone}
                  </p>
                  <p>
                    <strong>Địa chỉ giao hàng:</strong> {selectedInvoice.shippingAddress}
                  </p>
                </div>
                <div className="detail-section">
                  <h3>Thông tin đơn hàng</h3>
                  <p>
                    <strong>Ngày đặt:</strong> {formatDate(selectedInvoice.orderDate)}
                  </p>
                  <p>
                    <strong>Trạng thái:</strong>
                    <span className={`status-badge ${getStatusClass(selectedInvoice.status)}`}>
                      {getStatusText(selectedInvoice.status)}
                    </span>
                  </p>
                </div>
                <div className="detail-section">
                  <h3>Sản phẩm</h3>
                  <div className="items-list">
                    {selectedInvoice.items.map((item, index) => (
                      <div key={index} className="item-row">
                        <span className="item-name">{item.name}</span>
                        <span className="item-quantity">x{item.quantity}</span>
                        <span className="item-price">{formatCurrency(item.price)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="total-amount">
                    <strong>Tổng cộng: {formatCurrency(selectedInvoice.totalAmount)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InvoiceList
