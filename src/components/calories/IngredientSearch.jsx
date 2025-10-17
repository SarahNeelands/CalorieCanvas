/** IngredientSearch.jsx
 * Modal/panel for searching catalog ingredients; shows results with + to add.
 * Displays "No results" when none; ESC or Close to dismiss.
 */


import React, { useEffect, useRef, useState } from "react";

/** Replace with your real backend call (e.g., Supabase RPC) */
async function searchIngredients(query) {
  if (!query?.trim()) return [];
  // Mock results for wiring:
  const pool = [
    { id: "1", name: "Cooked Pasta", calories: 220 },
    { id: "2", name: "Olive Oil", calories: 240 },
    { id: "3", name: "Parmesan Cheese", calories: 110 },
    { id: "4", name: "Chicken Breast (diced)", calories: 130 },
  ];
  return pool.filter((x) => x.name.toLowerCase().includes(query.toLowerCase()));
}

export default function IngredientSearch({ onSelect, onClose }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const doSearch = async () => {
    setLoading(true);
    const data = await searchIngredients(q);
    setResults(data);
    setLoading(false);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card" ref={boxRef}>
        <header className="row-between">
          <h4>Find an ingredient</h4>
          <button onClick={onClose} aria-label="Close search">✕</button>
        </header>

        <div className="search-row">
          <input
            autoFocus
            type="search"
            placeholder="Search by name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            aria-label="Ingredient search"
          />
          <button onClick={doSearch} disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        <div className="results">
          {loading && <p className="muted">Searching…</p>}

          {!loading && q && results.length === 0 && (
            <p className="muted">No results for “{q}”.</p>
          )}

          {!loading && results.length > 0 && (
            <ul className="result-list">
              {results.map((r) => (
                <li key={r.id} className="result-item">
                  <div className="col">
                    <span className="name">{r.name}</span>
                    <span className="meta">{Math.round(r.calories)} kcal</span>
                  </div>
                  <button
                    className="add-btn"
                    aria-label={`Add ${r.name}`}
                    onClick={() => onSelect?.(r)}
                    title="Add"
                  >
                    +
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="row-end">
          <button className="linklike" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}
