// src/components/exercise/charts/DailyMinutesChart.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from "recharts";
import { useExercise } from "../context/ExerciseContext.jsx";
import "./ExerciseCharts.css";

const GRID_COLOR = "#d7e2d8";
const AXIS_COLOR = "#6a8a7d";
const BAR_COLOR = "#2c5b49";
const TOOLTIP_BORDER = "#bdd0bf";

export default function DailyMinutesChart({ range, onSelectDate }) {
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
    const map = new Map();
    for (let i = 0; i <= daysBack; i++) { const d = new Date(start); d.setDate(start.getDate() + i); map.set(helpers.ymd(d), 0); }
    for (const log of state.logs) { const key = helpers.ymd(log.timestampISO); if (map.has(key)) map.set(key, map.get(key) + (log.minutes || 0)); }
    return Array.from(map.entries()).map(([date, minutes]) => ({ date, minutes }));
  }, [state.logs, range]);

  return (
    <div className="exercise-chart-shell" ref={shellRef}>
      <BarChart
        width={chartWidth}
        height={isPhone ? 220 : 300}
        data={data}
        margin={{ top: 8, right: isPhone ? 6 : 16, bottom: 8, left: isPhone ? -14 : 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke={AXIS_COLOR} tick={{ fontSize: isPhone ? 11 : 12, fill: AXIS_COLOR }} />
        <YAxis stroke={AXIS_COLOR} tick={{ fontSize: isPhone ? 11 : 12, fill: AXIS_COLOR }} width={isPhone ? 30 : 36} />
        <Tooltip contentStyle={{ borderRadius: 12, borderColor: TOOLTIP_BORDER }} />
        <Bar
          dataKey="minutes"
          radius={[8, 8, 0, 0]}
          fill={BAR_COLOR}
          onClick={(d) => onSelectDate?.(d?.date)}
        />
      </BarChart>
    </div>
  );
}
