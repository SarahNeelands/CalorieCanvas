// src/components/exercise/ExercisePageHeader.jsx (tiny className adds)
import React from "react";
import SegmentedControl from "../ui/SegmentedControl.jsx";
import "./ExercisePageHeader.css";

export default function ExercisePageHeader({ range, onChangeRange, onLog }) {
  return (
    <header className="ex-header">
      <h1 className="ex-title">Exercise</h1>
      <div className="ex-actions">
        <SegmentedControl
          value={range}
          options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }]}
          onChange={onChangeRange}
        />
        <button className="ex-log-btn" onClick={onLog}>Log exercise</button>
      </div>
    </header>
  );
}
