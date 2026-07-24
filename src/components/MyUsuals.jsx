import React from "react";
import Modal from "./ui/Modal";
import { listCatalogItems } from "../services/catalogClient";
import { createMealLog, deleteMealLog, getMealLogDay } from "../services/mealLogClient";
import { deleteUsual, listUsuals, saveUsual } from "../services/usualClient";
import { buildMealLogPayload, getFoodUnitLabel } from "../utils/mealLogPayload";
import { unitOptionsForFood } from "../utils/units";
import "./MyUsuals.css";

function formatAmount(qty, unit, item) {
  const value = Number(qty);
  const display = Number.isInteger(value) ? value : Math.round(value * 100) / 100;
  const label = getFoodUnitLabel(item, unit);
  const plural = unit === "quantity" && value !== 1 && !label.endsWith("s") ? "s" : "";
  return `${display} ${label}${plural}`;
}

function flattenDayEntries(day) {
  return (day?.meals || []).flatMap((section) => section.entries || []);
}

export default function MyUsuals({ userId }) {
  const [usuals, setUsuals] = React.useState([]);
  const [dayEntries, setDayEntries] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [catalog, setCatalog] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [unit, setUnit] = React.useState("g");
  const [saving, setSaving] = React.useState(false);
  const [loggingId, setLoggingId] = React.useState(null);
  const [undoEntry, setUndoEntry] = React.useState(null);

  const refresh = React.useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError("");
      const [usualRows, day] = await Promise.all([listUsuals(), getMealLogDay({ userId })]);
      setUsuals(usualRows);
      setDayEntries(flattenDayEntries(day));
    } catch (err) {
      setError(err.message || "Unable to load My Usuals.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedItem = catalog.find((item) => item.id === selectedId) || null;

  async function openAdd() {
    setAdding(true);
    setError("");
    try {
      const [snacks, meals] = await Promise.all([
        listCatalogItems("snack"),
        listCatalogItems("meal"),
      ]);
      const items = [...snacks, ...meals].filter(
        (item, index, rows) => rows.findIndex((candidate) => candidate.id === item.id) === index
      );
      setCatalog(items);
      const first = items[0] || null;
      setSelectedId(first?.id || "");
      const units = unitOptionsForFood(first);
      setUnit(units.includes("quantity") ? "quantity" : units[0] || "g");
      setQty("");
    } catch (err) {
      setError(err.message || "Unable to load foods.");
    }
  }

  function selectFood(id) {
    const item = catalog.find((row) => row.id === id);
    setSelectedId(id);
    const units = unitOptionsForFood(item);
    setUnit(units.includes("quantity") ? "quantity" : units[0] || "g");
  }

  async function handleSaveUsual(event) {
    event.preventDefault();
    if (!selectedItem || !(Number(qty) > 0)) return;
    try {
      setSaving(true);
      setError("");
      const saved = await saveUsual({
        meal_id: selectedItem.id,
        default_qty: Number(qty),
        unit_code: unit,
        position: usuals.length,
      });
      setUsuals((current) => [
        ...current.filter((row) => row.id !== saved.id && row.meal_id !== saved.meal_id),
        saved,
      ]);
      setAdding(false);
    } catch (err) {
      setError(err.message || "Unable to save this usual.");
    } finally {
      setSaving(false);
    }
  }

  async function logUsual(usual) {
    try {
      setLoggingId(usual.id);
      setError("");
      const payload = buildMealLogPayload({
        item: usual.item,
        qty: usual.default_qty,
        unit: usual.unit_code,
      });
      const entry = await createMealLog(payload);
      setDayEntries((current) => [...current, entry]);
      setUndoEntry({ entry, usual });
      window.dispatchEvent(new CustomEvent("meal-logged", { detail: { payload, entry } }));
    } catch (err) {
      setError(err.message || "Unable to log this usual.");
    } finally {
      setLoggingId(null);
    }
  }

  async function undoLast() {
    if (!undoEntry?.entry?.id) return;
    try {
      await deleteMealLog(undoEntry.entry.id);
      setDayEntries((current) => current.filter((entry) => entry.id !== undoEntry.entry.id));
      setUndoEntry(null);
      window.dispatchEvent(new CustomEvent("meal-logged", { detail: { deletedId: undoEntry.entry.id } }));
    } catch (err) {
      setError(err.message || "Unable to undo the log.");
    }
  }

  async function removeUsual(usual) {
    try {
      await deleteUsual(usual.id);
      setUsuals((current) => current.filter((row) => row.id !== usual.id));
    } catch (err) {
      setError(err.message || "Unable to remove this usual.");
    }
  }

  return (
    <section className="usuals-card" aria-labelledby="usuals-title">
      <header className="usuals-card__header">
        <div>
          <h3 id="usuals-title">My Usuals</h3>
          <p>One tap logs your normal portion.</p>
        </div>
        <button type="button" className="usuals-card__add" onClick={openAdd}>Add usual</button>
      </header>

      {loading && <p className="usuals-card__message">Loading your usuals…</p>}
      {!loading && usuals.length === 0 && (
        <p className="usuals-card__message">Pin chocolate, Cheetos, or a regular meal here for instant logging.</p>
      )}
      {error && <p className="usuals-card__error">{error}</p>}

      <div className="usuals-grid">
        {usuals.map((usual) => {
          const matching = dayEntries.filter(
            (entry) => entry.meal_id === usual.meal_id && entry.unit_code === usual.unit_code
          );
          const totalQty = matching
            .reduce((sum, entry) => sum + Number(entry.qty || 0), 0);
          const perTap = buildMealLogPayload({
            item: usual.item,
            qty: usual.default_qty,
            unit: usual.unit_code,
          });
          return (
            <article className="usual-tile" key={usual.id}>
              <div className="usual-tile__top">
                <div>
                  <h4>{usual.custom_label || usual.item?.title || "Usual food"}</h4>
                  <p>{formatAmount(usual.default_qty, usual.unit_code, usual.item)} · {Math.round(perTap.kcal)} kcal</p>
                </div>
                <button
                  type="button"
                  className="usual-tile__remove"
                  aria-label={`Remove ${usual.item?.title || "usual"}`}
                  onClick={() => removeUsual(usual)}
                >
                  ×
                </button>
              </div>
              <p className="usual-tile__today">
                Today: {matching.length
                  ? `${formatAmount(totalQty, usual.unit_code, usual.item)} · ${matching.length} ${matching.length === 1 ? "log" : "logs"}`
                  : "not logged yet"}
              </p>
              <button
                type="button"
                className="usual-tile__log"
                disabled={loggingId === usual.id}
                onClick={() => logUsual(usual)}
              >
                {loggingId === usual.id
                  ? "Logging…"
                  : `+ Log ${formatAmount(usual.default_qty, usual.unit_code, usual.item)}`}
              </button>
            </article>
          );
        })}
      </div>

      {undoEntry && (
        <div className="usuals-undo" role="status">
          <span>Added {formatAmount(undoEntry.usual.default_qty, undoEntry.usual.unit_code, undoEntry.usual.item)}</span>
          <button type="button" onClick={undoLast}>Undo</button>
        </div>
      )}

      {adding && (
        <Modal title="Add to My Usuals" onClose={() => setAdding(false)}>
          <form className="usual-form" onSubmit={handleSaveUsual}>
            <label>
              <span>Food or saved meal</span>
              <select value={selectedId} onChange={(event) => selectFood(event.target.value)}>
                {catalog.map((item) => (
                  <option value={item.id} key={item.id}>{item.title}</option>
                ))}
              </select>
            </label>
            <div className="usual-form__portion">
              <label>
                <span>Your usual amount</span>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  inputMode="decimal"
                  value={qty}
                  onChange={(event) => setQty(event.target.value)}
                />
              </label>
              <label>
                <span>Unit</span>
                <select value={unit} onChange={(event) => setUnit(event.target.value)}>
                  {unitOptionsForFood(selectedItem).map((option) => (
                    <option value={option} key={option}>{getFoodUnitLabel(selectedItem, option)}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="usual-form__hint">For chocolate, choose “quantity” and enter 2. For Cheetos, choose grams and enter 25.</p>
            <button type="submit" disabled={saving || !selectedItem || !(Number(qty) > 0)}>
              {saving ? "Saving…" : "Add usual"}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
