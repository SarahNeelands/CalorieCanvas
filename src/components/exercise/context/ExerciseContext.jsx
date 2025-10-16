import React, { createContext, useContext, useEffect, useMemo, useState } from "react";


const STORAGE_KEY = "exercise_page_state_v3";
const ExerciseContext = createContext(null);


const DEFAULT_TYPES = [
{ id: "walk", name: "Walking" },
{ id: "run", name: "Running" },
{ id: "cycle", name: "Cycling" },
{ id: "yoga", name: "Yoga" },
{ id: "swim", name: "Swimming" },
];


const rid = () => Math.random().toString(36).slice(2, 10);


function startOfDay(date) { const d = new Date(date); d.setHours(0,0,0,0); return d; }
function ymd(date) { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }


export function ExerciseProvider({ children }) {
const [state, setState] = useState(() => {
try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch {}
return { userId: "demo-user", exerciseTypes: DEFAULT_TYPES, logs: [] };
});


useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);


const typesById = useMemo(() => Object.fromEntries(state.exerciseTypes.map(t => [t.id, t])), [state.exerciseTypes]);


function addExerciseType(nameRaw) {
const name = nameRaw.trim(); if (!name) return null;
const existing = state.exerciseTypes.find(t => t.name.toLowerCase() === name.toLowerCase());
if (existing) return existing;
const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || rid();
const t = { id, name }; setState(s => ({ ...s, exerciseTypes: [...s.exerciseTypes, t] })); return t;
}


function addLog({ typeId, minutes, timestampISO }) {
const m = Math.max(1, Math.min(1440, parseInt(minutes, 10) || 0));
const ts = new Date(timestampISO || new Date()).toISOString();
const log = { id: rid(), userId: state.userId, typeId, minutes: m, timestampISO: ts };
setState(s => ({ ...s, logs: [log, ...s.logs] }));
}


function logsForDate(dateStr) { return state.logs.filter(l => ymd(l.timestampISO) === dateStr); }


const value = { state, typesById, addExerciseType, addLog, logsForDate, helpers: { startOfDay, ymd } };
return <ExerciseContext.Provider value={value}>{children}</ExerciseContext.Provider>;
}


export function useExercise() { const ctx = useContext(ExerciseContext); if (!ctx) throw new Error("useExercise must be used within ExerciseProvider"); return ctx; }

