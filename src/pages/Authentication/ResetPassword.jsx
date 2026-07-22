import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../../services/authClient';
import './Login.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const token = searchParams.get('token');

  useEffect(() => {
    document.title = 'Reset password - Calorie Canvas';
    window.scrollTo(0, 0);
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    if (!token) return setMessage('This password reset link is invalid or incomplete.');
    if (password.length < 8) return setMessage('Password must be at least 8 characters.');
    if (password !== confirmation) return setMessage('Passwords do not match.');

    setLoading(true);
    setMessage(null);
    const { data, error } = await resetPassword({ token, password });
    setLoading(false);
    if (error) return setMessage(error.message);
    if (data?.session) {
      navigate('/', { replace: true });
      return;
    }
    setMessage('Password updated. Verify your email if needed, then log in.');
  }

  return (
    <main className="login-wrap">
      <div className="bg" aria-hidden="true" />
      <div className="login-grid">
        <section className="left">
          <div className="brand-block">
            <h1 className="brand">Calorie Canvas</h1>
            <p className="tagline">Choose a new password for your account.</p>
          </div>
        </section>
        <section className="card-wrap">
          <div className="frame">
            <div className="frame-img" aria-hidden="true" />
            <div className="card-inner">
              <h2 className="heading">Reset password</h2>
              <form onSubmit={onSubmit} className="form">
                <label className="label" htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  className="input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
                <label className="label" htmlFor="confirm-password">Confirm password</label>
                <input
                  id="confirm-password"
                  className="input"
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button className="submit" type="submit" disabled={loading || !token}>
                  {loading ? 'Updating...' : 'Update password'}
                </button>
              </form>
              <div className="signup-row"><Link className="signup-link" to="/login">Back to login</Link></div>
              {message && <p className="msg">{message}</p>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
