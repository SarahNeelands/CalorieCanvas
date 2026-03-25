import React, { useState } from "react";
import ExerciseTypeSelect from "./ExerciseTypeSelect.jsx";
import "./ExerciseLogForm.css";


export default function ExerciseLogForm({ types, onAddNewType, onSubmit }) {
const [query, setQuery] = useState("");
const [selected, setSelected] = useState(null);
const [minutes, setMinutes] = useState(30);
const [dateTime, setDateTime] = useState(() => new Date().toISOString().slice(0, 16));


return (
<form onSubmit={(e) => { e.preventDefault(); const chosen = selected || types.find(t => t.name.toLowerCase() === query.toLowerCase()); if (!chosen) return; onSubmit?.({ typeId: chosen.id, minutes, timestampISO: new Date(dateTime).toISOString() }); }} className="exercise-log-form">
<div className="exercise-log-form__panel exercise-log-form__panel--picker">
<ExerciseTypeSelect
valueId={selected?.id}
query={query}
onQuery={(v) => { setQuery(v); setSelected(null); }}
options={types}
onSelect={(t) => { setSelected(t); setQuery(t.name); }}
onAddNew={onAddNewType}
/>
</div>

<div className="exercise-log-form__panel exercise-log-form__panel--details">
<div className="exercise-log-form__field">
<label className="exercise-log-form__label">Duration (minutes)</label>
<input type="number" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="exercise-log-form__input" />
</div>
<div className="exercise-log-form__field">
<label className="exercise-log-form__label">Date & Time</label>
<div className="exercise-log-form__date-wrap">
<input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} className="exercise-log-form__input exercise-log-form__input--date" />
</div>
</div>
</div>


<div className="exercise-log-form__actions">
<button type="submit" className="exercise-log-form__submit">Log Exercise</button>
</div>
</form>
);
}

