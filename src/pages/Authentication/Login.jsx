import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import './Login.css';
import { isLocalAuth } from '../../config/runtime';
import { signIn } from '../../services/authClient';
import { getProfileSetupResumePath } from '../../services/profileSetupProgress';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    document.title = 'Log in • Calorie Canvas';
    window.scrollTo(0, 0);
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const { error } = await signIn({ email, password: pw });

    setLoading(false);
    if (error) setMsg(error.message);
    else navigate(getProfileSetupResumePath() || '/', { replace: true });
  }

  async function onForgot() {
    if (isLocalAuth()) {
      setMsg('Password reset is only wired for Supabase right now.');
      return;
    }

    if (!email) return setMsg('Enter your email above first.');
    setMsg('Sending reset email...');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    });
    setMsg(error ? `Error: ${error.message}` : 'Reset link sent. Check your email.');
  }

  return (
    <main className="login-wrap">
      <div className="bg" aria-hidden="true" />

      <div className="login-grid">
        <section className="left">
          <div className="brand-block">
            <h1 className="brand">Calorie Canvas</h1>
            <p className="tagline">
              Track your meals, exercises, and
              <br />
              nutrition to reach your health goals.
            </p>
          </div>
        </section>

        <section className="card-wrap">
          <div className="frame">
            <div className="frame-img" aria-hidden="true" />
            <div className="card-inner">
              <h2 className="heading">Log in</h2>

              <form onSubmit={onSubmit} className="form">
                <label className="label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <label className="label" htmlFor="password">Password</label>
                <div className="password-row">
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    className="input"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="show-btn"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>

                <label className="remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>

                <button className="submit" type="submit" disabled={loading}>
                  {loading ? 'Logging in...' : 'Log in'}
                </button>
              </form>

              <button type="button" className="link-btn" onClick={onForgot}>
                Forgot password?
              </button>

              <div className="signup-row">
                <span>Don&apos;t have an account</span>{' '}
                <Link className="signup-link" to="/signup">Create one »</Link>
              </div>

              {msg && <p className="msg">{msg}</p>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
