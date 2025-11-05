import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import './ProfileSetup.css';

export default function ProfileSetup3() {
  const IS_LOCAL =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // === measurement fields ===
  const [heightUnit, setHeightUnit] = useState('cm');
  const [weightUnit, setWeightUnit] = useState('kg');

  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [ft, setFt] = useState('');
  const [inch, setInch] = useState('');
  const [lb, setLb] = useState('');

  // === goal fields ===
  const [goal, setGoal] = useState('maintain');
  const [muscle, setMuscle] = useState('maintain');
  const [targetWeight, setTargetWeight] = useState('');
  const [targetBf, setTargetBf] = useState('');

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [checking, setChecking] = useState(true);

  // -------------------- helpers --------------------
  useEffect(() => {
    document.title = 'Profile setup • Goals • Calorie Canvas';

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

  const cleanNum = (s, allowDot = true) =>
    (s ?? '').replace(allowDot ? /[^0-9.]/g : /[^0-9]/g, '');

  function cmFromImperial(f, i) { return (parseInt(f||0)*12 + parseFloat(i||0))*2.54; }
  function imperialFromCm(cm) {
    const tIn = parseFloat(cm||0)/2.54;
    const f = Math.floor(tIn/12);
    const inch = tIn - f*12;
    return {f, inch:Number(inch.toFixed(1))};
  }
  const kgFromLb = (lb)=>parseFloat(lb||0)*0.45359237;
  const lbFromKg = (kg)=>parseFloat(kg||0)/0.45359237;

  function onHeightUnitChange(next){
    if(next==='imperial' && heightUnit!=='imperial'){
      const {f,inch}=imperialFromCm(heightCm||'0');
      setFt(f?String(f):''); setInch(inch?String(inch):'');
    }
    if(next==='cm' && heightUnit!=='cm'){
      const cm=cmFromImperial(ft,inch);
      setHeightCm(cm?String(Number(cm.toFixed(1))):'');
    }
    setHeightUnit(next);
  }
  function onWeightUnitChange(next){
    if(next==='lb' && weightUnit!=='lb'){
      const v=lbFromKg(weightKg||'0');
      setLb(v?String(Number(v.toFixed(1))):'');
    }
    if(next==='kg' && weightUnit!=='kg'){
      const v=kgFromLb(lb);
      setWeightKg(v?String(Number(v.toFixed(1))):'');
    }
    setWeightUnit(next);
  }

  // -------------------- submit --------------------
  async function onNext(e){
    e.preventDefault(); setMsg(null);

    // metric normalization
    const finalHeight = heightUnit==='imperial' ? cmFromImperial(ft,inch) : parseFloat(heightCm);
    const finalWeight = weightUnit==='lb' ? kgFromLb(lb) : parseFloat(weightKg);
    if(!(finalHeight>50 && finalHeight<300)) return setMsg('Height should be realistic.');
    if(!(finalWeight>20 && finalWeight<500)) return setMsg('Weight should be realistic.');

    const tw = targetWeight.trim(); const tb = targetBf.trim();
    const twNum = tw ? parseFloat(tw) : null;
    const tbNum = tb ? parseFloat(tb) : null;
    if (tw && !(twNum>20 && twNum<500)) return setMsg('Target weight invalid.');
    if (tb && !(tbNum>=0 && tbNum<=70)) return setMsg('Target body fat % invalid.');

    const { data:{session} } = await supabase.auth.getSession();
    if(!session && IS_LOCAL){ window.location.href='/profile-setup-4'; return; }

    setSaving(true);
    const { data:{user} } = await supabase.auth.getUser();
    if(!user){ setSaving(false); return setMsg('Session expired.'); }

    const { error } = await supabase.from('profiles').upsert({
      user_id:user.id,
      height_cm:Number(finalHeight.toFixed(1)),
      weight_kg:Number(finalWeight.toFixed(1)),
      goal_weight_intent:goal,
      goal_muscle_intent:muscle,
      target_weight_kg:tw?twNum:null,
      target_body_fat_pct:tb?tbNum:null
    },{onConflict:'user_id'});

    setSaving(false);
    if(error) return setMsg(error.message);
    window.location.href='/profile-setup-4';
  }

  if(checking){
    return(
      <main className="ps-wrap">
        <div className="ps-bg" aria-hidden="true"/>
        <div className="ps-grid"><p style={{opacity:.75}}>Checking session…</p></div>
      </main>
    );
  }

  // -------------------- render --------------------
  return(
    <main className="ps-wrap">
      <div className="ps-bg" aria-hidden="true"/>

      <div className="ps-grid">
        <section className="ps-left">
          <h1 className="ps-title">Goals</h1>
          <p className="ps-sub">Review your measurements and set your focus.</p>

          <form onSubmit={onNext} className="ps-form">
            {/* Height + Weight */}
            <div className="ps-row">
              <div className="ps-col">
                <label className="ps-label" htmlFor="height">Height</label>
                <div className="ps-row" style={{gridTemplateColumns:'1fr auto',gap:12}}>
                  {heightUnit==='cm'?(
                    <input className="ps-input" inputMode="decimal"
                      value={heightCm}
                      onChange={(e)=>setHeightCm(cleanNum(e.target.value))}
                      placeholder="cm"
                    />
                  ):(
                    <div className="ps-row" style={{gridTemplateColumns:'1fr 1fr',gap:12}}>
                      <input className="ps-input" inputMode="numeric"
                        value={ft}
                        onChange={(e)=>setFt(cleanNum(e.target.value,false))}
                        placeholder="ft"
                      />
                      <input className="ps-input" inputMode="decimal"
                        value={inch}
                        onChange={(e)=>setInch(cleanNum(e.target.value))}
                        placeholder="in"
                      />
                    </div>
                  )}
                  <select className="ps-input ps-select" value={heightUnit}
                    onChange={(e)=>onHeightUnitChange(e.target.value)}>
                    <option value="cm">cm</option>
                    <option value="imperial">ft/in</option>
                  </select>
                </div>
              </div>

              <div className="ps-col">
                <label className="ps-label" htmlFor="weight">Weight</label>
                <div className="ps-row" style={{gridTemplateColumns:'1fr auto',gap:12}}>
                  {weightUnit==='kg'?(
                    <input className="ps-input" inputMode="decimal"
                      value={weightKg}
                      onChange={(e)=>setWeightKg(cleanNum(e.target.value))}
                      placeholder="kg"
                    />
                  ):(
                    <input className="ps-input" inputMode="decimal"
                      value={lb}
                      onChange={(e)=>setLb(cleanNum(e.target.value))}
                      placeholder="lb"
                    />
                  )}
                  <select className="ps-input ps-select" value={weightUnit}
                    onChange={(e)=>onWeightUnitChange(e.target.value)}>
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Goal + Muscle */}
            <div className="ps-row">
              <div className="ps-col">
                <label className="ps-label">Weight Goal</label>
                <select className="ps-input ps-select" value={goal} onChange={(e)=>setGoal(e.target.value)}>
                  <option value="rapid_loss">Rapid Weight Loss</option>
                  <option value="normal_loss">Normal Weight Loss</option>
                  <option value="maintain">Maintain</option>
                  <option value="normal_gain">Normal Weight Gain</option>
                  <option value="rapid_gain">Rapid Weight Gain</option>
                </select>
              </div>
              <div className="ps-col">
                <label className="ps-label">Muscle</label>
                <select className="ps-input ps-select" value={muscle} onChange={(e)=>setMuscle(e.target.value)}>
                  <option value="build">Build muscle</option>
                  <option value="maintain">Maintain muscle</option>
                </select>
              </div>
            </div>

            {/* Targets */}
            <div className="ps-row">
              <div className="ps-col">
                <label className="ps-label">Target Weight (kg) — optional</label>
                <input className="ps-input" inputMode="decimal"
                  value={targetWeight}
                  onChange={(e)=>setTargetWeight(cleanNum(e.target.value))}
                  placeholder="e.g., 68"
                />
              </div>
              <div className="ps-col">
                <label className="ps-label">Target Body Fat % — optional</label>
                <input className="ps-input" inputMode="decimal"
                  value={targetBf}
                  onChange={(e)=>setTargetBf(cleanNum(e.target.value))}
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
