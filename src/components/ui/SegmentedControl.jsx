// src/components/ui/SegmentedControl.jsx
import React from "react";
import "./SegmentedControl.css";

export default function SegmentedControl({ value, options = [], onChange }) {
  const activeIndex = Math.max(0, options.findIndex((opt) => opt.value === value));
  const activeOption = options[activeIndex] ?? options[0] ?? null;

  return (
    <div
      className="seg"
      style={{
        "--seg-count": options.length || 1,
        "--seg-active-index": activeIndex,
      }}
    >
      <span className="seg-thumb" aria-hidden="true">
        <span className="seg-thumb__label">{activeOption?.label ?? ""}</span>
      </span>
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
