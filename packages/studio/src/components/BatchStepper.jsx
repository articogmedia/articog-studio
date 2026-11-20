"use client";

export default function BatchStepper({ value, onChange, copy, disabled = false }) {
  const decrement = () => onChange(Math.max(1, value - 1));
  const increment = () => onChange(Math.min(4, value + 1));

  return (
    <div
      role="group"
      aria-label={copy.label}
      className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-1.5 py-1"
    >
      <span className="px-1 text-[10px] font-medium text-white/50">
        {copy.label}
      </span>
      <button
        type="button"
        aria-label={copy.decrease}
        onClick={decrement}
        disabled={disabled || value <= 1}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
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
        className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
