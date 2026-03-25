import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import './ProfileSetup.css';
import { getCurrentSession, getCurrentUserId } from '../../services/authClient';
import {
  completeProfileSetup,
  getProfileSetupState,
  setProfileSetupStep,
  updateProfileSetupState,
} from '../../services/profileSetupProgress';
import { saveLocalProfile } from '../../services/profileClient';

export default function ProfileSetup4() {
  const navigate = useNavigate();
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
    setProfileSetupStep('/profile-setup-4');
    document.title = 'Profile setup • Preferences • Calorie Canvas';

    const draft = getProfileSetupState();
    setPrefs((current) => ({
      ...current,
      ...(draft.prefs || {}),
    }));

    async function checkSession() {
      const { session } = await getCurrentSession();
      if (session) {
        setChecking(false);
        return;
      }
      window.location.replace('/login');
    }

    checkSession();
  }, []);

  function toggle(key) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  async function onFinish(e) {
    e.preventDefault();
    setMsg(null);

    const { session } = await getCurrentSession();
    if (!session) return setMsg('Session expired. Please log in.');

    setSaving(true);

    const userId = await getCurrentUserId();
    if (!userId) {
      setSaving(false);
      return setMsg('Session expired. Please log in.');
    }

    const draft = getProfileSetupState();

    if (!session.local) {
      const { error } = await supabase
        .from('profiles')
        .upsert(
          {
            user_id: userId,
            pref_show_calories: prefs.show_calories,
            pref_show_macros: prefs.show_macros,
            pref_show_micros: prefs.show_micros,
            pref_show_exercise: prefs.show_exercise,
            pref_show_weight: prefs.show_weight,
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        setSaving(false);
        return setMsg(error.message);
      }
    }

    saveLocalProfile(userId, {
      display_name: draft.name || null,
      dob: draft.dob || null,
      gender: draft.gender || null,
      height_cm: draft.heightCm ?? null,
      weight_kg: draft.weightKg ?? null,
      activity_level: draft.activityLevel || 'sedentary',
      goal_weight_intent: draft.goal || 'maintain',
      goal_muscle_intent: draft.muscle || 'maintain',
      target_weight_kg: draft.targetWeight ? Number(draft.targetWeight) : null,
      target_body_fat_pct: draft.targetBf ? Number(draft.targetBf) : null,
      pref_show_calories: prefs.show_calories,
      pref_show_macros: prefs.show_macros,
      pref_show_micros: prefs.show_micros,
      pref_show_exercise: prefs.show_exercise,
      pref_show_weight: prefs.show_weight,
    });

    updateProfileSetupState({ prefs, completed: true });
    completeProfileSetup();
    setSaving(false);
    navigate('/');
  }

  if (checking) {
    return (
      <main className="ps-wrap">
        <div className="ps-bg" aria-hidden="true" />
        <div className="ps-grid"><p style={{ opacity: 0.75 }}>Checking your session…</p></div>
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

          <form onSubmit={onFinish} className="ps-form" style={{ gap: 18 }}>
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
