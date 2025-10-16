import React, { useState } from "react";
export default function NewExerciseTypeForm({ initialName = "", onCancel, onCreate }) {
const [name, setName] = useState(initialName);
return (
<form onSubmit={(e) => { e.preventDefault(); const n = name.trim(); if (!n) return; onCreate?.(n); }} className="space-y-4">
<div>
<label className="block text-sm font-medium mb-1">Exercise name</label>
<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Rowing, Pilates" className="w-full rounded-xl border px-3 py-2" />
</div>
<div className="flex items-center justify-end gap-2">
<button type="button" className="px-4 py-2 rounded-xl border" onClick={onCancel}>Cancel</button>
<button type="submit" className="px-4 py-2 rounded-xl bg-black text-white">Create</button>
</div>
</form>
);
}