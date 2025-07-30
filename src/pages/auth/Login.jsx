// src/pages/auth/Login.jsx
import { useState, useContext } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../../components/auth/LoginForm';

function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = (email, password) => {
    // Giả lập API call
    const userData = { email, role: 'buyer' };
    const authToken = 'sample-token';
    login(userData, authToken);
    navigate('/');
  };

  return (
    <div className="login-container">
      <LoginForm onSubmit={handleLogin} />
    </div>
  );
}

export default Login;