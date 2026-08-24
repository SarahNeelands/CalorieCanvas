import React from 'react';
import Modal from '../ui/Modal.jsx';

export default function DayDetailModal({ open, onClose, detail }) {
  const dateLabel = detail?.dateLabel;
  const weight = detail?.weight;
  const weightUnit = detail?.weightUnit || 'kg';
  const calories = detail?.calories;
  const exerciseTypes = detail?.exerciseTypes || [];
  const deleteLabel = detail?.deleteLabel || 'Delete Entry';
  const onDelete = detail?.onDelete;
  const onSaveCalories = detail?.onSaveCalories;
  const [calorieValue, setCalorieValue] = React.useState('');

  React.useEffect(() => {
    setCalorieValue(typeof calories === 'number' ? String(Math.round(calories)) : '');
  }, [calories, open]);

  const saveCalories = () => {
    const nextCalories = Number(calorieValue || 0);
    if (!Number.isFinite(nextCalories) || nextCalories < 0) return;
    onSaveCalories?.(nextCalories);
  };

  return (
    <Modal open={open} onClose={onClose} title={`Details - ${dateLabel ?? ''}`}>
      <div>
        {typeof calories === 'number' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, opacity: 0.7 }}>Calories</div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{calories} cal</div>
            {onSaveCalories ? (
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 13, color: '#35574d', fontWeight: 600 }}>
                  Day calorie total
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={calorieValue}
                    onChange={(event) => setCalorieValue(event.target.value)}
                    style={{
                      border: '1px solid rgba(20, 61, 51, 0.14)',
                      borderRadius: 12,
                      padding: '0.72rem 0.85rem',
                      fontSize: '1rem',
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={saveCalories}
                  style={{
                    border: 'none',
                    background: '#2c5b49',
                    color: '#fff',
                    borderRadius: 12,
                    padding: '0.7rem 0.95rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    justifySelf: 'start',
                  }}
                >
                  Save Day Total
                </button>
              </div>
            ) : null}
          </div>
        )}
        {typeof weight === 'number' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, opacity: 0.7 }}>Weight</div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{weight} {weightUnit}</div>
          </div>
        )}
        {!!exerciseTypes.length && (
          <div>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>Exercise Breakdown</div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
              {exerciseTypes.map((item, index) => (
                <li key={`${item.name}-${index}`} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.name}</span>
                  <span style={{ opacity: 0.8 }}>{item.minutes} min</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {onDelete ? (
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onDelete}
              style={{
                border: '1px solid rgba(140, 74, 58, 0.28)',
                background: 'rgba(196, 116, 92, 0.08)',
                color: '#8a4639',
                borderRadius: 10,
                padding: '0.65rem 0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {deleteLabel}
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
