"use client";

import { useEffect, useRef } from "react";
import { UI } from "../styles/ui.js";

export default function UndoBar({ message, undoLabel, onUndo, onDismiss }) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const timer = window.setTimeout(() => onDismissRef.current?.(), 6000);
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onDismissRef.current?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 ${UI.card} rounded-card bg-[var(--bg-raised)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-2xl`}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className={`${UI.buttonGhost} font-semibold`}
      >
        {undoLabel}
      </button>
    </div>
  );
}
