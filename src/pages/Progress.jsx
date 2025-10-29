import React, { useMemo, useState } from 'react';
import ProgressTabs from '../components/progress/ProgressTabs.jsx';
import WeightTrend from '../components/progress/WeightTrend.jsx';
import CalorieTrend from '../components/progress/CalorieTrend.jsx';
import ExerciseTrend from '../components/progress/ExerciseTrend.jsx';
import DayDetailModal from '../components/progress/DayDetailModal.jsx';
import NavBar from "../components/NavBar";
import './Progress.css';

export default function Progress({ user }) {
  const [scope, setScope] = useState('all'); // 'all' | 'month' | 'week'
  const [detail, setDetail] = useState(null);
  // TODO: wire to your auth/user context
  const userId = useMemo(() => 'demo-user', []);

  const openDetail = (payload) => setDetail(payload);
  const closeDetail = () => setDetail(null);

  return (
    <div className="progress-container">
      <NavBar profileImageSrc={user?.avatar} />
      <h1 classNameprogress-title">Progress</h1>
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
  );
}
