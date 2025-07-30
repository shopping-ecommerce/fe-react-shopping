import { useState, useContext } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import SignupForm from '../../components/auth/SignupForm';

function Signup() {
  const navigate = useNavigate();

  const handleSignup = () => {
    navigate('/otp-verification');
  };

  return (
    <div className="signup-container">
      <SignupForm onSubmit={handleSignup} />
    </div>
  );
}

export default Signup;