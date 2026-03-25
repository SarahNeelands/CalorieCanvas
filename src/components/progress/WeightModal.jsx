import React, { useState } from 'react';
import Modal from '../ui/Modal.jsx';
import './WeightModal.css';

export default function WeightModal({ open = true, onClose, onSave }){
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('kg');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  function save(){
    const v = Number(value);
    if(Number.isNaN(v)) return;
    onSave?.({ value: v, unit, date });
    onClose?.();
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
          <button className="weight-modal__btn" onClick={save}>Log Weight</button>
        </div>
      </div>
    </Modal>
  );
}
