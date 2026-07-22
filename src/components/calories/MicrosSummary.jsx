import React from "react";
import "./MicrosSummary.css";

function clampPct(current, target) {
  if (!(Number(target) > 0)) return 0;
  return Math.max(0, Math.min(100, (Number(current || 0) / target) * 100));
}

function formatValue(value, unit) {
  return `${Math.round(Number(value || 0))}${unit}`;
}

function MicroRow({ label, current, target, unit, tone }) {
  const pct = clampPct(current, target);

  return (
    <div className="micros-card__row">
      <div className="micros-card__row-header">
        <span className="micros-card__label">{label}</span>
        <span className="micros-card__value">
          {formatValue(current, unit)} / {formatValue(target, unit)}{" "}
          <strong>{Math.round(pct)}%</strong>
        </span>
      </div>
      <div className="micros-card__bar">
        <div className={`micros-card__fill micros-card__fill--${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function MicrosSummary({ micros, targets }) {
  const [showAll, setShowAll] = React.useState(false);
  const primaryRows = [
    { key: "iron_mg", label: "Iron", unit: "mg", tone: "iron" },
    { key: "sodium_mg", label: "Sodium", unit: "mg", tone: "sodium" },
    { key: "calcium_mg", label: "Calcium", unit: "mg", tone: "calcium" },
  ];
  const extraRows = [
    { key: "vitamin_c_mg", label: "Vitamin C", unit: "mg", tone: "vitc" },
    { key: "potassium_mg", label: "Potassium", unit: "mg", tone: "potassium" },
    { key: "vitamin_a_mcg", label: "Vitamin A", unit: "mcg", tone: "vita" },
  ];

  return (
    <section className="micros-card">
      {primaryRows.map((row) => (
        <MicroRow
          key={row.key}
          label={row.label}
          current={Number(micros?.[row.key] || 0)}
          target={targets?.[row.key]}
          unit={row.unit}
          tone={row.tone}
        />
      ))}
      {showAll && extraRows.map((row) => (
        <MicroRow
          key={row.key}
          label={row.label}
          current={Number(micros?.[row.key] || 0)}
          target={targets?.[row.key]}
          unit={row.unit}
          tone={row.tone}
        />
      ))}
      <button
        type="button"
        className="micros-card__toggle"
        onClick={() => setShowAll((current) => !current)}
      >
        {showAll ? "Show Less" : "Show All"}
      </button>
    </section>
  );
}
