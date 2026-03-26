import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './QuickActions.css';
import addIcon from './images/addIcon.png';

export default function QuickActionsFloating(){
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [isPhone, setIsPhone] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 980px)").matches;
  });

  const quickActionPaths = new Set(["/", "/meals", "/exercises", "/progress", "/profile"]);
  const shouldRender = isPhone && quickActionPaths.has(location.pathname);

  useEffect(()=>{
    function onDoc(e){ if(!ref.current) return; if(!ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('pointerdown', onDoc);
    return ()=> document.removeEventListener('pointerdown', onDoc);
  },[]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia("(max-width: 980px)");
    const sync = (event) => setIsPhone(event.matches);
    setIsPhone(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", sync);
      return () => mediaQuery.removeEventListener("change", sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, isPhone]);

  if (!shouldRender) {
    return null;
  }

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
