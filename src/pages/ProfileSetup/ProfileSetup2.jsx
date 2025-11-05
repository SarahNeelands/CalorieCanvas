import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import './ProfileSetup.css';

export default function ProfileSetup2() {
  const IS_LOCAL =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // units
  const [heightUnit, setHeightUnit] = useState('cm'); // 'cm' | 'imperial'
  const [weightUnit, setWeightUnit] = useState('kg'); // 'kg' | 'lb'

  // metric storage (what we’ll write to DB)
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');

  // imperial UI fields (derived)
  const [ft, setFt] = useState('');
  const [inch, setInch] = useState('');
  const [lb, setLb] = useState('');

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    document.title = 'Profile setup • Measurements • Calorie Canvas';

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

  // helpers
  const clampNum = (v) => (v ?? '').toString().trim();
  const cleanNum = (s, allowDot = true) =>
    (s ?? '').replace(allowDot ? /[^0-9.]/g : /[^0-9]/g, '');

  function cmFromImperial(feetStr, inchStr) {
    const f = parseInt(feetStr || '0', 10);
    const i = parseFloat(inchStr || '0');
    return (f * 12 + i) * 2.54;
  }
  function kgFromLb(lbStr) {
    const v = parseFloat(lbStr || '0');
    return v * 0.45359237;
  }
  function lbFromKg(kgStr) {
    const v = parseFloat(kgStr || '0');
    return v / 0.45359237;
  }
  function imperialFromCm(cmStr) {
    const cm = parseFloat(cmStr || '0');
    const totalIn = cm / 2.54;
    const f = Math.floor(totalIn / 12);
    const i = totalIn - f * 12;
    return { f, i: Number(i.toFixed(1)) };
  }

  // sync UI when unit toggles switch
  function onHeightUnitChange(next) {
    if (next === 'imperial' && heightUnit !== 'imperial') {
      // convert cm -> ft/in into UI fields
      const { f, i } = imperialFromCm(heightCm || '0');
      setFt(f ? String(f) : '');
      setInch(i ? String(i) : '');
    }
    if (next === 'cm' && heightUnit !== 'cm') {
      // convert ft/in -> cm into base field
      const cm = cmFromImperial(ft, inch);
      setHeightCm(cm ? String(Number(cm.toFixed(1))) : '');
    }
    setHeightUnit(next);
  }

  function onWeightUnitChange(next) {
    if (next === 'lb' && weightUnit !== 'lb') {
      // convert kg -> lb into UI
      const v = lbFromKg(weightKg || '0');
      setLb(v ? String(Number(v.toFixed(1))) : '');
    }
    if (next === 'kg' && weightUnit !== 'kg') {
      // convert lb -> kg into base
      const v = kgFromLb(lb);
      setWeightKg(v ? String(Number(v.toFixed(1))) : '');
    }
    setWeightUnit(next);
  }

  async function onNext(e) {
    e.preventDefault();
    setMsg(null);

    // finalize metric numbers from whichever UI is active
    let finalHeightCm = heightCm;
    let finalWeightKg = weightKg;

    if (heightUnit === 'imperial') {
      finalHeightCm = cmFromImperial(ft, inch);
    }
    if (weightUnit === 'lb') {
      finalWeightKg = kgFromLb(lb);
    }

    // validate
    const h = parseFloat(clampNum(finalHeightCm));
    const w = parseFloat(clampNum(finalWeightKg));
    if (!(h > 50 && h < 300))  return setMsg('Height should be realistic (cm, e.g., 171).');
    if (!(w > 20 && w < 500))  return setMsg('Weight should be realistic (kg, e.g., 72.5).');

    // Localhost preview without a session: skip DB write
    const { data: { session } } = await supabase.auth.getSession();
    if (!session && IS_LOCAL) {
      window.location.href = '/profile-setup-3'; // connect to Step 3
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
          height_cm: Number(h.toFixed(1)),
          weight_kg: Number(w.toFixed(1)),
        },
        { onConflict: 'user_id' }
      );

    setSaving(false);
    if (error) return setMsg(error.message);

    window.location.href = '/profile-setup-3';
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
          <h1 className="ps-title">Measurements</h1>
          <p className="ps-sub">Enter your current stats. You can change these later.</p>

          <form onSubmit={onNext} className="ps-form">
            {/* Height */}
            <div className="ps-row">
              <div className="ps-col">
                <label className="ps-label" htmlFor="heightUnit">Height</label>
                <div className="ps-row" style={{gridTemplateColumns:'1fr auto', gap:12}}>
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
                    <div className="ps-row" style={{gridTemplateColumns:'1fr 1fr', gap:12}}>
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

              {/* Weight */}
              <div className="ps-col">
                <label className="ps-label" htmlFor="weightUnit">Weight</label>
                <div className="ps-row" style={{gridTemplateColumns:'1fr auto', gap:12}}>
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
