import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import './ProfileSetup.css';
import { API_BASE_URL } from '../../config/api';
import { getCurrentSession, getCurrentUserId } from '../../services/authClient';
import { isLocalAuth } from '../../config/runtime';
import {
  getProfileSetupState,
  setProfileSetupStep,
  updateProfileSetupState,
} from '../../services/profileSetupProgress';
import { saveLocalProfile } from '../../services/profileClient';

export default function ProfileSetup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setProfileSetupStep('/profile-setup');
    document.title = 'Tell us about you • Calorie Canvas';

    const draft = getProfileSetupState();
    if (draft.name) setName(draft.name);
    if (draft.dob) setDob(draft.dob);
    if (draft.gender) setGender(draft.gender);

    async function createProfile() {
      const userId = await getCurrentUserId();
      if (!userId && !isLocalAuth()) {
        window.location.replace('/login');
        return;
      }

      if (!userId) return;

      localStorage.setItem('user_id', userId);

      if (isLocalAuth()) {
        return;
      }

      await fetch(`${API_BASE_URL}/create_profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId }),
      });
    }

    async function checkSession() {
      const { session } = await getCurrentSession();
      if (session) {
        setChecking(false);
        return;
      }
      window.location.replace('/login');
    }

    createProfile();
    checkSession();
  }, []);

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

    const nextState = {
      name: name.trim(),
      dob: dob || null,
      gender: gender || null,
      lastStep: '/profile-setup-2',
    };

    const userId = await getCurrentUserId();
    if (userId) {
      saveLocalProfile(userId, {
        display_name: name.trim(),
        dob: dob || null,
        gender: gender || null,
      });
    }

    const { session } = await getCurrentSession();
    if (!session && isLocalAuth()) {
      updateProfileSetupState(nextState);
      navigate('/profile-setup-2');
      return;
    }

    setSaving(true);

    if (isLocalAuth()) {
      updateProfileSetupState(nextState);
      setSaving(false);
      navigate('/profile-setup-2');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return setMsg('Session expired. Please log in.');
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          display_name: name.trim(),
          dob: dob || null,
          gender: gender || null,
        },
        { onConflict: 'user_id' }
      );

    setSaving(false);
    if (error) return setMsg(error.message);

    updateProfileSetupState(nextState);
    navigate('/profile-setup-2');
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
              placeholder="Username"
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
