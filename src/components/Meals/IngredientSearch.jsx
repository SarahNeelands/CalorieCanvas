/**
 * Modal/panel for searching catalog ingredients; shows results with + to add.
 * Displays all saved ingredients on open and filters when searching.
 */

import React, { useDeferredValue, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./IngredientSearch.css";
import { getCachedCatalogItems, listCatalogItems } from "../../services/catalogClient";

function mapIngredientResult(item) {
  return {
    ...item,
    name: item.title,
    calories: item.kcal_per_100g,
    brand: item.unit_conversions?.brand || "",
  };
}

export default function IngredientSearch({ onSelect, onClose, mealDraft }) {
  const [q, setQ] = useState("");
  const deferredQuery = useDeferredValue(q);
  const [allResults, setAllResults] = useState(() => getCachedCatalogItems("ingredient").map(mapIngredientResult));
  const [loading, setLoading] = useState(allResults.length === 0);
  const [error, setError] = useState("");
  const boxRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function loadResults() {
    if (!allResults.length) {
      setLoading(true);
    }
    setError("");
    try {
      const data = await listCatalogItems("ingredient");

      setAllResults((data || []).map(mapIngredientResult));
    } catch (err) {
      if (!allResults.length) {
        setAllResults([]);
      }
      setError(err.message || "Failed to load ingredients.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadResults();
  }, []);

  function handleEdit(item) {
    onClose?.();
    navigate("/ingredients/new", {
      state: {
        ingredient: item,
        mealDraft,
        returnTo: location.pathname,
      },
    });
  }

  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const results = normalizedQuery
    ? allResults.filter((item) => {
        const haystacks = [
          item.name,
          item.brand,
          item.title,
        ];
        return haystacks.some((value) => value?.toLowerCase().includes(normalizedQuery));
      })
    : allResults;

  return (
    <div className="is-backdrop" role="dialog" aria-modal="true">
      <div className="is-card" ref={boxRef}>
        <header className="row-between">
          <h4>Find an ingredient</h4>
          <button className="linklike" onClick={onClose} aria-label="Close">X</button>
        </header>

        <div className="is-row">
          <input
            autoFocus
            type="search"
            placeholder="Search by name..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn" disabled={loading}>
            {loading ? "Loading..." : "Ready"}
          </button>
        </div>

        <div className="is-results">
          {loading && <p className="muted">Loading...</p>}
          {!loading && error && <p className="muted">{error}</p>}
          {!loading && !error && q && results.length === 0 && (
            <p className="muted">No results for "{q}".</p>
          )}
          {!loading && !error && !q && results.length === 0 && (
            <p className="muted">No ingredients yet. Add one first.</p>
          )}
          {!loading && results.length > 0 && (
            <ul className="is-list">
              {results.map((r) => (
                <li key={r.id}>
                  <div className="is-main">
                    <div className="col">
                      <span className="name">{r.name}</span>
                      <span className="meta">{Math.round(r.calories)} kcal</span>
                    </div>
                    <div className="is-brand" title={r.brand || ""}>
                      {r.brand || ""}
                    </div>
                  </div>
                  <div className="is-actions">
                    <button className="edit" onClick={() => handleEdit(r)} type="button">
                      Edit
                    </button>
                    <button className="add" onClick={() => onSelect?.(r)} title="Add" type="button">+</button>
                  </div>
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
