import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/backbutton.css';

const BackButton = ({ to, className = '', position = 'left' }) => {
  const navigate = useNavigate();

  const handleClick = (e) => {
    e.preventDefault();
    if (!to) {
      navigate(-1);
    } else {
      navigate(to);
    }
  };

  return (
    <div className={`back-button-wrapper ${position}-position`}>
      {to ? (
        <Link to={to} className={`curved-back-button ${className}`} onClick={handleClick}>
          <div className="back-button-content">
            <svg width="40" height="30" viewBox="0 0 40 30" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5L4 15L12 25" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 15C4 15 15 15 25 15C35 15 35 25 35 25" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </Link>
      ) : (
        <button className={`curved-back-button ${className}`} onClick={handleClick}>
          <div className="back-button-content">
            <svg width="40" height="30" viewBox="0 0 40 30" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5L4 15L12 25" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 15C4 15 15 15 25 15C35 15 35 25 35 25" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="back-text">Quay lại</span>
          </div>
        </button>
      )}
    </div>
  );
};

export default BackButton;