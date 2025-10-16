import React from "react";
export default function SegmentedControl({ value, options, onChange }) {
return (
<div className="inline-flex rounded-full border border-gray-300 overflow-hidden">
{options.map((opt) => (
<button
key={opt.value}
onClick={() => onChange?.(opt.value)}
className={`px-3 py-1 text-sm ${value === opt.value ? "bg-black text-white" : "bg-white hover:bg-gray-50"}`}
>
{opt.label}
</button>
))}
</div>
);
}