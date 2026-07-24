import React, { useState } from 'react';
import Modal from '../ui/Modal.jsx';
import './WeightModal.css';

export default function WeightModal({ open = true, onClose, onSave }){
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('kg');
  const [date, setDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - (now.getTimezoneOffset() * 60_000)).toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(){
    const v = Number(value);
    if(!(v > 0)) {
      setError('Enter a valid weight.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave?.({ value: v, unit, date });
      onClose?.();
    } catch (saveError) {
      setError(saveError.message || 'Weight could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  if(!open) return null;

  return (
    <Modal title="Log Weight" onClose={onClose}>
      <div className="weight-modal">
        <div className="weight-modal__field">
          <label className="weight-modal__label">Weight</label>
          <input
            className="weight-modal__input"
            value={value}
            onChange={(e)=>setValue(e.target.value)}
            type="number"
          />
        </div>
        <div className="weight-modal__field">
          <label className="weight-modal__label">Unit</label>
          <select
            className="weight-modal__select"
            value={unit}
            onChange={(e)=>setUnit(e.target.value)}
          >
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </div>
        <div className="weight-modal__field">
          <label className="weight-modal__label">Date</label>
          <div className="weight-modal__date-wrap">
            <input
              className="weight-modal__input weight-modal__input--date"
              value={date}
              onChange={(e)=>setDate(e.target.value)}
              type="date"
            />
          </div>
        </div>
        <div className="weight-modal__actions">
          {error && <div role="alert">{error}</div>}
          <button className="weight-modal__btn" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Log Weight'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
