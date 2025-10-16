import React, { useState } from "react";
import ExerciseTypeSelect from "./ExerciseTypeSelect.jsx";


export default function ExerciseLogForm({ types, onAddNewType, onSubmit }) {
const [query, setQuery] = useState("");
const [selected, setSelected] = useState(null);
const [minutes, setMinutes] = useState(30);
const [dateTime, setDateTime] = useState(() => new Date().toISOString().slice(0, 16));


return (
<form onSubmit={(e) => { e.preventDefault(); const chosen = selected || types.find(t => t.name.toLowerCase() === query.toLowerCase()); if (!chosen) return; onSubmit?.({ typeId: chosen.id, minutes, timestampISO: new Date(dateTime).toISOString() }); }} className="space-y-4">
<div>
<label className="block text-sm font-medium mb-1">Exercise</label>
<ExerciseTypeSelect
valueId={selected?.id}
query={query}
onQuery={(v) => { setQuery(v); setSelected(null); }}
options={types}
onSelect={(t) => { setSelected(t); setQuery(t.name); }}
onAddNew={onAddNewType}
/>
</div>


<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<div>
<label className="block text-sm font-medium mb-1">Duration (minutes)</label>
<input type="number" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-full rounded-xl border px-3 py-2" />
</div>
<div>
<label className="block text-sm font-medium mb-1">Date & Time</label>
<input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} className="w-full rounded-xl border px-3 py-2" />
</div>
</div>


<div className="flex items-center justify-end gap-2 pt-2">
<button type="submit" className="px-4 py-2 rounded-xl bg-black text-white">Add</button>
</div>
</form>
);
}

