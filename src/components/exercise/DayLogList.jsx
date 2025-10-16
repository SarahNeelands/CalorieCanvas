import React from "react";
export default function DayLogList({ logs, typesById }) {
if (!logs?.length) return <div className="text-sm text-gray-600">No logs for this day.</div>;
return (
<ul className="divide-y">
{logs.map((l) => (
<li key={l.id} className="py-2 flex items-center justify-between">
<div>
<div className="font-medium">{typesById[l.typeId]?.name || l.typeId}</div>
<div className="text-xs text-gray-500">{new Date(l.timestampISO).toLocaleString()}</div>
</div>
<div className="text-sm tabular-nums">{l.minutes} min</div>
</li>
))}
</ul>
);
}