import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProfileSetup.css';
import { getCurrentUserId } from '../../services/authClient';
import {
  completeProfileSetupPersisted,
  completeProfileSetup,
  getProfileSetupState,
  setProfileSetupStep,
  updateProfileSetupState,
} from '../../services/profileSetupProgress';
import { getCachedProfile, updateProfile } from '../../services/profileClient';

export default function ProfileSetup4() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState({
    show_calories: true,
    show_macros: true,
    show_micros: false,
    show_usuals: true,
    show_exercise: true,
    show_weight: true,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setProfileSetupStep('/profile-setup-4');
    document.title = 'Profile setup - Preferences - Calorie Canvas';

    const draft = getProfileSetupState();
    setPrefs((current) => ({
      ...current,
      ...(draft.prefs || {}),
    }));
  }, []);

  function toggle(key) {
    setPrefs((current) => ({ ...current, [key]: !current[key] }));
  }

  async function onFinish(e) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);

    const userId = await getCurrentUserId();
    if (!userId) {
      setSaving(false);
      return setMsg('Session expired. Please log in.');
    }

    try {
      await updateProfile({
        ...(getCachedProfile(userId) || {}),
        pref_show_calories: prefs.show_calories,
        pref_show_macros: prefs.show_macros,
        pref_show_micros: prefs.show_micros,
        pref_show_usuals: prefs.show_usuals,
        pref_show_exercise: prefs.show_exercise,
        pref_show_weight: prefs.show_weight,
      }, userId);
    } catch (error) {
      setSaving(false);
      return setMsg(error.message);
    }

    updateProfileSetupState({ prefs, completed: true, lastStep: null });
    completeProfileSetup();

    try {
      await completeProfileSetupPersisted(userId);
    } catch (error) {
      updateProfileSetupState({ completed: false, lastStep: '/profile-setup-4' });
      setSaving(false);
      return setMsg(error.message);
    }

    setSaving(false);
    navigate('/');
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
                checked={prefs.show_usuals}
                onChange={() => toggle('show_usuals')}
              />
              <span>My Usuals</span>
            </label>

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
              <a className="ps-back" href="/profile-setup-3">&larr; Back</a>
              <button className="ps-next" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Finish Setup'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
