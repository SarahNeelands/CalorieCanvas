import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false); // cosmetic for now
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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pw,
    });

    setLoading(false);
    if (error) setMsg(error.message);
    else window.location.href = '/'; // or your dashboard route
  }

  async function onForgot() {
    if (!email) return setMsg('Enter your email above first.');
    setMsg('Sending reset email…');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`, // make a simple reset page later
    });
    setMsg(error ? `Error: ${error.message}` : 'Reset link sent. Check your email.');
  }

  return (
    <main className="login-wrap">
      {/* watercolor background */}
      <div className="bg" aria-hidden="true" />

      <div className="login-grid">
        {/* Left side branding */}
        <section className="left">
          <h1 className="brand">Calorie Canvas</h1>
          <p className="tagline">
            Track your meals, exercises, and<br />
            nutrition to reach your health goals.
          </p>
        </section>

        {/* Right side framed card */}
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
                  {loading ? 'Logging in…' : 'Log in'}
                </button>
              </form>

              <button type="button" className="link-btn" onClick={onForgot}>
                Forgot password?
              </button>

              <div className="signup-row">
                <span>Don’t have an account</span>{' '}
                <a className="signup-link" href="/signup">Create one »</a>
              </div>

              {msg && <p className="msg">{msg}</p>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
