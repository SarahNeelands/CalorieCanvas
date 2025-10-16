import React from "react";
import SegmentedControl from "../ui/SegmentedControl.jsx";
export default function ExercisePageHeader({ range, onChangeRange, onLog }) {
return (
<header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
<h1 className="text-2xl font-semibold">Exercise</h1>
<div className="flex items-center gap-3">
<SegmentedControl
value={range}
options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }]}
onChange={onChangeRange}
/>
<button className="px-4 py-2 rounded-2xl shadow bg-black text-white hover:opacity-90" onClick={onLog}>
Log exercise
</button>
</div>
</header>
);
}