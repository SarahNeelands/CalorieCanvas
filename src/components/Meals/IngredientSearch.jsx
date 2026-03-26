/**
 * Modal/panel for searching catalog ingredients; shows results with + to add.
 * Displays all saved ingredients on open and filters when searching.
 */

import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./IngredientSearch.css";
import { getCachedCatalogItems, listCatalogItems } from "../../services/catalogClient";
import { BUILT_IN_INGREDIENTS } from "../../services/builtInIngredients";
import Modal from "../ui/Modal";

function mapIngredientResult(item) {
  return {
    ...item,
    name: item.title,
    calories: item.kcal_per_100g,
    brand: item.unit_conversions?.brand || "",
  };
}

function mergeIngredientResults(current, incoming) {
  const merged = new Map();

  for (const item of current) {
    merged.set(item.id, item);
  }

  for (const item of incoming) {
    merged.set(item.id, item);
  }

  return Array.from(merged.values());
}

export default function IngredientSearch({ onSelect, onClose, mealDraft }) {
  const initialResults = mergeIngredientResults(
    getCachedCatalogItems("ingredient").map(mapIngredientResult),
    BUILT_IN_INGREDIENTS.map(mapIngredientResult)
  );
  const [q, setQ] = useState("");
  const [allResults, setAllResults] = useState(initialResults);
  const [results, setResults] = useState(initialResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    async function loadResults() {
      setLoading(true);
      setError("");
      try {
        const data = await listCatalogItems("ingredient");
        if (cancelled) return;
        const mapped = (data || []).map(mapIngredientResult);
        setAllResults((current) => mergeIngredientResults(current, mapped));
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Failed to load ingredients.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadResults();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const normalizedQuery = q.trim().toLowerCase();
    const filtered = normalizedQuery
      ? allResults.filter((item) => {
          const haystacks = [item.name, item.brand, item.title];
          return haystacks.some((value) => value?.toLowerCase().includes(normalizedQuery));
        })
      : allResults;

    setResults(filtered);
  }, [allResults, q]);

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

  return (
    <Modal open title="Find an ingredient" onClose={onClose}>
      <div className="ingredient-search-modal" ref={boxRef}>
        <div className="ingredient-search-modal__toolbar">
          <div className="ingredient-search-modal__search">
            <input
              autoFocus
              className="ingredient-search-modal__input"
              type="search"
              placeholder="Search ingredients..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q ? (
              <button
                className="ingredient-search-modal__clear"
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>

        <div className="ingredient-search-modal__results">
          {loading && results.length === 0 && <p className="muted">Loading...</p>}
          {!loading && error && results.length === 0 && <p className="muted">{error}</p>}
          {!loading && !error && q && results.length === 0 && (
            <p className="muted">No results for "{q}".</p>
          )}
          {!loading && !error && !q && results.length === 0 && (
            <p className="muted">No ingredients yet. Add one first.</p>
          )}
          {results.length > 0 && (
            <ul className="is-list">
              {results.map((r) => (
                <li key={r.id} onClick={() => onSelect?.(r)} role="button" tabIndex={0} onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.(r);
                  }
                }}>
                  <div className="is-main">
                    <span className="name">{r.name}</span>
                  </div>
                  <div className="is-actions">
                    <button className="edit" onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(r);
                    }} type="button">
                      Edit
                    </button>
                    <button className="add" onClick={(e) => {
                      e.stopPropagation();
                      onSelect?.(r);
                    }} title="Add" type="button">+</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
