import React, { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Tooltip, Legend, Cell } from "recharts";
import { useExercise } from "../context/ExerciseContext.jsx";


export default function TypeBreakdownPie({ range }) {
const { state, helpers } = useExercise();
const now = new Date();
const daysBack = range === "7" ? 6 : 29;
const start = helpers.startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack));
const endMs = helpers.startOfDay(now).getTime() + 86400000 - 1;


const data = useMemo(() => {
const acc = new Map();
const startMs = start.getTime();
for (const log of state.logs) {
const t = new Date(log.timestampISO).getTime();
if (t >= startMs && t <= endMs) acc.set(log.typeId, (acc.get(log.typeId) || 0) + (log.minutes || 0));
}
const lookup = Object.fromEntries(state.exerciseTypes.map((t) => [t.id, t.name]));
return Array.from(acc.entries()).map(([typeId, minutes]) => ({ name: lookup[typeId] || typeId, typeId, minutes }));
}, [state.logs, state.exerciseTypes, range]);


if (!data.length) return <div className="text-sm text-gray-500">No exercise logged in this range yet.</div>;


return (
<ResponsiveContainer width="100%" height={300}>
<PieChart>
<Pie data={data} dataKey="minutes" nameKey="name" cx="50%" cy="50%" outerRadius={110} label>
{data.map((entry) => (<Cell key={entry.typeId} />))}
</Pie>
<Legend />
<Tooltip />
</PieChart>
</ResponsiveContainer>
);
}