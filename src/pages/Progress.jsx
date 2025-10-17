import React, { useMemo, useState } from 'react';
import ProgressTabs from '../components/progress/ProgressTabs.jsx';
import WeightTrend from '../components/progress/WeightTrend.jsx';
import CalorieTrend from '../components/progress/CalorieTrend.jsx';
import ExerciseTrend from '../components/progress/ExerciseTrend.jsx';
import DayDetailModal from '../components/progress/DayDetailModal.jsx';
import Card from '../components/ui/Card.jsx';
import NavBar from "../components/NavBar";

// Ensure 'all' is the default every time you land here.
// If you use a router, do not persist scope in global state on mount.
export default function Progress({ user }) {
  const [scope, setScope] = useState('all'); // 'all' | 'month' | 'week'
  const [detail, setDetail] = useState(null);

  // TODO: wire to your auth/user context
  const userId = useMemo(() => 'demo-user', []);

  const openDetail = (payload) => setDetail(payload);
  const closeDetail = () => setDetail(null);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <NavBar profileImageSrc={user.avatar}/>
      <Card className="p-4">
        <h1 className="text-2xl font-bold mb-2">Progress</h1>
        <ProgressTabs scope={scope} onChange={setScope} />
      </Card>

      {/* Weight */}
      <WeightTrend userId={userId} scope={scope} />

      {/* Calories (Weekly click -> show calories for that day) */}
      <CalorieTrend
        userId={userId}
        scope={scope}
        onDayClick={(d) => openDetail({ ...d })}
      />

      {/* Exercise (Weekly click -> show minutes + types for that day) */}
      <ExerciseTrend
        userId={userId}
        scope={scope}
        onDayClick={(d) => openDetail({ ...d })}
      />

      {/* Detail modal combines data fields if provided */}
      <DayDetailModal
        open={!!detail}
        onClose={closeDetail}
        dateLabel={detail?.dateLabel}
        calories={detail?.calories}
        exerciseTypes={detail?.exerciseTypes}
        weight={detail?.weight}
      />
    </div>
  );
}
