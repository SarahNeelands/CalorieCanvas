import React from "react";
export function Card({ title, children, actions }) {
return (
<div className="rounded-2xl border border-gray-200 shadow-sm p-4 bg-white">
<div className="flex items-center justify-between mb-2">
<h2 className="font-medium">{title}</h2>
{actions}
</div>
{children}
</div>
);
}export default Card;
