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
import {
  createWeightEntry,
  deleteCalorieEntry,
  deleteExerciseEntry,
  deleteWeightEntry,
  getLocalWeightImportState,
  importLocalWeightHistory,
} from '../../services/progressService';
import './Progress.css';

export default function Progress({ user }) {
  const [resolvedUserId, setResolvedUserId] = useState(user?.id || null);
  const [scope, setScope] = useState('all');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [detail, setDetail] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [localImport, setLocalImport] = useState({ available: false, count: 0 });
  const [importStatus, setImportStatus] = useState('');
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

  React.useEffect(() => {
    setLocalImport(getLocalWeightImportState(userId));
  }, [userId]);

  async function handleSaveWeight({ value, unit, date }) {
    await createWeightEntry(userId, { value, unit, date });
    setReloadKey((current) => current + 1);
    setLocalImport(getLocalWeightImportState(userId));
  }

  async function handleImportWeights() {
    setImportStatus('Importing browser history…');
    try {
      const result = await importLocalWeightHistory(userId);
      setReloadKey((current) => current + 1);
      setImportStatus(
        `Imported ${result.imported}; ${result.duplicate} duplicate and ${result.invalid} invalid. Browser data was retained.`
      );
    } catch (error) {
      setImportStatus(error.message || 'Browser history import failed. Local data was retained.');
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

        <div className="progress-header">
          <h1 className="progress-title cc-page-title">Progress</h1>

          <div className="progress-tabs">
            <ProgressTabs scope={scope} onChange={setScope} />
          </div>
        </div>

        {localImport.available && (
          <div className="progress-weight-import" role="status">
            <span>{localImport.count} browser weight {localImport.count === 1 ? 'entry is' : 'entries are'} available.</span>
            <button type="button" onClick={handleImportWeights}>Import weight history</button>
            {importStatus && <span>{importStatus}</span>}
          </div>
        )}

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
