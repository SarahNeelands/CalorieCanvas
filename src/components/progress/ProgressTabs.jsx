import React from 'react';
import SegmentedControl from '../ui/SegmentedControl.jsx';

export default function ProgressTabs({ scope, onChange }) {
  // scope: 'all' | 'month' | 'week'
  return (
    <div className="mb-4">
      <SegmentedControl
        options={[
          { label: 'Overall', value: 'all' },
          { label: 'Monthly', value: 'month' },
          { label: 'Weekly', value: 'week' },
        ]}
        value={scope}
        onChange={onChange}
      />
    </div>
  );
}
