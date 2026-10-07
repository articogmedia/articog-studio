export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-10 h-10 border-2 border-white/[0.08] border-t-white rounded-full animate-spin" />
      <p className="text-white/55 text-sm font-bold uppercase tracking-widest animate-pulse">Syncing Library...</p>
    </div>
  );
}
