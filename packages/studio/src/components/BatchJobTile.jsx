"use client";

export default function BatchJobTile({ job, kind, copy }) {
  const failed = job.status === "failed";
  const isVideo = kind === "video";
  const label = failed
    ? copy.failed
    : job.status === "queued"
      ? copy.queued
      : copy.generating;

  return (
    <div
      role={failed ? "alert" : "status"}
      className={`relative flex ${isVideo ? "aspect-video" : "aspect-square"} flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-4 text-center`}
    >
      {!failed && (
        <span
          aria-hidden="true"
          className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-[var(--color-accent)]"
        />
      )}
      <span className="text-xs font-semibold text-white/75">{label}</span>
      {failed && job.error && (
        <p className="max-w-full break-words text-[11px] leading-relaxed text-red-300">
          {job.error}
        </p>
      )}
    </div>
  );
}
