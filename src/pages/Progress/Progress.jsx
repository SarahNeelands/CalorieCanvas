import React, { useState } from 'react';
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
  const [scope, setScope] = useState('all');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [detail, setDetail] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const userId = user?.id;

  function handleSaveWeight({ value, unit }) {
    try {
      const key = 'cc.weights';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const item = {
        user_id: userId,
        date: new Date().toISOString().slice(0, 10),
        value,
        unit,
      };
      existing.push(item);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (error) {
      console.warn(error);
    }
  }

  const openDetail = (payload) => setDetail(payload);
  const closeDetail = () => setDetail(null);

  return (
    <div className="progress-back">
      <NavBar profileImageSrc={user?.avatar} />
      <div className="progress-container">
        {location?.state?.openWeight && (
          <WeightModal
            open={true}
            onClose={() => {
              try {
                navigate(location.pathname, { replace: true, state: {} });
              } catch {}
            }}
            onSave={handleSaveWeight}
          />
        )}

        <h1 className="progress-title">Progress</h1>

        <div className="progress-tabs">
          <ProgressTabs scope={scope} onChange={setScope} />
        </div>

        <div className="trend-grid">
          <WeightTrend
            userId={userId}
            scope={scope}
            unit={weightUnit}
            onUnitChange={setWeightUnit}
            onDayClick={(point) => openDetail({ ...point })}
          />

          <CalorieTrend
            userId={userId}
            scope={scope}
            onDayClick={(point) => openDetail({ ...point })}
          />

          <div className="exercise-card">
            <ExerciseTrend
              userId={userId}
              scope={scope}
              onDayClick={(point) => openDetail({ ...point })}
            />
          </div>
        </div>

        {detail && (
          <DayDetailModal
            open={Boolean(detail)}
            onClose={closeDetail}
            detail={detail}
          />
        )}
      </div>
    </div>
  );
}
