"use client";

import { UI } from "../styles/ui.js";

export default function BatchStepper({ value, onChange, copy, disabled = false }) {
  const decrement = () => onChange(Math.max(1, value - 1));
  const increment = () => onChange(Math.min(4, value + 1));

  return (
    <div
      role="group"
      aria-label={copy.label}
      className={`inline-flex items-center gap-1 ${UI.card} rounded-xl bg-white/[0.03] px-1.5 py-1`}
    >
      <span className="px-1 text-sm font-medium text-white/65">
        {copy.label}
      </span>
      <button
        type="button"
        aria-label={copy.decrease}
        onClick={decrement}
        disabled={disabled || value <= 1}
        className={`${UI.buttonIcon} text-sm font-bold`}
      >
        −
      </button>
      <output
        aria-live="polite"
        aria-atomic="true"
        className="min-w-[1.25rem] text-center text-xs font-semibold tabular-nums text-white"
      >
        {value}
      </output>
      <button
        type="button"
        aria-label={copy.increase}
        onClick={increment}
        disabled={disabled || value >= 4}
        className={`${UI.buttonIcon} text-sm font-bold`}
      >
        +
      </button>
    </div>
  );
}
