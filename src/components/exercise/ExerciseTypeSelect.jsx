import React, { useMemo } from "react";
export default function ExerciseTypeSelect({ valueId, query, onQuery, options, onSelect, onAddNew }) {
const filtered = useMemo(() => {
const q = (query || "").toLowerCase().trim();
return options.filter((t) => t.name.toLowerCase().includes(q));
}, [options, query]);


return (
<div className="relative">
<input
value={query}
onChange={(e) => onQuery?.(e.target.value)}
placeholder="Search or select exercise"
className="w-full rounded-xl border px-3 py-2"
/>
<div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-xl border bg-white shadow">
{filtered.map((t) => (
<div
key={t.id}
className={`px-3 py-2 cursor-pointer hover:bg-gray-50 ${valueId === t.id ? "bg-gray-100" : ""}`}
onMouseDown={(e) => { e.preventDefault(); onSelect?.(t); }}
>
{t.name}
</div>
))}
<div className="border-t" />
<div className="px-3 py-2 cursor-pointer hover:bg-gray-50 text-blue-600" onMouseDown={(e) => { e.preventDefault(); onAddNew?.(query); }}>
+ Add new exercise
</div>
</div>
</div>
);
}