import React, { useEffect } from "react";
import "./Modal.css";

export default function Modal({ open = true, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cc-modal-overlay" role="dialog" aria-modal="true" aria-label={title || "Dialog"}>
      <div className="cc-modal-backdrop" onClick={onClose} />
      <div className="cc-modal-surface">
        {(title || onClose) && (
          <div className="cc-modal-header">
            <h3 className="cc-modal-title">{title}</h3>
            {onClose && (
              <button className="cc-modal-close" onClick={onClose} aria-label="Close" type="button">
                x
              </button>
            )}
          </div>
        )}
        <div className="cc-modal-body">{children}</div>
      </div>
    </div>
  );
}
