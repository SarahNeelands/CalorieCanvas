import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import WeightModal from '../../components/progress/WeightModal.jsx';
import ProgressTabs from '../../components/progress/ProgressTabs.jsx';
import WeightTrend from '../../components/progress/WeightTrend.jsx';
import CalorieTrend from '../../components/progress/CalorieTrend.jsx';
import ExerciseTrend from '../../components/progress/ExerciseTrend.jsx';
import DayDetailModal from '../../components/progress/DayDetailModal.jsx';
import NavBar from "../../components/NavBar";
import { getCurrentUserId } from '../../services/authClient';
import { deleteCalorieEntry, deleteExerciseEntry, deleteWeightEntry } from '../../services/progressService';
import './Progress.css';

export default function Progress({ user }) {
  const [resolvedUserId, setResolvedUserId] = useState(user?.id || null);
  const [scope, setScope] = useState('all');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [detail, setDetail] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const userId = resolvedUserId;

  React.useEffect(() => {
    let active = true;

    async function resolveUser() {
      const nextUserId = user?.id || await getCurrentUserId();
      if (active) {
        setResolvedUserId(nextUserId || null);
      }
    }

    resolveUser();
    return () => {
      active = false;
    };
  }, [user?.id]);

  function handleSaveWeight({ value, unit, date }) {
    try {
      const key = 'cc.weights';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const item = {
        user_id: userId,
        date: date || new Date().toISOString().slice(0, 10),
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

  async function handleDeleteWeight(point) {
    await deleteWeightEntry(userId, point);
    setDetail(null);
    setReloadKey((value) => value + 1);
  }

  async function handleDeleteCalories(point) {
    await deleteCalorieEntry(userId, point);
    setDetail(null);
    setReloadKey((value) => value + 1);
  }

  async function handleDeleteExercise(point) {
    await deleteExerciseEntry(userId, point);
    setDetail(null);
    setReloadKey((value) => value + 1);
  }

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

        <h1 className="progress-title cc-page-title">Progress</h1>

        <div className="progress-tabs">
          <ProgressTabs scope={scope} onChange={setScope} />
        </div>

        <div className="trend-grid">
          <WeightTrend
            key={`weight-${scope}-${weightUnit}-${reloadKey}`}
            userId={userId}
            scope={scope}
            unit={weightUnit}
            onUnitChange={setWeightUnit}
            onDayClick={(point) => openDetail({
              ...point,
              onDelete: () => handleDeleteWeight(point),
              deleteLabel: 'Delete Weight Entry',
            })}
          />

          <CalorieTrend
            key={`calories-${scope}-${reloadKey}`}
            userId={userId}
            scope={scope}
            onDayClick={(point) => openDetail({
              ...point,
              onDelete: () => handleDeleteCalories(point),
              deleteLabel: 'Delete Day Calories',
            })}
          />

          <div className="exercise-card">
            <ExerciseTrend
              key={`exercise-${scope}-${reloadKey}`}
              userId={userId}
              scope={scope}
              onDayClick={(point) => openDetail({
                ...point,
                onDelete: () => handleDeleteExercise(point),
                deleteLabel: 'Delete Day Exercise',
              })}
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
