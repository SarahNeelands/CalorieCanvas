import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  archiveExerciseDefinition,
  createExerciseDefinition,
  createExerciseLog,
  deleteExerciseLog,
  listExerciseDefinitions,
  listExerciseLogs,
  syncLocalExerciseState,
  updateExerciseDefinition,
  updateExerciseLog,
} from '../../../services/exerciseClient';

const STORAGE_KEY = "exercise_page_state_v3";
const ExerciseContext = createContext(null);

const DEFAULT_TYPES = [
  { id: "walk", name: "Walking" },
  { id: "run", name: "Running" },
  { id: "cycle", name: "Cycling" },
  { id: "yoga", name: "Yoga" },
  { id: "swim", name: "Swimming" },
];
const DEFAULT_STATE = { userId: null, exerciseTypes: DEFAULT_TYPES, logs: [] };

const rid = () => window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10);

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function ymd(date) {
  const next = new Date(date);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

function readStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

function writeStoredState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function mergeExerciseTypes(primary = [], fallback = []) {
  const merged = new Map();
  [...fallback, ...primary].forEach((type) => {
    if (!type?.id) return;
    merged.set(type.id, type);
  });
  return Array.from(merged.values());
}

function mergeLogs(primary = [], fallback = []) {
  const merged = new Map();
  [...fallback, ...primary].forEach((log) => {
    if (!log?.id) return;
    merged.set(log.id, log);
  });
  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.timestampISO || 0).getTime() - new Date(a.timestampISO || 0).getTime()
  );
}

export function ExerciseProvider({ children, userId }) {
  const [state, setState] = useState(() => readStoredState());

  useEffect(() => {
    writeStoredState(state);
  }, [state]);

  useEffect(() => {
    if (!userId || state.userId === userId) return;
    setState((current) => (
      current.userId && current.userId !== userId
        ? { ...DEFAULT_STATE, userId }
        : { ...current, userId }
    ));
  }, [userId, state.userId]);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      try {
        if (!userId) return;
        const localState = readStoredState();
        if (!localState.userId || localState.userId === userId) {
          const builtInIds = new Set(DEFAULT_TYPES.map((type) => type.id));
          await syncLocalExerciseState(userId, {
            definitions: (localState.exerciseTypes || []).filter((type) => !builtInIds.has(type.id)),
            logs: (localState.logs || []).filter((log) => !log.userId || log.userId === userId),
          }).catch(() => null);
        }

        const [types, logs] = await Promise.all([
          listExerciseDefinitions(userId),
          listExerciseLogs(userId, { limit: 200 }),
        ]);

        if (!mounted) return;

        setState((current) => ({
          ...current,
          userId,
          exerciseTypes: mergeExerciseTypes(types && types.length ? types : [], mergeExerciseTypes(current.exerciseTypes, localState.exerciseTypes)),
          logs: mergeLogs(logs || [], mergeLogs(current.logs, localState.logs)),
        }));
      } catch {
        if (!mounted) return;
        setState((current) => ({ ...current, userId }));
      }
    }

    hydrate();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const typesById = useMemo(
    () => Object.fromEntries((state.exerciseTypes || []).map((type) => [type.id, type])),
    [state.exerciseTypes]
  );

  function addExerciseType(nameRaw) {
    const name = nameRaw.trim();
    if (!name) return null;

    const existing = state.exerciseTypes.find((type) => type.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    const nextType = {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || rid(),
      name,
    };

    setState((current) => {
      const nextState = {
        ...current,
        exerciseTypes: mergeExerciseTypes([nextType], current.exerciseTypes),
      };
      writeStoredState(nextState);
      return nextState;
    });

    (async () => {
      try {
        if (!userId) return;
        const saved = await createExerciseDefinition(userId, nextType);
        if (saved) setState((current) => ({ ...current, exerciseTypes: mergeExerciseTypes([saved], current.exerciseTypes) }));
      } catch {}
    })();

    return nextType;
  }

  function addLog({ typeId, minutes, timestampISO }) {
    const normalizedMinutes = Math.max(1, Math.min(1440, parseInt(minutes, 10) || 0));
    const normalizedTimestamp = new Date(timestampISO || new Date()).toISOString();
    const log = {
      id: rid(),
      userId,
      typeId,
      minutes: normalizedMinutes,
      timestampISO: normalizedTimestamp,
    };

    setState((current) => {
      const nextState = {
        ...current,
        logs: mergeLogs([log], current.logs),
      };
      writeStoredState(nextState);
      return nextState;
    });

    (async () => {
      try {
        if (!userId) return;
        const saved = await createExerciseLog(userId, log);
        if (saved) setState((current) => ({ ...current, logs: mergeLogs([saved], current.logs) }));
      } catch {}
    })();
  }

  function logsForDate(dateStr) {
    return (state.logs || []).filter((log) => log.userId === userId && ymd(log.timestampISO) === dateStr);
  }

  async function editExerciseType(typeId, patch) {
    const saved = await updateExerciseDefinition(userId, typeId, patch);
    setState((current) => ({ ...current, exerciseTypes: mergeExerciseTypes([saved], current.exerciseTypes) }));
    return saved;
  }

  async function archiveExerciseType(typeId) {
    await archiveExerciseDefinition(userId, typeId);
    setState((current) => ({ ...current, exerciseTypes: current.exerciseTypes.filter((type) => type.id !== typeId) }));
  }

  async function editLog(log) {
    const saved = await updateExerciseLog(userId, log.serverId || log.id, log);
    setState((current) => ({ ...current, logs: mergeLogs([saved], current.logs) }));
    return saved;
  }

  async function removeLog(log) {
    await deleteExerciseLog(userId, log.serverId || log.id);
    setState((current) => ({ ...current, logs: current.logs.filter((item) => item.id !== log.id) }));
  }

  const value = {
    state,
    typesById,
    addExerciseType,
    addLog,
    editExerciseType,
    archiveExerciseType,
    editLog,
    removeLog,
    logsForDate,
    helpers: { startOfDay, ymd },
  };

  return <ExerciseContext.Provider value={value}>{children}</ExerciseContext.Provider>;
}

export function useExercise() {
  const context = useContext(ExerciseContext);
  if (!context) {
    throw new Error("useExercise must be used within ExerciseProvider");
  }
  return context;
}
