import React, { useState } from 'react';
import Modal from '../ui/Modal.jsx';

export default function WeightModal({ open = true, onClose, onSave }){
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('kg');

  function save(){
    const v = Number(value);
    if(Number.isNaN(v)) return;
    onSave?.({ value: v, unit });
    onClose?.();
  }

  if(!open) return null;

  return (
    <Modal title="Log weight" onClose={onClose}>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div>
          <label>Weight</label>
          <input value={value} onChange={(e)=>setValue(e.target.value)} type="number" style={{width:'100%',padding:8,borderRadius:8,border:'1px solid #ddd'}} />
        </div>
        <div>
          <label>Unit</label>
          <select value={unit} onChange={(e)=>setUnit(e.target.value)} style={{width:'100%',padding:8,borderRadius:8}}>
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'8px 12px'}}>Cancel</button>
          <button onClick={save} style={{padding:'8px 12px',background:'#4F6B50',color:'#fff',borderRadius:8}}>Save</button>
        </div>
      </div>
    </Modal>
  );
}
