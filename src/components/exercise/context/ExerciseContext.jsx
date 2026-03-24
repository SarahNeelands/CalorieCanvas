import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from '../../../supabaseClient';

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
    return raw ? JSON.parse(raw) : { userId: null, exerciseTypes: DEFAULT_TYPES, logs: [] };
  } catch {
    return { userId: null, exerciseTypes: DEFAULT_TYPES, logs: [] };
  }
}

export function ExerciseProvider({ children, userId }) {
  const [state, setState] = useState(() => readStoredState());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!userId || state.userId === userId) return;
    setState((current) => ({ ...current, userId }));
  }, [userId, state.userId]);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      try {
        if (!userId) return;

        const { data: types, error: typesError } = await supabase
          .from('exercise_types')
          .select('*')
          .eq('user_id', userId);

        if (typesError) throw typesError;

        const { data: logs, error: logsError } = await supabase
          .from('exercise_logs')
          .select('*')
          .eq('user_id', userId)
          .order('timestamp_iso', { ascending: false })
          .limit(200);

        if (logsError) throw logsError;

        if (!mounted) return;

        setState((current) => ({
          ...current,
          userId,
          exerciseTypes: (types && types.length) ? types : current.exerciseTypes,
          logs: (logs || []).map((log) => ({
            id: log.id,
            userId: log.user_id,
            typeId: log.type_id,
            minutes: log.minutes,
            timestampISO: log.timestamp_iso,
          })),
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

    setState((current) => ({
      ...current,
      exerciseTypes: [...current.exerciseTypes, nextType],
    }));

    (async () => {
      try {
        if (!userId) return;
        await supabase.from('exercise_types').insert({ id: nextType.id, user_id: userId, name: nextType.name });
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

    setState((current) => ({
      ...current,
      logs: [log, ...(current.logs || [])],
    }));

    (async () => {
      try {
        if (!userId) return;
        await supabase.from('exercise_logs').insert({
          id: log.id,
          user_id: userId,
          type_id: typeId,
          minutes: normalizedMinutes,
          timestamp_iso: normalizedTimestamp,
        });
      } catch {}
    })();
  }

  function logsForDate(dateStr) {
    return (state.logs || []).filter((log) => log.userId === userId && ymd(log.timestampISO) === dateStr);
  }

  const value = {
    state,
    typesById,
    addExerciseType,
    addLog,
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
