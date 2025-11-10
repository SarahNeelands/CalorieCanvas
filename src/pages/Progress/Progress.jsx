import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import WeightModal from '../../components/progress/WeightModal.jsx';
import ProgressTabs from '../../components/progress/ProgressTabs.jsx';
import WeightTrend from '../../components/progress/WeightTrend.jsx';
import CalorieTrend from '../../components/progress/CalorieTrend.jsx';
import ExerciseTrend from '../../components/progress/ExerciseTrend.jsx';
import DayDetailModal from '../../components/progress/DayDetailModal.jsx';
import NavBar from "../../components/NavBar";
import './Progress.css';

export default function Progress({ user }) {
  const [scope, setScope] = useState('all'); // 'all' | 'month' | 'week'
  const [detail, setDetail] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  // local handler to persist weight – placeholder: save to localStorage
  function handleSaveWeight({ value, unit }){
    try{
      const key = 'cc.weights';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const item = { date: new Date().toISOString().slice(0,10), value, unit };
      existing.push(item);
      localStorage.setItem(key, JSON.stringify(existing));
      console.log('Saved weight', item);
    }catch(e){ console.warn(e); }
  }
  // TODO: wire to your auth/user context
  const userId = useMemo(() => 'demo-user', []);

  const openDetail = (payload) => setDetail(payload);
  const closeDetail = () => setDetail(null);

  return (
    <div className="progress-back">
      <NavBar profileImageSrc={user?.avatar} />
      <div className="progress-container">
        
        {/* open weight modal if route state requested it */}
        {location?.state?.openWeight && (
          <WeightModal open={true} onClose={()=>{ try{ navigate(location.pathname, { replace:true, state: {} }); }catch(e){} }} onSave={handleSaveWeight} />
        )}
              <h1 className="progress-title">Progress</h1>
        <div className="progress-tabs">
          <ProgressTabs scope={scope} onChange={setScope} />
        </div>
        <div className="trend-grid">
          <WeightTrend
            userId={userId}
            scope={scope}
            onDayClick={(d) => openDetail({ ...d })}
          />
          <CalorieTrend
            userId={userId}
            scope={scope}
            onDayClick={(d) => openDetail({ ...d })}
          />
          <div className="exercise-card">
            <ExerciseTrend
              userId={userId}
              scope={scope}
              onDayClick={(d) => openDetail({ ...d })}
            />
          </div>
        </div>
        {detail && (
          <DayDetailModal
            detail={detail}
            open={Boolean(detail)}
            onClose={closeDetail}
          />
        )}
      </div>
    </div>
  );
}
