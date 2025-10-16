import React, { useEffect } from "react";
export default function Modal({ title, onClose, children }) {
useEffect(() => {
const onKey = (e) => e.key === "Escape" && onClose?.();
document.addEventListener("keydown", onKey);
return () => document.removeEventListener("keydown", onKey);
}, [onClose]);


return (
<div className="fixed inset-0 z-50 flex items-center justify-center">
<div className="absolute inset-0 bg-black/40" onClick={onClose} />
<div className="relative z-10 w-[95vw] max-w-xl rounded-2xl bg-white p-5 shadow-xl">
{(title || onClose) && (
<div className="flex items-center justify-between mb-3">
<h3 className="text-lg font-semibold">{title}</h3>
<button className="text-gray-500 hover:text-black" onClick={onClose} aria-label="Close">×</button>
</div>
)}
{children}
</div>
</div>
);
}

