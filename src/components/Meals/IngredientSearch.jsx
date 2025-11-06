/** IngredientSearch.jsx
 * Modal/panel for searching catalog ingredients; shows results with + to add.
 * Displays "No results" when none; ESC or Close to dismiss.
 */


import React, { useEffect, useRef, useState } from "react";
import "./IngredientSearch.css";

/* mock search */
async function searchIngredients(query) {
  if (!query?.trim()) return [];
  const pool = [
    { id:"1", name:"Protein Powder", calories:120 },
    { id:"2", name:"Banana", calories:105 },
    { id:"3", name:"Almond Milk", calories:30 },
    { id:"4", name:"Chicken Breast (diced)", calories:130 },
  ];
  return pool.filter(x => x.name.toLowerCase().includes(query.toLowerCase()));
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
    setResults(await searchIngredients(q));
    setLoading(false);
  };

  return (
    <div className="is-backdrop" role="dialog" aria-modal="true">
      <div className="is-card" ref={boxRef}>
        <header className="row-between">
          <h4>Find an ingredient</h4>
          <button className="linklike" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="is-row">
          <input
            autoFocus
            type="search"
            placeholder="Search by name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
          />
          <button className="btn" onClick={doSearch} disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        <div className="is-results">
          {loading && <p className="muted">Searching…</p>}
          {!loading && q && results.length === 0 && <p className="muted">No results for “{q}”.</p>}
          {!loading && results.length > 0 && (
            <ul className="is-list">
              {results.map((r) => (
                <li key={r.id}>
                  <div className="col">
                    <span className="name">{r.name}</span>
                    <span className="meta">{Math.round(r.calories)} kcal</span>
                  </div>
                  <button className="add" onClick={() => onSelect?.(r)} title="Add">+</button>
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
