import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function ProfileSetup2() {
  const navigate = useNavigate();
  const [heightUnit, setHeightUnit] = useState('cm');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [ft, setFt] = useState('');
  const [inch, setInch] = useState('');
  const [lb, setLb] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setProfileSetupStep('/profile-setup-2');
    document.title = 'Profile setup • Measurements • Calorie Canvas';

    const draft = getProfileSetupState();
    if (draft.heightUnit) setHeightUnit(draft.heightUnit);
    if (draft.weightUnit) setWeightUnit(draft.weightUnit);
    if (draft.heightCm !== undefined) setHeightCm(String(draft.heightCm));
    if (draft.weightKg !== undefined) setWeightKg(String(draft.weightKg));
    if (draft.ft !== undefined) setFt(String(draft.ft));
    if (draft.inch !== undefined) setInch(String(draft.inch));
    if (draft.lb !== undefined) setLb(String(draft.lb));

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

  const clampNum = (v) => (v ?? '').toString().trim();
  const cleanNum = (s, allowDot = true) =>
    (s ?? '').replace(allowDot ? /[^0-9.]/g : /[^0-9]/g, '');

  function cmFromImperial(feet, inches) {
    return (parseInt(feet || 0, 10) * 12 + parseFloat(inches || 0)) * 2.54;
  }

  function imperialFromCm(cm) {
    const totalInches = parseFloat(cm || 0) / 2.54;
    const feetValue = Math.floor(totalInches / 12);
    const inchesValue = totalInches - feetValue * 12;
    return { feetValue, inchesValue: Number(inchesValue.toFixed(1)) };
  }

  function kgFromLb(value) {
    return parseFloat(value || 0) * 0.45359237;
  }

  function lbFromKg(value) {
    return parseFloat(value || 0) / 0.45359237;
  }

  function onHeightUnitChange(nextUnit) {
    if (nextUnit === 'imperial' && heightUnit !== 'imperial') {
      const { feetValue, inchesValue } = imperialFromCm(heightCm || '0');
      setFt(feetValue ? String(feetValue) : '');
      setInch(inchesValue ? String(inchesValue) : '');
    }

    if (nextUnit === 'cm' && heightUnit !== 'cm') {
      const nextHeightCm = cmFromImperial(ft, inch);
      setHeightCm(nextHeightCm ? String(Number(nextHeightCm.toFixed(1))) : '');
    }

    setHeightUnit(nextUnit);
  }

  function onWeightUnitChange(nextUnit) {
    if (nextUnit === 'lb' && weightUnit !== 'lb') {
      const nextLb = lbFromKg(weightKg || '0');
      setLb(nextLb ? String(Number(nextLb.toFixed(1))) : '');
    }

    if (nextUnit === 'kg' && weightUnit !== 'kg') {
      const nextKg = kgFromLb(lb);
      setWeightKg(nextKg ? String(Number(nextKg.toFixed(1))) : '');
    }

    setWeightUnit(nextUnit);
  }

  async function onNext(e) {
    e.preventDefault();
    setMsg(null);

    const finalHeightCm = heightUnit === 'imperial'
      ? cmFromImperial(ft, inch)
      : parseFloat(clampNum(heightCm));
    const finalWeightKg = weightUnit === 'lb'
      ? kgFromLb(lb)
      : parseFloat(clampNum(weightKg));

    const h = parseFloat(clampNum(finalHeightCm));
    const w = parseFloat(clampNum(finalWeightKg));
    if (!(h > 50 && h < 300)) return setMsg('Height should be realistic (cm, e.g., 171).');
    if (!(w > 20 && w < 500)) return setMsg('Weight should be realistic.');

    setSaving(true);

    const userId = await getCurrentUserId();
    if (!userId) {
      setSaving(false);
      return setMsg('Session expired. Please log in.');
    }

    saveLocalProfile(userId, {
      height_cm: Number(finalHeightCm.toFixed(1)),
      weight_kg: Number(finalWeightKg.toFixed(1)),
    });

    if (isLocalAuth()) {
      updateProfileSetupState({
        heightUnit,
        weightUnit,
        heightCm: Number(finalHeightCm.toFixed(1)),
        weightKg: Number(finalWeightKg.toFixed(1)),
        ft,
        inch,
        lb,
        lastStep: '/profile-setup-3',
      });

      setSaving(false);
      navigate('/profile-setup-3');
      return;
    }

    const heightResponse = await fetch(`${API_BASE_URL}/add-height`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        height: Number(finalHeightCm.toFixed(1)),
        height_unit: 'cm',
      }),
    });

    if (!heightResponse.ok) {
      setSaving(false);
      return setMsg('Could not save height.');
    }

    const weightResponse = await fetch(`${API_BASE_URL}/add-weight-entry`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        weight_unit: 'kg',
        weight: Number(finalWeightKg.toFixed(1)),
      }),
    });

    if (!weightResponse.ok) {
      setSaving(false);
      return setMsg('Could not save weight.');
    }

    updateProfileSetupState({
      heightUnit,
      weightUnit,
      heightCm: Number(finalHeightCm.toFixed(1)),
      weightKg: Number(finalWeightKg.toFixed(1)),
      ft,
      inch,
      lb,
      lastStep: '/profile-setup-3',
    });

    setSaving(false);
    navigate('/profile-setup-3');
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
          <h1 className="ps-title">Measurements</h1>
          <p className="ps-sub">Enter your current stats. You can change these later.</p>

          <form onSubmit={onNext} className="ps-form">
            <div className="ps-row">
              <div className="ps-col">
                <label className="ps-label" htmlFor="heightUnit">Height</label>
                <div className="ps-row" style={{ gridTemplateColumns: '1fr auto', gap: 12 }}>
                  {heightUnit === 'cm' ? (
                    <input
                      id="heightCm"
                      className="ps-input"
                      inputMode="decimal"
                      value={heightCm}
                      onChange={(e) => setHeightCm(cleanNum(e.target.value))}
                      placeholder="e.g., 171"
                    />
                  ) : (
                    <div className="ps-row" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <input
                        className="ps-input"
                        inputMode="numeric"
                        value={ft}
                        onChange={(e) => setFt(cleanNum(e.target.value, false))}
                        placeholder="ft"
                      />
                      <input
                        className="ps-input"
                        inputMode="decimal"
                        value={inch}
                        onChange={(e) => setInch(cleanNum(e.target.value))}
                        placeholder="in"
                      />
                    </div>
                  )}

                  <select
                    id="heightUnit"
                    className="ps-input ps-select"
                    value={heightUnit}
                    onChange={(e) => onHeightUnitChange(e.target.value)}
                  >
                    <option value="cm">cm</option>
                    <option value="imperial">ft/in</option>
                  </select>
                </div>
              </div>

              <div className="ps-col">
                <label className="ps-label" htmlFor="weightUnit">Weight</label>
                <div className="ps-row" style={{ gridTemplateColumns: '1fr auto', gap: 12 }}>
                  {weightUnit === 'kg' ? (
                    <input
                      id="weightKg"
                      className="ps-input"
                      inputMode="decimal"
                      value={weightKg}
                      onChange={(e) => setWeightKg(cleanNum(e.target.value))}
                      placeholder="e.g., 72.5"
                    />
                  ) : (
                    <input
                      id="weightLb"
                      className="ps-input"
                      inputMode="decimal"
                      value={lb}
                      onChange={(e) => setLb(cleanNum(e.target.value))}
                      placeholder="e.g., 160"
                    />
                  )}

                  <select
                    id="weightUnit"
                    className="ps-input ps-select"
                    value={weightUnit}
                    onChange={(e) => onWeightUnitChange(e.target.value)}
                  >
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                </div>
              </div>
            </div>

            {msg && <p className="ps-msg">{msg}</p>}

            <div className="ps-actions">
              <a className="ps-back" href="/profile-setup">← Back</a>
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
