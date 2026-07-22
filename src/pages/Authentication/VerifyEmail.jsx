import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../../services/authClient';
import { initializeProfileSetup } from '../../services/profileSetupProgress';
import './Login.css';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('Verifying your email...');
  const token = searchParams.get('token');

  useEffect(() => {
    document.title = 'Verify email - Calorie Canvas';
    let active = true;

    async function completeVerification() {
      if (!token) {
        setMessage('This verification link is invalid or incomplete.');
        return;
      }
      const { data, error } = await verifyEmail(token);
      if (!active) return;
      if (error) {
        setMessage(error.message);
        return;
      }
      if (data?.session) {
        initializeProfileSetup();
        navigate('/profile-setup', { replace: true });
        return;
      }
      setMessage('Email verified. Reset your password before logging in.');
    }

    completeVerification();
    return () => { active = false; };
  }, [navigate, token]);

  return (
    <main className="login-wrap">
      <div className="bg" aria-hidden="true" />
      <div className="login-grid">
        <section className="left">
          <div className="brand-block"><h1 className="brand">Calorie Canvas</h1></div>
        </section>
        <section className="card-wrap">
          <div className="frame">
            <div className="frame-img" aria-hidden="true" />
            <div className="card-inner">
              <h2 className="heading">Email verification</h2>
              <p className="msg">{message}</p>
              <div className="signup-row"><Link className="signup-link" to="/login">Go to login</Link></div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
