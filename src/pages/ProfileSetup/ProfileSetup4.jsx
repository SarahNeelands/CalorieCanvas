import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import './ProfileSetup.css';

export default function ProfileSetup4() {
  const IS_LOCAL =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const [prefs, setPrefs] = useState({
    show_calories: true,
    show_macros: true,
    show_micros: false,
    show_exercise: true,
    show_weight: true,
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    document.title = 'Profile setup • Preferences • Calorie Canvas';

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

  function toggle(key) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  async function onFinish(e) {
    e.preventDefault();
    setMsg(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session && IS_LOCAL) {
      window.location.href = '/';
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
          pref_show_calories: prefs.show_calories,
          pref_show_macros:   prefs.show_macros,
          pref_show_micros:   prefs.show_micros,
          pref_show_exercise: prefs.show_exercise,
          pref_show_weight:   prefs.show_weight,
        },
        { onConflict: 'user_id' }
      );

    setSaving(false);
    if (error) return setMsg(error.message);

    window.location.href = '/';
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
          <h1 className="ps-title">Features / Preferences</h1>
          <p className="ps-sub">Choose which modules to show in your dashboard. You can change these anytime.</p>

          <form onSubmit={onFinish} className="ps-form" style={{gap:18}}>
            <label className="ps-label">Modules</label>

            <label className="remember">
              <input
                type="checkbox"
                checked={prefs.show_calories}
                onChange={() => toggle('show_calories')}
              />
              <span>Calories</span>
            </label>

            <label className="remember">
              <input
                type="checkbox"
                checked={prefs.show_macros}
                onChange={() => toggle('show_macros')}
              />
              <span>Macros</span>
            </label>

            <label className="remember">
              <input
                type="checkbox"
                checked={prefs.show_micros}
                onChange={() => toggle('show_micros')}
              />
              <span>Micros</span>
            </label>

            <label className="remember">
              <input
                type="checkbox"
                checked={prefs.show_exercise}
                onChange={() => toggle('show_exercise')}
              />
              <span>Exercise</span>
            </label>

            <label className="remember">
              <input
                type="checkbox"
                checked={prefs.show_weight}
                onChange={() => toggle('show_weight')}
              />
              <span>Weight tracking</span>
            </label>

            {msg && <p className="ps-msg">{msg}</p>}

            <div className="ps-actions">
              <a className="ps-back" href="/profile-setup-3">← Back</a>
              <button className="ps-next" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Finish Setup'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
