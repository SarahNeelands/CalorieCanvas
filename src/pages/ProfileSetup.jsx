import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import './ProfileSetup.css';

export default function ProfileSetup() {
    
  const [name, setName]     = useState('');
  const [age, setAge]       = useState('');
  const [gender, setGender] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState(null);

  useEffect(() => {
    document.title = 'Tell us about you • Calorie Canvas';
    (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) window.location.href = '/login';
    })();
  }, []);

  async function onNext(e) {
    e.preventDefault();
    setMsg(null);

    // light validation
    if (!name.trim()) return setMsg('Please enter your name.');
    if (age && (+age < 0 || +age > 120)) return setMsg('Enter a valid age.');

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    // upsert into profiles (make sure your table has these columns)
    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          display_name: name.trim(),
          age: age ? +age : null,
          gender: gender || null
        },
        { onConflict: 'user_id' }
      );

    setSaving(false);
    if (error) return setMsg(error.message);

    // continue to the next step of your wizard
    window.location.href = '/profile-setup-2';   // change to your next page
  }

  return (
    <main className="ps-wrap">
      <div className="ps-bg" aria-hidden="true" />

      <div className="ps-grid">
        <section className="ps-left">
          <h1 className="ps-title">Tell Us About You</h1>
          <p className="ps-sub">
            Please enter some key details to<br/> personalize your experience.
          </p>

          <form onSubmit={onNext} className="ps-form">
            <label className="ps-label" htmlFor="name">Name</label>
            <input
              id="name"
              className="ps-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sarah"
              required
            />

            <div className="ps-row">
              <div className="ps-col">
                <label className="ps-label" htmlFor="age">Age</label>
                <input
                  id="age"
                  className="ps-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={age}
                  onChange={(e) => setAge(e.target.value.replace(/\D/g,''))}
                  placeholder="e.g., 21"
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
