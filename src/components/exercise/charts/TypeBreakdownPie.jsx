// src/components/exercise/charts/TypeBreakdownPie.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Tooltip, Legend, Cell } from "recharts";
import { useExercise } from "../context/ExerciseContext.jsx";
import "./TypeBreakdownPie.css";
import "./ExerciseCharts.css";

const PIE_TOOLTIP_BORDER = "#bdd0bf";

export default function TypeBreakdownPie({ range }) {
  const { state, helpers } = useExercise();
  const shellRef = useRef(null);
  const [isPhone, setIsPhone] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(max-width: 640px)").matches
      : false
  );
  const [chartWidth, setChartWidth] = useState(320);
  const now = new Date();
  const daysBack = range === "7" ? 6 : 29;
  const start = helpers.startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack));
  const endMs = helpers.startOfDay(now).getTime() + 86400000 - 1;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const sync = (event) => setIsPhone(event.matches);
    setIsPhone(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", sync);
      return () => mediaQuery.removeEventListener("change", sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

  useEffect(() => {
    function updateWidth() {
      const nextWidth = shellRef.current?.clientWidth || 0;
      if (nextWidth) {
        setChartWidth(Math.max(220, nextWidth - 4));
      }
    }

    updateWidth();

    if (typeof ResizeObserver !== "undefined" && shellRef.current) {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(shellRef.current);
      window.addEventListener("resize", updateWidth);
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", updateWidth);
      };
    }

    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const data = useMemo(() => {
    const acc = new Map();
    const startMs = start.getTime();
    for (const log of state.logs) {
      const t = new Date(log.timestampISO).getTime();
      if (t >= startMs && t <= endMs) acc.set(log.typeId, (acc.get(log.typeId) || 0) + (log.minutes || 0));
    }
    const lookup = Object.fromEntries(state.exerciseTypes.map((t) => [t.id, t.name]));
    return Array.from(acc.entries()).map(([typeId, minutes]) => ({ name: lookup[typeId] || typeId, typeId, minutes }));
  }, [endMs, start, state.exerciseTypes, state.logs]);

  if (!data.length) return <div className="ex-empty">No exercise logged in this range yet.</div>;

  const fills = ["#2c5b49", "#5f8f7a", "#b8c99f", "#97bba7", "#d5e2cf"];

  return (
    <div className="exercise-chart-shell exercise-chart-shell--pie" ref={shellRef}>
      <PieChart width={chartWidth} height={isPhone ? 250 : 248}>
        <Pie
          data={data}
          dataKey="minutes"
          nameKey="name"
          cx="50%"
          cy={isPhone ? 92 : "50%"}
          outerRadius={isPhone ? 64 : 94}
          label={!isPhone}
        >
          {data.map((entry, i) => (<Cell key={entry.typeId} fill={fills[i % fills.length]} />))}
        </Pie>
        <Legend
          verticalAlign={isPhone ? "bottom" : "middle"}
          align={isPhone ? "center" : "right"}
          layout={isPhone ? "horizontal" : "vertical"}
          wrapperStyle={{ color: "#4b665c", fontSize: isPhone ? 12 : 13, width: isPhone ? Math.max(180, chartWidth - 12) : undefined }}
        />
        <Tooltip contentStyle={{ borderRadius: 12, borderColor: PIE_TOOLTIP_BORDER }} />
      </PieChart>
    </div>
  );
}
