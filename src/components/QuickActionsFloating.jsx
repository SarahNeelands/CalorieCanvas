import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './QuickActions.css';
import addIcon from './images/addIcon.png';

export default function QuickActionsFloating(){
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(()=>{
    function onDoc(e){ if(!ref.current) return; if(!ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('pointerdown', onDoc);
    return ()=> document.removeEventListener('pointerdown', onDoc);
  },[]);

  return (
    <div className="qa-floating" ref={ref}>
      <button className="qa-floating-btn" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(s=>!s)}>
        <img src={addIcon} alt="Quick actions" />
      </button>

      {open && (
        <div className="qa-floating-menu" role="menu">
          <button className="qa-floating-item" onClick={()=>{ setOpen(false); navigate('/meals', {state:{openLogMeal:true}}); }}>Log Meal</button>
          <button className="qa-floating-item" onClick={()=>{ setOpen(false); navigate('/exercises', {state:{openLog:true}}); }}>Log Exercise</button>
          <button className="qa-floating-item" onClick={()=>{ setOpen(false); navigate('/progress', {state:{openWeight:true}}); }}>Log Weight</button>
        </div>
      )}
    </div>
  );
}
