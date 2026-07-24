import React from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "../../components/NavBar";
import { listCatalogItems } from "../../services/catalogClient";
import { createMealLogsBatch } from "../../services/mealLogClient";
import { listUsuals } from "../../services/usualClient";
import { buildMealLogPayload, getFoodUnitLabel } from "../../utils/mealLogPayload";
import { unitOptionsForFood } from "../../utils/units";
import "./DayRecap.css";

const DEFAULT_TIMES = {
  breakfast: "08:00",
  lunch: "12:30",
  dinner: "18:30",
  snack: "15:00",
  other: "12:00",
};

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rowId() {
  return window.crypto?.randomUUID?.() || `row-${Date.now()}-${Math.random()}`;
}

function newFoodRow(mealType = "breakfast", overrides = {}) {
  return {
    id: rowId(),
    kind: "food",
    mealType,
    itemId: "",
    qty: "",
    unit: "g",
    time: DEFAULT_TIMES[mealType],
    ...overrides,
  };
}

function newEstimateRow() {
  return {
    id: rowId(),
    kind: "estimate",
    mealType: "snack",
    title: "",
    calories: "",
    time: DEFAULT_TIMES.snack,
  };
}

export default function DayRecap({ user }) {
  const navigate = useNavigate();
  const [date, setDate] = React.useState(localDateString());
  const [catalog, setCatalog] = React.useState([]);
  const [usuals, setUsuals] = React.useState([]);
  const [rows, setRows] = React.useState([
    newFoodRow("breakfast"),
    newFoodRow("lunch"),
    newFoodRow("dinner"),
  ]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [meals, snacks, usualRows] = await Promise.all([
          listCatalogItems("meal"),
          listCatalogItems("snack"),
          listUsuals(),
        ]);
        if (!active) return;
        setCatalog([...meals, ...snacks].filter(
          (item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index
            && item?.unit_conversions?.recipe_status !== "awaiting_final_weight"
        ));
        setUsuals(usualRows);
      } catch (err) {
        if (active) setError(err.message || "Unable to load your foods.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  function updateRow(id, changes) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...changes } : row));
  }

  function selectItem(row, itemId) {
    const item = catalog.find((candidate) => candidate.id === itemId);
    const units = unitOptionsForFood(item);
    updateRow(row.id, {
      itemId,
      unit: units.includes("quantity") ? "quantity" : units[0] || "g",
    });
  }

  function addUsual(usual) {
    setRows((current) => [...current, newFoodRow(
      (usual.item?.type || usual.item?.item_type) === "snack" ? "snack" : "other",
      {
        itemId: usual.meal_id,
        qty: String(usual.default_qty),
        unit: usual.unit_code,
      }
    )]);
  }

  function removeRow(id) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function buildRowPayload(row) {
    const loggedAt = new Date(`${date}T${row.time || DEFAULT_TIMES[row.mealType]}:00`);
    if (row.kind === "estimate") {
      const calories = Number(row.calories);
      if (!row.title.trim() || !(calories > 0)) {
        throw new Error("Every estimate needs a description and calories.");
      }
      return {
        meal_id: null,
        item_snapshot: {
          id: null,
          title: `${row.title.trim()} (estimate)`,
          type: row.mealType === "snack" ? "snack" : "meal",
          unit_conversions: { estimated: true, quantity_label: "estimate" },
          kcal_per_100g: 0,
          protein_g_per_100g: 0,
          carbs_g_per_100g: 0,
          fat_g_per_100g: 0,
        },
        qty: 1,
        unit_code: "quantity",
        grams_resolved: 0,
        logged_at: loggedAt.toISOString(),
        meal_type: row.mealType,
        kcal: calories,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      };
    }
    const item = catalog.find((candidate) => candidate.id === row.itemId);
    if (!item || !(Number(row.qty) > 0)) {
      throw new Error("Choose a food and amount for every row.");
    }
    return {
      ...buildMealLogPayload({ item, qty: row.qty, unit: row.unit, loggedAt }),
      meal_type: row.mealType,
    };
  }

  async function saveDay() {
    try {
      setSaving(true);
      setError("");
      const activeRows = rows.filter((row) => (
        row.kind === "estimate" ? row.title || row.calories : row.itemId || row.qty
      ));
      if (!activeRows.length) throw new Error("Add at least one food or estimate.");
      const payloads = activeRows.map(buildRowPayload);
      await createMealLogsBatch(payloads);
      window.dispatchEvent(new CustomEvent("meal-logged", { detail: { batch: true } }));
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to save this day.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="day-recap-page">
      <NavBar profileImageSrc={user?.avatar} />
      <main className="day-recap-shell">
        <header className="day-recap-header">
          <div>
            <h1>Rebuild My Day</h1>
            <p>Add everything you remember, make rough estimates where needed, and save it together.</p>
          </div>
          <label>
            <span>Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        </header>

        {usuals.length > 0 && (
          <section className="day-recap-usuals">
            <h2>Quick add usuals</h2>
            <div>
              {usuals.map((usual) => (
                <button type="button" key={usual.id} onClick={() => addUsual(usual)}>
                  + {usual.item?.title} · {usual.default_qty} {getFoodUnitLabel(usual.item, usual.unit_code)}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="day-recap-card">
          <div className="day-recap-card__heading">
            <h2>Food entries</h2>
            <div>
              <button type="button" onClick={() => setRows((current) => [...current, newFoodRow("snack")])}>Add food</button>
              <button type="button" onClick={() => setRows((current) => [...current, newEstimateRow()])}>Add estimate</button>
            </div>
          </div>

          {loading && <p>Loading foods…</p>}
          <div className="day-recap-rows">
            {rows.map((row) => (
              <article className="day-recap-row" key={row.id}>
                <select
                  aria-label="Meal section"
                  value={row.mealType}
                  onChange={(event) => updateRow(row.id, {
                    mealType: event.target.value,
                    time: DEFAULT_TIMES[event.target.value],
                  })}
                >
                  {["breakfast", "lunch", "dinner", "snack", "other"].map((option) => (
                    <option value={option} key={option}>{option[0].toUpperCase() + option.slice(1)}</option>
                  ))}
                </select>

                {row.kind === "estimate" ? (
                  <>
                    <input
                      className="day-recap-row__food"
                      type="text"
                      aria-label="Estimate description"
                      placeholder="Restaurant dinner, roughly…"
                      value={row.title}
                      onChange={(event) => updateRow(row.id, { title: event.target.value })}
                    />
                    <input
                      aria-label="Estimated calories"
                      type="number"
                      min="1"
                      inputMode="numeric"
                      placeholder="kcal"
                      value={row.calories}
                      onChange={(event) => updateRow(row.id, { calories: event.target.value })}
                    />
                  </>
                ) : (
                  <>
                    <select
                      className="day-recap-row__food"
                      aria-label="Food"
                      value={row.itemId}
                      onChange={(event) => selectItem(row, event.target.value)}
                    >
                      <option value="">Choose food…</option>
                      {catalog.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
                    </select>
                    <input
                      aria-label="Amount"
                      type="number"
                      min="0.01"
                      step="any"
                      inputMode="decimal"
                      placeholder="Amount"
                      value={row.qty}
                      onChange={(event) => updateRow(row.id, { qty: event.target.value })}
                    />
                    <select
                      aria-label="Unit"
                      value={row.unit}
                      onChange={(event) => updateRow(row.id, { unit: event.target.value })}
                    >
                      {unitOptionsForFood(catalog.find((item) => item.id === row.itemId)).map((option) => (
                        <option value={option} key={option}>
                          {getFoodUnitLabel(catalog.find((item) => item.id === row.itemId), option)}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                <input
                  aria-label="Time"
                  type="time"
                  value={row.time}
                  onChange={(event) => updateRow(row.id, { time: event.target.value })}
                />
                <button type="button" className="day-recap-row__remove" onClick={() => removeRow(row.id)}>Remove</button>
              </article>
            ))}
          </div>

          {error && <p className="day-recap-error">{error}</p>}
          <div className="day-recap-save">
            <button type="button" onClick={() => navigate("/")}>Cancel</button>
            <button type="button" className="day-recap-save__primary" disabled={saving} onClick={saveDay}>
              {saving ? "Saving day…" : "Save entire day"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
