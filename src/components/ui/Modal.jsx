import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import "./Modal.css";

export default function Modal({ open = true, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const content = (
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

  if (typeof document === "undefined") {
    return content;
  }

  return createPortal(content, document.body);
}
