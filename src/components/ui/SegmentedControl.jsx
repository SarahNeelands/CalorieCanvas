// src/components/ui/SegmentedControl.jsx
import React from "react";
import "./SegmentedControl.css";

export default function SegmentedControl({ value, options = [], onChange }) {
  return (
    <div className="seg">
      {options.map(opt => (
        <button
          key={opt.value}
          className={`seg-btn ${value === opt.value ? "active" : ""}`}
          onClick={() => onChange?.(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
