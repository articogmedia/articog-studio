"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteAsset,
  deleteProject,
  listAssets,
  listProjects,
  moveAsset,
  renameProject,
  toggleFavorite,
} from "../library/libraryStore";

const TABS = ["Projects", "Image", "Video", "Favorites"];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function AssetsLibrary({ onAssetAction, onProjectsChange }) {
  const [tab, setTab] = useState("Projects");
  const [projects, setProjects] = useState([]);
  const [assets, setAssets] = useState([]);
  const [openedProjectId, setOpenedProjectId] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loadError, setLoadError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [nextProjects, nextAssets] = await Promise.all([
        listProjects(),
        listAssets(),
      ]);
      setProjects(nextProjects);
      onProjectsChange?.(nextProjects);
      setAssets(nextAssets);
      setLoadError("");
      setSelectedAsset((current) =>
        current ? nextAssets.find((asset) => asset.id === current.id) || null : null,
      );
    } catch (error) {
      console.error("[AssetsLibrary] Could not load library:", error);
      setLoadError("Could not load your library.");
    }
  }, [onProjectsChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visibleAssets = useMemo(() => {
    if (tab === "Image") return assets.filter((asset) => asset.kind === "image");
    if (tab === "Video") return assets.filter((asset) => asset.kind === "video");
    if (tab === "Favorites") return assets.filter((asset) => asset.favorite);
    if (openedProjectId) {
      return assets.filter((asset) => asset.projectId === openedProjectId);
    }
    return [];
  }, [assets, openedProjectId, tab]);

  const selectedProject = projects.find((project) => project.id === openedProjectId);
  const projectName = (projectId) =>
    projects.find((project) => project.id === projectId)?.name || "Untitled";

  const handleRenameProject = async (project) => {
    const name = window.prompt("Project name", project.name);
    if (!name?.trim()) return;
    try {
      await renameProject(project.id, name);
      await refresh();
    } catch (error) {
      console.error("[AssetsLibrary] Could not rename project:", error);
      setLoadError("Could not rename project.");
    }
  };

  const handleDeleteProject = async (project) => {
    if (project.id === "default" || !window.confirm(`Delete "${project.name}"? Its assets will move to Untitled.`)) return;
    try {
      await deleteProject(project.id);
      setOpenedProjectId(null);
      await refresh();
    } catch (error) {
      console.error("[AssetsLibrary] Could not delete project:", error);
      setLoadError("Could not delete project.");
    }
  };

  const handleFavorite = async () => {
    if (!selectedAsset) return;
    try {
      await toggleFavorite(selectedAsset.id);
      await refresh();
    } catch (error) {
      console.error("[AssetsLibrary] Could not update favorite:", error);
      setLoadError("Could not update favorite.");
    }
  };

  const handleMove = async (event) => {
    if (!selectedAsset) return;
    try {
      await moveAsset(selectedAsset.id, event.target.value);
      await refresh();
    } catch (error) {
      console.error("[AssetsLibrary] Could not move asset:", error);
      setLoadError("Could not move asset.");
    }
  };

  const handleDeleteAsset = async () => {
    if (!selectedAsset || !window.confirm("Delete this asset? This cannot be undone.")) return;
    try {
      await deleteAsset(selectedAsset.id);
      setSelectedAsset(null);
      await refresh();
    } catch (error) {
      console.error("[AssetsLibrary] Could not delete asset:", error);
      setLoadError("Could not delete asset.");
    }
  };

  const handleCopyPrompt = async () => {
    if (!selectedAsset?.prompt) return;
    try {
      await navigator.clipboard.writeText(selectedAsset.prompt);
    } catch (error) {
      console.error("[AssetsLibrary] Could not copy prompt:", error);
      setLoadError("Could not copy prompt.");
    }
  };

  const beginAssetAction = (action) => {
    if (!selectedAsset) return;
    const asset = selectedAsset;
    setSelectedAsset(null);
    onAssetAction?.(asset, action);
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-app-bg p-4 text-white md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Assets library</h1>
          <p className="mt-1 text-sm text-white/45">Your generated images and videos</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setTab(item);
                setOpenedProjectId(null);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === item ? "bg-white/10 text-white" : "text-white/55 hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <p role="alert" className="mb-3 text-sm text-red-300">{loadError}</p>
      )}

      {tab === "Projects" && !openedProjectId ? (
        <div className="grid grid-cols-1 gap-3 overflow-y-auto pb-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const count = assets.filter((asset) => asset.projectId === project.id).length;
            return (
              <div key={project.id} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                <button
                  type="button"
                  onClick={() => setOpenedProjectId(project.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/65" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h5l2 2H19.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{project.name}</span>
                    <span className="mt-1 block text-xs text-white/40">{count} {count === 1 ? "asset" : "assets"}</span>
                  </span>
                </button>
                {project.id !== "default" && (
                  <button
                    type="button"
                    onClick={() => handleRenameProject(project)}
                    className="rounded px-2 py-1 text-xs text-white/45 hover:bg-white/10 hover:text-white"
                    aria-label={`Rename ${project.name}`}
                  >
                    Rename
                  </button>
                )}
                {project.id !== "default" && (
                  <button
                    type="button"
                    onClick={() => handleDeleteProject(project)}
                    className="rounded px-2 py-1 text-xs text-white/45 hover:bg-red-500/10 hover:text-red-300"
                    aria-label={`Delete ${project.name}`}
                  >
                    Delete
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {tab === "Projects" && (
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setOpenedProjectId(null)}
                className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/65 hover:bg-white/5 hover:text-white"
              >
                Back to projects
              </button>
              <h2 className="text-sm font-medium text-white/80">{selectedProject?.name || "Project"}</h2>
            </div>
          )}
          {visibleAssets.length ? (
            <div className="grid grid-cols-2 gap-3 overflow-y-auto pb-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visibleAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setSelectedAsset(asset)}
                  className="group overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] text-left transition-colors hover:border-white/20"
                >
                  {asset.kind === "video" ? (
                    <video src={asset.url} className="aspect-square w-full bg-black object-cover" muted preload="metadata" />
                  ) : (
                    <img src={asset.url} alt={asset.prompt || "Generated image"} className="aspect-square w-full bg-black object-cover" />
                  )}
                  <span className="block truncate px-3 py-2.5 text-xs text-white/65 group-hover:text-white">
                    {asset.prompt || asset.model || "Generated asset"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-white/40">
              No assets here yet.
            </div>
          )}
        </>
      )}

      {selectedAsset && (
        <div className="absolute inset-0 z-20 flex justify-end bg-black/70" onClick={() => setSelectedAsset(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Asset details"
            onClick={(event) => event.stopPropagation()}
            className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-white/10 bg-[#0b0b0b] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <h2 className="text-sm font-semibold">Asset details</h2>
              <button type="button" onClick={() => setSelectedAsset(null)} className="rounded px-2 py-1 text-white/55 hover:bg-white/10 hover:text-white" aria-label="Close asset details">×</button>
            </div>
            <div className="p-4">
              {selectedAsset.kind === "video" ? (
                <video src={selectedAsset.url} controls className="max-h-[42vh] w-full rounded-lg bg-black object-contain" />
              ) : (
                <img src={selectedAsset.url} alt={selectedAsset.prompt || "Generated image"} className="max-h-[42vh] w-full rounded-lg bg-black object-contain" />
              )}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-white/40">{selectedAsset.kind}</span>
                <button type="button" onClick={handleFavorite} className={`rounded-md border px-3 py-1.5 text-xs ${selectedAsset.favorite ? "border-pink-400/30 text-pink-300" : "border-white/10 text-white/65 hover:text-white"}`}>
                  {selectedAsset.favorite ? "♥ Favorited" : "♡ Favorite"}
                </button>
              </div>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-white/45">Prompt</h3>
                  <button type="button" onClick={handleCopyPrompt} className="text-xs text-white/60 hover:text-white">Copy</button>
                </div>
                <p className="whitespace-pre-wrap rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-sm leading-6 text-white/80">{selectedAsset.prompt || "—"}</p>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                {[
                  ["Model", selectedAsset.model],
                  ["Aspect", selectedAsset.aspectRatio],
                  ["Resolution", selectedAsset.resolution],
                  ["Format", selectedAsset.format],
                  ["Cost", selectedAsset.costCredits == null ? null : `${selectedAsset.costCredits} credits`],
                  ["Project", projectName(selectedAsset.projectId)],
                  ["Created", formatDate(selectedAsset.createdAt)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-white/40">{label}</dt>
                    <dd className="mt-1 break-words text-white/80">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => beginAssetAction("recreate")} className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-white/85">Recreate</button>
                <button type="button" onClick={() => beginAssetAction("reuse")} className="rounded-md border border-white/15 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/5">Reuse</button>
                <button type="button" onClick={() => beginAssetAction("reference")} className="col-span-2 rounded-md border border-white/15 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/5">Use as reference</button>
                <a href={selectedAsset.url} download className="rounded-md border border-white/15 px-3 py-2 text-center text-xs font-medium text-white/80 hover:bg-white/5">Download</a>
                <button type="button" onClick={handleDeleteAsset} className="rounded-md border border-red-400/20 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-400/10">Delete</button>
              </div>
              <label className="mt-4 block text-xs text-white/45">
                Move to project
                <select value={selectedAsset.projectId || "default"} onChange={handleMove} className="mt-1.5 w-full rounded-md border border-white/10 bg-[#111] px-3 py-2 text-sm text-white outline-none">
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
