import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import './styles/header.css'; // Import CSS
import './styles/reset.css'; // Import CSS
import './styles/global.css'; // Import CSS
import './styles/login.css'; // Import CSS
import './styles/sidebar.css'; // Import CSS for Sidebar
import './styles/footer.css'; // Import CSS for Footer
import './styles/home.css'; // Import CSS for Home

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);