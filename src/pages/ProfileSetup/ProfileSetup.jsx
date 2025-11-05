import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import './ProfileSetup.css';

export default function ProfileSetup() {
  const IS_LOCAL =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const [name, setName]       = useState('');
  const [dob, setDob]         = useState(''); // ← date of birth (YYYY-MM-DD)
  const [gender, setGender]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    document.title = 'Tell us about you • Calorie Canvas';

    let unsub;
    (async () => {
      if (IS_LOCAL) { setChecking(false); return; }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) { setChecking(false); return; }

      const { data: sub } = supabase.auth.onAuthStateChange((_e, newSession) => {
        if (newSession) setChecking(false);
      });
      unsub = () => sub.subscription.unsubscribe();

      setTimeout(async () => {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (!s) window.location.replace('/login'); else setChecking(false);
      }, 400);
    })();

    return () => unsub && unsub();
  }, [IS_LOCAL]);

  function isValidDob(iso) {
    if (!iso) return true;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    return d <= today && d.getFullYear() > 1900;
  }

  async function onNext(e) {
    e.preventDefault();
    setMsg(null);

    if (!name.trim()) return setMsg('Please enter your name.');
    if (!isValidDob(dob)) return setMsg('Enter a valid date of birth.');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session && IS_LOCAL) {
      window.location.href = '/profile-setup-2';
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return setMsg('Session expired. Please log in.'); }

    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          display_name: name.trim(),
          dob: dob || null,          // save as date
          gender: gender || null,
        },
        { onConflict: 'user_id' }
      );

    setSaving(false);
    if (error) return setMsg(error.message);

    // ✅ Connect to Step 2
    window.location.href = '/profile-setup-2';
  }

  if (checking) {
    return (
      <main className="ps-wrap">
        <div className="ps-bg" aria-hidden="true" />
        <div className="ps-grid"><p style={{opacity:.75}}>Checking your session…</p></div>
      </main>
    );
  }

  return (
    <main className="ps-wrap">
      <div className="ps-bg" aria-hidden="true" />

      <div className="ps-grid">
        <section className="ps-left">
          <h1 className="ps-title">Tell Us About You</h1>
          <p className="ps-sub">
            Please enter some key details to<br /> personalize your experience.
          </p>

          <form onSubmit={onNext} className="ps-form">
            <label className="ps-label" htmlFor="name">Full Name</label>
            <input
              id="name"
              className="ps-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sarah Neelands"
              required
            />

            <div className="ps-row">
              <div className="ps-col">
                <label className="ps-label" htmlFor="dob">Date of Birth</label>
                <input
                  id="dob"
                  className="ps-input"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  required
                />
              </div>

              <div className="ps-col">
                <label className="ps-label" htmlFor="gender">Gender</label>
                <select
                  id="gender"
                  className="ps-input ps-select"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">Select…</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Non-binary</option>
                  <option>Prefer not to say</option>
                  <option>Self-describe</option>
                </select>
              </div>
            </div>

            {msg && <p className="ps-msg">{msg}</p>}

            <div className="ps-actions">
              <a className="ps-back" href="/signup">← Back</a>
              <button className="ps-next" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Next'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
