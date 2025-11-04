import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './Login.css'; // reuse the same styles + background

export default function Signup() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    document.title = 'Create account • Calorie Canvas';
    window.scrollTo(0, 0);
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(null);

    if (!email || !pw) return setMsg('Please enter email and password.');
    if (pw.length < 6) return setMsg('Password must be at least 6 characters.');
    if (pw !== pw2) return setMsg('Passwords do not match.');

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password: pw,
      options: {
        emailRedirectTo: `${window.location.origin}/profile-setup`,
      },
    });

    setLoading(false);

    if (error) return setMsg(error.message);

    // If email confirmations are disabled, we might already have a session:
    if (data?.session) {
      window.location.href = '/profile-setup';
    } else {
      // Confirmations ON: user must click the email link to continue.
      setMsg('Check your email to confirm your account. After confirming, you’ll be redirected to profile setup.');
    }
  }

  return (
    <main className="login-wrap">
      <div className="bg" aria-hidden="true" />

      <div className="login-grid">
        <section className="left">
          <h1 className="brand">Calorie Canvas</h1>
          <p className="tagline">
            Track your meals, exercises, and<br />
            nutrition to reach your health goals.
          </p>
        </section>

        <section className="card-wrap">
          <div className="frame">
            <div className="frame-img" aria-hidden="true" />
            <div className="card-inner">
              <h2 className="heading">Create account</h2>

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

                <label className="label" htmlFor="password2">Confirm password</label>
                <input
                  id="password2"
                  type={showPw ? 'text' : 'password'}
                  className="input"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  required
                />

                <button className="submit" type="submit" disabled={loading}>
                  {loading ? 'Creating…' : 'Create account'}
                </button>
              </form>

              <div className="signup-row">
                <span>Already have an account?</span>{' '}
                <a className="signup-link" href="/login">Log in »</a>
              </div>

              {msg && <p className="msg">{msg}</p>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
