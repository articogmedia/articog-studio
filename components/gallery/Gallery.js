"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const PAGE_SIZE = 24;
const buttonClass = "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/75 transition hover:bg-white/10 hover:text-white disabled:opacity-40";

function outputList(item) {
  if (Array.isArray(item.outputs)) return item.outputs.filter((url) => typeof url === "string");
  return typeof item.outputs === "string" ? [item.outputs] : [];
}

export default function Gallery({
  embedded = false,
  onRerun,
  selectedProjectId = "",
  onSelectedProjectChange,
  projects: projectOptions,
  onCreateProject,
}) {
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [model, setModel] = useState("");
  const [type, setType] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [projectId, setProjectId] = useState(selectedProjectId);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search.trim()) params.set("search", search.trim());
    if (model) params.set("model", model);
    if (type) params.set("type", type);
    if (favoritesOnly) params.set("favorite", "true");
    if (projectId) params.set("project_id", projectId);
    try {
      const response = await fetch(`/api/history?${params.toString()}`, { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setError("Sign in to browse your generation history.");
        setItems([]);
        setTotal(0);
        return;
      }
      if (!response.ok) throw new Error(data.error || "Could not load history.");
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (loadError) {
      setError(loadError.message || "Could not load history.");
    } finally {
      setLoading(false);
    }
  }, [favoritesOnly, model, page, projectId, search, type]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setProjectId(selectedProjectId);
  }, [selectedProjectId]);
  useEffect(() => {
    if (projectOptions) setProjects(projectOptions);
  }, [projectOptions]);
  useEffect(() => {
    if (projectOptions) return undefined;
    fetch("/api/projects", { credentials: "same-origin" })
      .then(async (response) => {
        if (response.status === 401) return [];
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load projects.");
        return data.projects || [];
      })
      .then(setProjects)
      .catch((projectError) => setError(projectError.message));
    return undefined;
  }, [projectOptions]);

  const updateItem = async (item, patch) => {
    try {
      const response = await fetch(`/api/history/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(patch),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update history item.");
      setItems((current) => current.map((entry) => entry.id === item.id ? data : entry));
    } catch (updateError) {
      setError(updateError.message);
    }
  };

  const deleteItem = async (item) => {
    if (!window.confirm("Remove this history entry? The generated file will not be deleted.")) return;
    try {
      const response = await fetch(`/api/history/${item.id}`, { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Could not delete history entry.");
      }
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setTotal((current) => Math.max(0, current - 1));
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const download = async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed (${response.status}).`);
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = url.split("/").pop()?.split("?")[0] || "articog-output";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (downloadError) {
      setError(downloadError.message || "Could not download this output.");
    }
  };

  const modelOptions = [...new Set(items.map((item) => item.model).filter(Boolean))].sort();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className={embedded ? "h-full w-full overflow-y-auto text-white" : "mx-auto w-full max-w-[1400px] px-6 md:px-8 py-8 h-full overflow-y-auto text-white"}>
      <header className="mb-6 flex min-w-0 items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Your creations</p>
          <h1 className="mt-1 text-2xl font-semibold">Gallery</h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-sm text-white/45 sm:inline">{total} items</span>
          <button
            type="button"
            onClick={onCreateProject}
            className="h-9 shrink-0 rounded-control border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)]"
          >
            New project
          </button>
        </div>
      </header>
      <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3">
        <input aria-label="Search prompts" placeholder="Search prompts…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30" />
        <select aria-label="Filter by model" value={model} onChange={(event) => { setModel(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-white/10 bg-[#111318] px-3 py-2 text-sm">
          <option value="">All models</option>
          {modelOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select aria-label="Filter by type" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-white/10 bg-[#111318] px-3 py-2 text-sm">
          <option value="">Images and videos</option><option value="image">Images</option><option value="video">Videos</option>
        </select>
        <select aria-label="Filter by project" value={projectId} onChange={(event) => { setProjectId(event.target.value); onSelectedProjectChange?.(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-white/10 bg-[#111318] px-3 py-2 text-sm">
          <option value="">All projects</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <button type="button" onClick={() => { setFavoritesOnly((current) => !current); setPage(1); }} aria-pressed={favoritesOnly} className={`h-10 ${buttonClass} ${favoritesOnly ? "border-amber-300/50 text-amber-200" : ""}`}>{favoritesOnly ? "★ Favorites" : "☆ Favorites"}</button>
      </div>
      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-rose-300/20 bg-rose-400/5 p-4 text-sm text-rose-200">
          {error}
          {error.startsWith("Sign in") && <Link href="/login" className="ml-3 underline">Sign in</Link>}
        </div>
      )}
      {loading ? <p className="py-12 text-center text-sm text-white/45">Loading gallery…</p> : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center text-sm text-white/45">No saved generations match these filters.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map((item) => {
            const outputs = outputList(item);
            const url = outputs[0];
            return (
              <article key={item.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
                <div className="relative aspect-[4/3] bg-black/40">
                  {url && item.type === "video"
                    ? <video src={url} controls className="h-full w-full object-contain" preload="metadata" />
                    : url && <img src={url} alt={item.prompt || "Generated image"} className="h-full w-full object-cover" loading="lazy" />}
                  <button type="button" onClick={() => void updateItem(item, { favorite: !item.favorite })} aria-label={item.favorite ? "Remove favorite" : "Add favorite"} className="absolute right-2 top-2 rounded-full bg-black/65 px-2.5 py-1.5 text-lg text-amber-300">{item.favorite ? "★" : "☆"}</button>
                </div>
                <div className="space-y-3 p-3.5">
                  <p className="line-clamp-3 min-h-[3.75rem] text-sm text-white/75">{item.prompt || "No prompt saved"}</p>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-white/40">
                    <span className="truncate">{item.model}</span><span className="shrink-0 capitalize">{item.type}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!url} onClick={() => void download(url)} className={buttonClass}>Download</button>
                    <button type="button" onClick={() => onRerun?.(item)} className={buttonClass}>Re-run</button>
                    <button type="button" onClick={() => void deleteItem(item)} className={`${buttonClass} text-rose-200`}>Delete</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {pageCount > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-4" aria-label="Gallery pages">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className={buttonClass}>Previous</button>
          <span className="text-xs text-white/50">Page {page} of {pageCount}</span>
          <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className={buttonClass}>Next</button>
        </nav>
      )}
    </section>
  );
}
