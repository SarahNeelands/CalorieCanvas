import React from 'react';
import Modal from '../ui/Modal.jsx';

export default function DayDetailModal({ open, onClose, dateLabel, weight, calories, exerciseTypes = [] }) {
  return (
    <Modal open={open} onClose={onClose} title={`Details • ${dateLabel ?? ''}`}>
      <div className="space-y-4">
        {typeof calories === 'number' && (
          <div>
            <div className="text-sm opacity-70">Calories</div>
            <div className="text-2xl font-semibold">{calories} cal</div>
          </div>
        )}
        {typeof weight === 'number' && (
          <div>
            <div className="text-sm opacity-70">Weight</div>
            <div className="text-2xl font-semibold">{weight} lbs</div>
          </div>
        )}
        {!!exerciseTypes?.length && (
          <div>
            <div className="text-sm opacity-70 mb-2">Exercise Breakdown</div>
            <ul className="space-y-1">
              {exerciseTypes.map((t, i) => (
                <li key={i} className="flex justify-between">
                  <span>{t.name}</span>
                  <span className="opacity-80">{t.minutes} min</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
