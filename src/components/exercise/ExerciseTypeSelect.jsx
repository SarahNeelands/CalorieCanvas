import React, { useMemo } from "react";
import "./ExerciseTypeSelect.css";

function sortAndFilterOptions(options, query) {
  const normalizedQuery = String(query || "").toLowerCase().trim();

  return [...(options || [])]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((option) => option.name.toLowerCase().includes(normalizedQuery));
}

export default function ExerciseTypeSelect({
  valueId,
  query,
  onQuery,
  options,
  onSelect,
  onAddNew,
}) {
  const filtered = useMemo(
    () => sortAndFilterOptions(options, query),
    [options, query]
  );

  return (
    <div className="exercise-type-select">
      <input
        value={query}
        onChange={(event) => onQuery?.(event.target.value)}
        placeholder="Search or select exercise"
        className="exercise-type-select__input"
      />

      <div className="exercise-type-select__list">
        {filtered.map((option) => (
          <div
            key={option.id}
            className={`exercise-type-select__option ${valueId === option.id ? "is-selected" : ""}`}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect?.(option);
            }}
          >
            {option.name}
          </div>
        ))}

        {!filtered.length && (
          <div className="exercise-type-select__empty">No matching exercises.</div>
        )}

        <div className="exercise-type-select__divider" />

        <div
          className="exercise-type-select__add"
          onMouseDown={(event) => {
            event.preventDefault();
            onAddNew?.(query);
          }}
        >
          + Add new exercise
        </div>
      </div>
    </div>
  );
}
