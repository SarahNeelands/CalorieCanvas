import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import './ProfileSetup.css';
import { getCurrentSession, getCurrentUserId } from '../../services/authClient';
import {
  getProfileSetupState,
  setProfileSetupStep,
  updateProfileSetupState,
} from '../../services/profileSetupProgress';
import { saveLocalProfile } from '../../services/profileClient';

export default function ProfileSetup3() {
  const activityOptions = [
    {
      value: 'sedentary',
      label: 'Sedentary',
      help: 'Mostly sitting with minimal exercise.',
    },
    {
      value: 'lightly_active',
      label: 'Lightly active',
      help: 'Light exercise 1 to 3 times per week.',
    },
    {
      value: 'moderately_active',
      label: 'Moderately active',
      help: 'Moderate exercise 3 to 5 times per week.',
    },
    {
      value: 'very_active',
      label: 'Very active',
      help: 'Hard exercise 6 to 7 times per week.',
    },
    {
      value: 'athlete',
      label: 'Athlete-level',
      help: 'Intense training or high-volume activity most days.',
    },
  ];
  const [heightUnit, setHeightUnit] = useState('cm');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [ft, setFt] = useState('');
  const [inch, setInch] = useState('');
  const [lb, setLb] = useState('');
  const [goal, setGoal] = useState('maintain');
  const [muscle, setMuscle] = useState('maintain');
  const [activityLevel, setActivityLevel] = useState('sedentary');
  const [targetWeight, setTargetWeight] = useState('');
  const [targetWeightUnit, setTargetWeightUnit] = useState('kg');
  const [targetBf, setTargetBf] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setProfileSetupStep('/profile-setup-3');
    document.title = 'Profile setup • Goals • Calorie Canvas';

    const draft = getProfileSetupState();
    if (draft.heightUnit) setHeightUnit(draft.heightUnit);
    if (draft.weightUnit) setWeightUnit(draft.weightUnit);
    if (draft.heightCm !== undefined) setHeightCm(String(draft.heightCm));
    if (draft.weightKg !== undefined) setWeightKg(String(draft.weightKg));
    if (draft.ft !== undefined) setFt(String(draft.ft));
    if (draft.inch !== undefined) setInch(String(draft.inch));
    if (draft.lb !== undefined) setLb(String(draft.lb));
    if (draft.goal) setGoal(draft.goal);
    if (draft.muscle) setMuscle(draft.muscle);
    if (draft.activityLevel) setActivityLevel(draft.activityLevel);
    if (draft.targetWeight !== undefined) setTargetWeight(String(draft.targetWeight ?? ''));
    if (draft.targetWeightUnit) setTargetWeightUnit(draft.targetWeightUnit);
    if (draft.targetBf !== undefined) setTargetBf(String(draft.targetBf ?? ''));

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

  const cleanNum = (s, allowDot = true) =>
    (s ?? '').replace(allowDot ? /[^0-9.]/g : /[^0-9]/g, '');

  function cmFromImperial(f, i) {
    return (parseInt(f || 0, 10) * 12 + parseFloat(i || 0)) * 2.54;
  }

  function imperialFromCm(cm) {
    const totalInches = parseFloat(cm || 0) / 2.54;
    const feetValue = Math.floor(totalInches / 12);
    const inchesValue = totalInches - feetValue * 12;
    return { feetValue, inchesValue: Number(inchesValue.toFixed(1)) };
  }

  const kgFromLb = (value) => parseFloat(value || 0) * 0.45359237;
  const lbFromKg = (value) => parseFloat(value || 0) / 0.45359237;

  function onHeightUnitChange(nextUnit) {
    if (nextUnit === 'imperial' && heightUnit !== 'imperial') {
      const { feetValue, inchesValue } = imperialFromCm(heightCm || '0');
      setFt(feetValue ? String(feetValue) : '');
      setInch(inchesValue ? String(inchesValue) : '');
    }
    if (nextUnit === 'cm' && heightUnit !== 'cm') {
      const cm = cmFromImperial(ft, inch);
      setHeightCm(cm ? String(Number(cm.toFixed(1))) : '');
    }
    setHeightUnit(nextUnit);
  }

  function onWeightUnitChange(nextUnit) {
    if (nextUnit === 'lb' && weightUnit !== 'lb') {
      const value = lbFromKg(weightKg || '0');
      setLb(value ? String(Number(value.toFixed(1))) : '');
    }
    if (nextUnit === 'kg' && weightUnit !== 'kg') {
      const value = kgFromLb(lb);
      setWeightKg(value ? String(Number(value.toFixed(1))) : '');
    }
    setWeightUnit(nextUnit);
  }

  function onTargetWeightUnitChange(nextUnit) {
    if (nextUnit === targetWeightUnit) return;

    if (targetWeight) {
      const numericValue = parseFloat(targetWeight);
      if (Number.isFinite(numericValue)) {
        const convertedValue = nextUnit === 'lb'
          ? lbFromKg(numericValue)
          : kgFromLb(numericValue);
        setTargetWeight(String(Number(convertedValue.toFixed(1))));
      }
    }

    setTargetWeightUnit(nextUnit);
  }

  async function onNext(e) {
    e.preventDefault();
    setMsg(null);

    const finalHeight = heightUnit === 'imperial' ? cmFromImperial(ft, inch) : parseFloat(heightCm);
    const finalWeight = weightUnit === 'lb' ? kgFromLb(lb) : parseFloat(weightKg);
    if (!(finalHeight > 50 && finalHeight < 300)) return setMsg('Height should be realistic.');
    if (!(finalWeight > 20 && finalWeight < 500)) return setMsg('Weight should be realistic.');

    const tw = targetWeight.trim();
    const tb = targetBf.trim();
    const twNum = tw
      ? (targetWeightUnit === 'lb' ? kgFromLb(parseFloat(tw)) : parseFloat(tw))
      : null;
    const tbNum = tb ? parseFloat(tb) : null;
    if (tw && !(twNum > 20 && twNum < 500)) return setMsg('Target weight invalid.');
    if (tb && !(tbNum >= 0 && tbNum <= 70)) return setMsg('Target body fat % invalid.');

    const { session } = await getCurrentSession();
    if (!session) return setMsg('Session expired.');

    setSaving(true);
    const userId = await getCurrentUserId();
    if (!userId) {
      setSaving(false);
      return setMsg('Session expired.');
    }

    saveLocalProfile(userId, {
      height_cm: Number(finalHeight.toFixed(1)),
      weight_kg: Number(finalWeight.toFixed(1)),
      activity_level: activityLevel || 'sedentary',
      goal_weight_intent: goal,
      goal_muscle_intent: muscle,
      target_weight_kg: tw ? twNum : null,
      target_body_fat_pct: tb ? tbNum : null,
    });

    if (!session.local) {
      const { error } = await supabase.from('profiles').upsert({
        user_id: userId,
        height_cm: Number(finalHeight.toFixed(1)),
        weight_kg: Number(finalWeight.toFixed(1)),
        activity_level: activityLevel || 'sedentary',
        goal_weight_intent: goal,
        goal_muscle_intent: muscle,
        target_weight_kg: tw ? twNum : null,
        target_body_fat_pct: tb ? tbNum : null,
      }, { onConflict: 'user_id' });

      if (error) {
        setSaving(false);
        return setMsg(error.message);
      }
    }

    updateProfileSetupState({
      heightUnit,
      weightUnit,
      heightCm: Number(finalHeight.toFixed(1)),
      weightKg: Number(finalWeight.toFixed(1)),
      ft,
      inch,
      lb,
      goal,
      muscle,
      activityLevel: activityLevel || 'sedentary',
      targetWeight: tw,
      targetWeightUnit,
      targetBf: tb,
      lastStep: '/profile-setup-4',
    });

    setSaving(false);
    window.location.href = '/profile-setup-4';
  }

  if (checking) {
    return (
      <main className="ps-wrap">
        <div className="ps-bg" aria-hidden="true" />
        <div className="ps-grid"><p style={{ opacity: 0.75 }}>Checking session…</p></div>
      </main>
    );
  }

  return (
    <main className="ps-wrap">
      <div className="ps-bg" aria-hidden="true" />

      <div className="ps-grid">
        <section className="ps-left">
          <h1 className="ps-title">Goals</h1>
          <p className="ps-sub">Review your measurements and set your focus.</p>

          <form onSubmit={onNext} className="ps-form">
            <div className="ps-row">
              <div className="ps-col">
                <label className="ps-label" htmlFor="height">Height</label>
                <div className="ps-row" style={{ gridTemplateColumns: '1fr auto', gap: 12 }}>
                  {heightUnit === 'cm' ? (
                    <input
                      className="ps-input"
                      inputMode="decimal"
                      value={heightCm}
                      onChange={(e) => setHeightCm(cleanNum(e.target.value))}
                      placeholder="cm"
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
                <label className="ps-label" htmlFor="weight">Weight</label>
                <div className="ps-row" style={{ gridTemplateColumns: '1fr auto', gap: 12 }}>
                  {weightUnit === 'kg' ? (
                    <input
                      className="ps-input"
                      inputMode="decimal"
                      value={weightKg}
                      onChange={(e) => setWeightKg(cleanNum(e.target.value))}
                      placeholder="kg"
                    />
                  ) : (
                    <input
                      className="ps-input"
                      inputMode="decimal"
                      value={lb}
                      onChange={(e) => setLb(cleanNum(e.target.value))}
                      placeholder="lb"
                    />
                  )}
                  <select
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

            <div className="ps-row">
              <div className="ps-col">
                <label className="ps-label">Weight Goal</label>
                <select className="ps-input ps-select" value={goal} onChange={(e) => setGoal(e.target.value)}>
                  <option value="rapid_loss">Rapid Weight Loss</option>
                  <option value="normal_loss">Normal Weight Loss</option>
                  <option value="maintain">Maintain</option>
                  <option value="normal_gain">Normal Weight Gain</option>
                  <option value="rapid_gain">Rapid Weight Gain</option>
                </select>
              </div>
              <div className="ps-col">
                <label className="ps-label">Muscle</label>
                <select className="ps-input ps-select" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
                  <option value="build">Build muscle</option>
                  <option value="maintain">Maintain muscle</option>
                </select>
              </div>
            </div>

            <div className="ps-col">
              <label className="ps-label ps-label-help" htmlFor="activityLevel">
                <span>Activity Level</span>
                <span className="ps-help" tabIndex={0} aria-label="Activity level guide">
                  ?
                  <span className="ps-tooltip">
                    {activityOptions.map((option) => (
                      <span key={option.value} className="ps-tooltip-line">
                        <strong>{option.label}:</strong> {option.help}
                      </span>
                    ))}
                  </span>
                </span>
              </label>
              <select
                id="activityLevel"
                className="ps-input ps-select"
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value || 'sedentary')}
              >
                {activityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="ps-row">
              <div className="ps-col">
                <label className="ps-label">Target Weight - optional</label>
                <div className="ps-row" style={{ gridTemplateColumns: '1fr auto', gap: 12 }}>
                  <input
                    className="ps-input"
                    inputMode="decimal"
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(cleanNum(e.target.value))}
                    placeholder={targetWeightUnit === 'lb' ? 'e.g., 150' : 'e.g., 68'}
                  />
                  <select
                    className="ps-input ps-select"
                    value={targetWeightUnit}
                    onChange={(e) => onTargetWeightUnitChange(e.target.value)}
                  >
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                </div>
              </div>
              <div className="ps-col">
                <label className="ps-label">Target Body Fat % - optional</label>
                <input
                  className="ps-input"
                  inputMode="decimal"
                  value={targetBf}
                  onChange={(e) => setTargetBf(cleanNum(e.target.value))}
                  placeholder="e.g., 22"
                />
              </div>
            </div>

            {msg && <p className="ps-msg">{msg}</p>}

            <div className="ps-actions">
              <a className="ps-back" href="/profile-setup-2">← Back</a>
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
