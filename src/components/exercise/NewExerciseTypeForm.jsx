import React, { useState } from "react";
import "./NewExerciseTypeForm.css";
export default function NewExerciseTypeForm({ initialName = "", onCancel, onCreate }) {
const [name, setName] = useState(initialName);
return (
<form onSubmit={(e) => { e.preventDefault(); const n = name.trim(); if (!n) return; onCreate?.(n); }} className="new-exercise-type-form">
<div>
<label className="new-exercise-type-form__label">Exercise name</label>
<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Rowing, Pilates" className="new-exercise-type-form__input" />
</div>
<div className="new-exercise-type-form__actions">
<button type="button" className="new-exercise-type-form__cancel" onClick={onCancel}>Cancel</button>
<button type="submit" className="new-exercise-type-form__create">Create</button>
</div>
</form>
);
}
