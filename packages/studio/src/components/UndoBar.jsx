"use client";

import { useEffect, useRef } from "react";

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
      className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-lg border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white shadow-2xl"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="rounded px-2 py-1 font-semibold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        {undoLabel}
      </button>
    </div>
  );
}
