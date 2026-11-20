export const UI = {
  buttonPrimary:
    "inline-flex min-h-11 sm:min-h-9 items-center justify-center gap-2 rounded-control border border-transparent bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] disabled:cursor-not-allowed disabled:opacity-60",
  buttonSecondary:
    "inline-flex min-h-11 sm:min-h-9 items-center justify-center gap-2 rounded-control border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] disabled:cursor-not-allowed disabled:opacity-60",
  buttonGhost:
    "inline-flex min-h-11 sm:min-h-9 items-center justify-center gap-2 rounded-control border border-transparent px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] disabled:cursor-not-allowed disabled:opacity-60",
  buttonIcon:
    "inline-flex min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 items-center justify-center rounded-control border border-transparent p-2 text-[var(--text-secondary)] transition-colors hover:bg-white/[0.08] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] disabled:cursor-not-allowed disabled:opacity-60",
  input:
    "min-h-11 sm:min-h-9 w-full rounded-control border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60",
  textarea:
    "w-full rounded-control border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60",
  select:
    "min-h-11 sm:min-h-9 w-full rounded-control border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60",
  tabPill:
    "inline-flex min-h-11 sm:min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]",
  tabPillActive:
    "bg-white/[0.12] text-[var(--text-primary)]",
  tabPillInactive:
    "text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]",
  card:
    "rounded-card border border-[var(--border-subtle)] bg-[var(--bg-surface)]",
  badge:
    "inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]",
  dropdown:
    "rounded-card border border-[var(--border-subtle)] bg-[var(--bg-raised)] p-2 shadow-xl",
  dropdownItem:
    "flex min-h-11 sm:min-h-9 w-full items-center rounded-control px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60",
  modalOverlay:
    "fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm",
  modal:
    "w-full rounded-modal border border-[var(--border-subtle)] bg-[var(--bg-raised)] p-6 shadow-2xl",
};
