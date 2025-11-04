// src/components/ui/Card.jsx
import React from "react";
import "./Card.css";

export default function Card({ title, children, footer }) {
  return (
    <section className="cc-card">
      {title && <h3 className="cc-card-title">{title}</h3>}
      <div className="cc-card-body">{children}</div>
      {footer && <div className="cc-card-footer">{footer}</div>}
    </section>
  );
}
