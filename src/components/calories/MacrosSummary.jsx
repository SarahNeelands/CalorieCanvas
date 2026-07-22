import React from "react";
import "./MacrosSummary.css";

function getProgress(current, target) {
  if (!(Number(target) > 0)) return 0;
  return Math.max(0, Math.min(100, (Number(current || 0) / target) * 100));
}

function getRemaining(current, target) {
  if (!(Number(target) > 0)) return null;
  return Math.max(0, Math.round(target - Number(current || 0)));
}

function MacroRow({ label, current, target, unit = "g", barClassName }) {
  const progress = getProgress(current, target);
  const remaining = getRemaining(current, target);
  const hasTarget = Number.isFinite(target) && target > 0;

  return (
    <div className="macros-card__row">
      <div className="macros-card__row-header">
        <span className="macros-card__label-wrap">
          <span className="macros-card__label">{label}</span>
          <span className="macros-card__meta">
            {hasTarget ? `${remaining}${unit} left` : "Goal unavailable"}
          </span>
        </span>
        <span className="macros-card__value">
          {Math.round(Number(current || 0))}{unit} / {hasTarget ? `${Math.round(target)}${unit}` : "--"}{" "}
          <strong>{hasTarget ? `${Math.round(progress)}%` : ""}</strong>
        </span>
      </div>

      <div className="macros-card__bar">
        <div
          className={`macros-card__fill ${barClassName}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function MacrosSummary({ macros, targets }) {
  const [showAll, setShowAll] = React.useState(false);
  const protein = Number(macros?.protein_g || 0);
  const carbs = Number(macros?.carbs_g || 0);
  const fat = Number(macros?.fat_g || 0);
  const fiber = Number(macros?.fiber_g || 0);
  const sugar = Number(macros?.sugar_g || 0);
  const cholesterol = Number(macros?.cholesterol_mg || 0);

  return (
    <section className="macros-card">
      <MacroRow
        label="Protein"
        current={protein}
        target={targets.protein_g}
        barClassName="macros-card__fill--protein"
      />
      <MacroRow
        label="Carbs"
        current={carbs}
        target={targets.carbs_g}
        barClassName="macros-card__fill--carbs"
      />
      <MacroRow
        label="Fat"
        current={fat}
        target={targets.fat_g}
        barClassName="macros-card__fill--fat"
      />
      {showAll && (
        <>
          <MacroRow
            label="Fiber"
            current={fiber}
            target={targets.fiber_g}
            barClassName="macros-card__fill--fiber"
          />
          <MacroRow
            label="Sugar"
            current={sugar}
            target={targets.sugar_g}
            barClassName="macros-card__fill--sugar"
          />
          <MacroRow
            label="Cholesterol"
            current={cholesterol}
            target={targets.cholesterol_mg}
            unit="mg"
            barClassName="macros-card__fill--cholesterol"
          />
        </>
      )}
      <button
        type="button"
        className="macros-card__toggle"
        onClick={() => setShowAll((current) => !current)}
      >
        {showAll ? "Show Less" : "Show All"}
      </button>
    </section>
  );
}
