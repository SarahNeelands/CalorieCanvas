// src/components/exercise/charts/DailyMinutesChart.jsx
import React, { useMemo } from "react";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from "recharts";
import { useExercise } from "../context/ExerciseContext.jsx";

export default function DailyMinutesChart({ range, onSelectDate }) {
  const { state, helpers } = useExercise();
  const now = new Date();
  const daysBack = range === "7" ? 6 : 29;
  const start = helpers.startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack));

  const data = useMemo(() => {
    const map = new Map();
    for (let i = 0; i <= daysBack; i++) { const d = new Date(start); d.setDate(start.getDate() + i); map.set(helpers.ymd(d), 0); }
    for (const log of state.logs) { const key = helpers.ymd(log.timestampISO); if (map.has(key)) map.set(key, map.get(key) + (log.minutes || 0)); }
    return Array.from(map.entries()).map(([date, minutes]) => ({ date, minutes }));
  }, [state.logs, range]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--cc-green-100)" />
        <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="var(--cc-green-400)" />
        <YAxis stroke="var(--cc-green-400)" />
        <Tooltip contentStyle={{ borderRadius: 12, borderColor: "var(--cc-green-200)" }} />
        <Bar
          dataKey="minutes"
          radius={[8, 8, 0, 0]}
          fill="var(--cc-green-600)"
          onClick={(d) => onSelectDate?.(d?.date)}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
