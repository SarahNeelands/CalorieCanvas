import React from 'react';
import Modal from '../ui/Modal.jsx';

export default function DayDetailModal({ open, onClose, detail }) {
  const dateLabel = detail?.dateLabel;
  const weight = detail?.weight;
  const weightUnit = detail?.weightUnit || 'kg';
  const calories = detail?.calories;
  const exerciseTypes = detail?.exerciseTypes || [];

  return (
    <Modal open={open} onClose={onClose} title={`Details • ${dateLabel ?? ''}`}>
      <div>
        {typeof calories === 'number' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, opacity: 0.7 }}>Calories</div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{calories} cal</div>
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
      </div>
    </Modal>
  );
}
