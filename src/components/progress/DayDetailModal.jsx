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
