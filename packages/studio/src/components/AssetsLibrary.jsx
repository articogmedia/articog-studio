"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addInput,
  deleteAsset,
  deleteProject,
  listAssets,
  listInputs,
  listProjects,
  moveAsset,
  removeInput,
  renameProject,
  restoreAsset,
  restoreInput,
  toggleFavorite,
} from "../library/libraryStore";
import { uploadFile } from "../muapi.js";
import UndoBar from "./UndoBar.jsx";
import commonEn from "../../../../messages/en/common.json";

function formatDate(value, locale) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(locale === "zh" ? "zh-CN" : "en");
}

function getAssetFormat(asset) {
  const urlPath = String(asset.url || "").split(/[?#]/, 1)[0];
  return urlPath.match(/\.([^.\/]+)$/)?.[1]?.toUpperCase() || asset.format || "—";
}

export default function AssetsLibrary({
  apiKey,
  locale = "en",
  copy = commonEn.assetsLibrary,
  referenceAvailability = {},
  onAssetAction,
  onProjectsChange,
}) {
  const TABS = [
    ["Projects", copy.projectsTab],
    ["Image", copy.imageTab],
    ["Video", copy.videoTab],
    ["Favorites", copy.favoritesTab],
  ];
  const [tab, setTab] = useState("Projects");
  const [projects, setProjects] = useState([]);
  const [assets, setAssets] = useState([]);
  const [imageAssets, setImageAssets] = useState([]);
  const [videoAssets, setVideoAssets] = useState([]);
  const [favoriteAssets, setFavoriteAssets] = useState([]);
  const [tabCounts, setTabCounts] = useState({ Projects: 0, Image: 0, Video: 0, Favorites: 0 });
  const [inputs, setInputs] = useState([]);
  const [openedProjectId, setOpenedProjectId] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [pixelSize, setPixelSize] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [uploadingInputs, setUploadingInputs] = useState(false);
  const [openUseAsId, setOpenUseAsId] = useState(null);
  const [undoEntry, setUndoEntry] = useState(null);
  const undoIdRef = useRef(0);
  const inputFileRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [
        nextProjects,
        nextAssets,
        nextInputs,
        nextImageAssets,
        nextVideoAssets,
        nextFavoriteAssets,
      ] = await Promise.all([
        listProjects(),
        listAssets(),
        listInputs(),
        listAssets({ kind: "image" }),
        listAssets({ kind: "video" }),
        listAssets({ favoritesOnly: true }),
      ]);
      setProjects(nextProjects);
      onProjectsChange?.(nextProjects);
      setAssets(nextAssets);
      setInputs(nextInputs);
      setImageAssets(nextImageAssets);
      setVideoAssets(nextVideoAssets);
      setFavoriteAssets(nextFavoriteAssets);
      setTabCounts({
        Projects: nextProjects.length,
        Image: nextImageAssets.length,
        Video: nextVideoAssets.length,
        Favorites: nextFavoriteAssets.length,
      });
      setLoadError("");
      setSelectedAsset((current) =>
        current ? nextAssets.find((asset) => asset.id === current.id) || null : null,
      );
    } catch (error) {
      console.error("[AssetsLibrary] Could not load library:", error);
      setLoadError(copy.loadError);
    }
  }, [copy.loadError, onProjectsChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setPixelSize(null);
  }, [selectedAsset?.id, selectedAsset?.url]);

  const visibleAssets = useMemo(() => {
    if (tab === "Image") return imageAssets;
    if (tab === "Video") return videoAssets;
    if (tab === "Favorites") return favoriteAssets;
    if (openedProjectId) {
      return assets.filter((asset) => asset.projectId === openedProjectId);
    }
    return [];
  }, [assets, favoriteAssets, imageAssets, openedProjectId, tab, videoAssets]);

  const selectedProject = projects.find((project) => project.id === openedProjectId);
  const projectName = (projectId) =>
    projects.find((project) => project.id === projectId)?.name || copy.defaultProjectName;
  const projectInputs = inputs.filter((input) => input.projectId === openedProjectId);

  const handleRenameProject = async (project) => {
    const name = window.prompt(copy.renameProjectPrompt, project.name);
    if (!name?.trim()) return;
    try {
      await renameProject(project.id, name);
      await refresh();
    } catch (error) {
      console.error("[AssetsLibrary] Could not rename project:", error);
      setLoadError(copy.renameError);
    }
  };

  const handleDeleteProject = async (project) => {
    if (
      project.id === "default"
      || !window.confirm(copy.deleteProjectConfirm.replace("{name}", project.name))
    ) return;
    try {
      await deleteProject(project.id);
      setOpenedProjectId(null);
      await refresh();
    } catch (error) {
      console.error("[AssetsLibrary] Could not delete project:", error);
      setLoadError(copy.deleteProjectError);
    }
  };

  const handleAddInputs = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (!apiKey) {
      setLoadError(copy.apiKeyRequired);
      return;
    }

    const mediaFiles = files.filter((file) =>
      file.type.startsWith("image/") || file.type.startsWith("video/"),
    );
    if (!mediaFiles.length) {
      setLoadError(copy.uploadError);
      return;
    }

    setUploadingInputs(true);
    setLoadError("");
    try {
      for (const file of mediaFiles) {
        const url = await uploadFile(apiKey, file);
        await addInput({
          projectId: openedProjectId,
          kind: file.type.startsWith("video/") ? "video" : "image",
          url,
          name: file.name,
        });
      }
      await refresh();
    } catch (error) {
      console.error("[AssetsLibrary] Could not upload project input:", error);
      await refresh();
      setLoadError(copy.uploadError);
    } finally {
      setUploadingInputs(false);
    }
  };

  const handleRemoveInput = async (input) => {
    try {
      await removeInput(input.id);
      await refresh();
    } catch (error) {
      console.error("[AssetsLibrary] Could not remove project input:", error);
      setLoadError(copy.removeInputError);
    }
  };

  const handleRemoveInputWithUndo = async (input) => {
    try {
      const inputToRestore = { ...input };
      const removedInput = await removeInput(input.id);
      if (!removedInput) return;
      setUndoEntry({
        id: ++undoIdRef.current,
        kind: "input",
        item: inputToRestore,
      });
      await refresh();
    } catch (error) {
      console.error("[AssetsLibrary] Could not remove project input:", error);
      setLoadError(copy.removeInputError);
    }
  };

  const handleFavorite = async () => {
    if (!selectedAsset) return;
    try {
      await toggleFavorite(selectedAsset.id);
      await refresh();
    } catch (error) {
      console.error("[AssetsLibrary] Could not update favorite:", error);
      setLoadError(copy.favoriteError);
    }
  };

  const handleMove = async (event) => {
    if (!selectedAsset) return;
    try {
      await moveAsset(selectedAsset.id, event.target.value);
      await refresh();
    } catch (error) {
      console.error("[AssetsLibrary] Could not move asset:", error);
      setLoadError(copy.moveAssetError);
    }
  };

  const handleDeleteAsset = async () => {
    if (!selectedAsset || !window.confirm(copy.deleteAssetConfirm)) return;
    try {
      await deleteAsset(selectedAsset.id);
      setSelectedAsset(null);
      await refresh();
    } catch (error) {
      console.error("[AssetsLibrary] Could not delete asset:", error);
      setLoadError(copy.deleteAssetError);
    }
  };

  const handleDeleteAssetWithUndo = async () => {
    if (!selectedAsset || !window.confirm(copy.deleteAssetConfirm)) return;
    try {
      const assetToRestore = { ...selectedAsset };
      const deletedAsset = await deleteAsset(selectedAsset.id);
      if (!deletedAsset) return;
      setUndoEntry({
        id: ++undoIdRef.current,
        kind: "asset",
        item: assetToRestore,
      });
      setSelectedAsset(null);
      await refresh();
    } catch (error) {
      console.error("[AssetsLibrary] Could not delete asset:", error);
      setLoadError(copy.deleteAssetError);
    }
  };

  const handleUndoDelete = async () => {
    const entry = undoEntry;
    setUndoEntry(null);
    if (!entry) return;
    try {
      if (entry.kind === "asset") await restoreAsset(entry.item);
      else await restoreInput(entry.item);
      await refresh();
    } catch (error) {
      console.error("[AssetsLibrary] Could not restore deleted item:", error);
      setLoadError(copy.undoRestoreError);
    }
  };

  const handleUndoDeleteCapture = (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const button = target?.closest("button");
    if (!button) return;

    const isInputDelete = button.hasAttribute("data-library-remove-input");
    const detailsPanel = button.closest('[role="dialog"]');
    const isAssetDelete = detailsPanel?.getAttribute("aria-label") === copy.assetDetails
      && button.textContent.trim() === copy.delete;
    if (!isInputDelete && !isAssetDelete) return;

    event.preventDefault();
    event.stopPropagation();
    if (isAssetDelete) {
      void handleDeleteAssetWithUndo();
      return;
    }
    const input = inputs.find((item) => item.id === button.getAttribute("data-library-remove-input"));
    if (input) void handleRemoveInputWithUndo(input);
  };

  useEffect(() => {
    document.addEventListener("click", handleUndoDeleteCapture, true);
    return () => document.removeEventListener("click", handleUndoDeleteCapture, true);
  }, [handleUndoDeleteCapture]);

  const handleCopyPrompt = async () => {
    if (!selectedAsset?.prompt) return;
    try {
      await navigator.clipboard.writeText(selectedAsset.prompt);
    } catch (error) {
      console.error("[AssetsLibrary] Could not copy prompt:", error);
      setLoadError(copy.copyPromptError);
    }
  };

  const beginAssetAction = (action) => {
    if (!selectedAsset) return;
    const asset = selectedAsset;
    setSelectedAsset(null);
    onAssetAction?.(asset, action);
  };

  const renderUseAsMenu = (item, menuId) => {
    const videoTarget = referenceAvailability.video;
    const target = item.kind === "video"
      ? {
          supportsReferences: videoTarget?.supportsVideoReferences,
          referenceCount: videoTarget?.videoReferenceCount,
          maxReferences: videoTarget?.maxVideoReferences,
        }
      : referenceAvailability.image;
    const options = [];
    if (target?.supportsReferences) {
      options.push({
        action: "reference",
        label: copy.reference
          .replace("{count}", String(target.referenceCount))
          .replace("{max}", String(target.maxReferences)),
        disabled: target.referenceCount >= target.maxReferences,
      });
    }
    if (item.kind === "image" && referenceAvailability.video?.supportsStartFrame) {
      const video = referenceAvailability.video;
      options.push({
        action: "start_frame",
        label: copy.startFrame
          .replace("{count}", String(video.startFrameCount))
          .replace("{max}", String(video.startFrameLimit)),
        disabled: video.startFrameCount >= video.startFrameLimit,
      });
      if (video.supportsEndFrame) {
        options.push({
          action: "end_frame",
          label: copy.endFrame
            .replace("{count}", String(video.endFrameCount))
            .replace("{max}", String(video.endFrameLimit)),
          disabled: video.endFrameCount >= video.endFrameLimit,
        });
      }
    }
    if (!options.length) return null;

    return (
      <div className="relative">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setOpenUseAsId((current) => current === menuId ? null : menuId);
          }}
          className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/65 hover:bg-white/5 hover:text-white"
        >
          {copy.useAs}
        </button>
        {openUseAsId === menuId && (
          <div className="absolute bottom-full left-0 z-30 mb-1 min-w-max rounded-lg border border-white/10 bg-[#111] p-1 shadow-xl">
            {options.map((option) => (
              <button
                key={option.action}
                type="button"
                disabled={option.disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenUseAsId(null);
                  if (menuId.startsWith("asset-")) setSelectedAsset(null);
                  onAssetAction?.(item, option.action);
                }}
                className="block w-full rounded px-2.5 py-1.5 text-left text-xs text-white/75 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-app-bg p-4 text-white md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{copy.title}</h1>
          <p className="mt-1 text-sm text-white/45">{copy.subtitle}</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {TABS.map(([item, label]) => (
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
              {copy.tabCount
                .replace("{label}", label)
                .replace("{count}", String(tabCounts[item]))}
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
                    <span className="mt-1 block text-xs text-white/40">
                      {copy.assetCount
                        .replace("{count}", String(count))
                        .replace("{label}", count === 1 ? copy.assetSingular : copy.assetPlural)}
                    </span>
                  </span>
                </button>
                {project.id !== "default" && (
                  <button
                    type="button"
                    onClick={() => handleRenameProject(project)}
                    className="rounded px-2 py-1 text-xs text-white/45 hover:bg-white/10 hover:text-white"
                    aria-label={copy.renameProjectAria.replace("{name}", project.name)}
                  >
                    {copy.rename}
                  </button>
                )}
                {project.id !== "default" && (
                  <button
                    type="button"
                    onClick={() => handleDeleteProject(project)}
                    className="rounded px-2 py-1 text-xs text-white/45 hover:bg-red-500/10 hover:text-red-300"
                    aria-label={copy.deleteProjectAria.replace("{name}", project.name)}
                  >
                    {copy.delete}
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
                {copy.backToProjects}
              </button>
              <h2 className="text-sm font-medium text-white/80">{selectedProject?.name || copy.projectFallback}</h2>
            </div>
          )}
          {tab === "Projects" && openedProjectId && (
            <section className="mb-5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-white/80">
                  {copy.inputCount.replace("{count}", String(projectInputs.length))}
                </h3>
                <input
                  ref={inputFileRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handleAddInputs}
                />
                <button
                  type="button"
                  disabled={uploadingInputs}
                  onClick={() => inputFileRef.current?.click()}
                  className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 hover:text-white disabled:cursor-wait disabled:opacity-50"
                >
                  {uploadingInputs ? copy.uploading : copy.addFiles}
                </button>
              </div>
              {projectInputs.length ? (
                <div className="flex flex-wrap gap-3 pb-1">
                  {projectInputs.map((input) => (
                    <div key={input.id} className="group relative w-24 flex-shrink-0">
                      <div className="relative h-20 overflow-hidden rounded-lg border border-white/10 bg-black">
                        {input.kind === "video" ? (
                          <video src={input.url} aria-label={copy.inputVideoAlt} className="h-full w-full object-cover" muted preload="metadata" />
                        ) : (
                          <img src={input.url} alt={input.name || copy.inputImageAlt} className="h-full w-full object-cover" />
                        )}
                        <button
                          type="button"
                          data-library-remove-input={input.id}
                          onClick={() => handleRemoveInput(input)}
                          aria-label={copy.removeInput}
                          title={input.name || copy.removeInput}
                          className="absolute right-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-xs text-white/80 opacity-0 transition-opacity hover:text-white group-hover:opacity-100 focus:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                      <div className="mt-1">{renderUseAsMenu(input, `input-${input.id}`)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-2 text-xs text-white/40">{copy.noInputs}</p>
              )}
            </section>
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
                    <video src={asset.url} aria-label={copy.videoTab} className="aspect-square w-full bg-black object-cover" muted preload="metadata" />
                  ) : (
                    <img src={asset.url} alt={asset.prompt || copy.generatedImageAlt} className="aspect-square w-full bg-black object-cover" />
                  )}
                  <span className="block truncate px-3 py-2.5 text-xs text-white/65 group-hover:text-white">
                    {asset.prompt || asset.model || copy.generatedAsset}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-white/40">
              {copy.noAssets}
            </div>
          )}
        </>
      )}

      {selectedAsset && (
        <div className="absolute inset-0 z-20 flex justify-end bg-black/70" onClick={() => setSelectedAsset(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={copy.assetDetails}
            onClick={(event) => event.stopPropagation()}
            className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-white/10 bg-[#0b0b0b] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <h2 className="text-sm font-semibold">{copy.assetDetails}</h2>
              <button type="button" onClick={() => setSelectedAsset(null)} className="rounded px-2 py-1 text-white/55 hover:bg-white/10 hover:text-white" aria-label={copy.closeAssetDetails}>×</button>
            </div>
            <div className="p-4">
              {selectedAsset.kind === "video" ? (
                <video
                  src={selectedAsset.url}
                  controls
                  onLoadedMetadata={(event) => {
                    const { videoWidth, videoHeight } = event.currentTarget;
                    if (videoWidth && videoHeight) {
                      setPixelSize(copy.pixelSizeValue
                        .replace("{width}", String(videoWidth))
                        .replace("{height}", String(videoHeight)));
                    }
                  }}
                  className="max-h-[42vh] w-full rounded-lg bg-black object-contain"
                />
              ) : (
                <img
                  src={selectedAsset.url}
                  alt={selectedAsset.prompt || copy.generatedImageAlt}
                  onLoad={(event) => {
                    const { naturalWidth, naturalHeight } = event.currentTarget;
                    if (naturalWidth && naturalHeight) {
                      setPixelSize(copy.pixelSizeValue
                        .replace("{width}", String(naturalWidth))
                        .replace("{height}", String(naturalHeight)));
                    }
                  }}
                  className="max-h-[42vh] w-full rounded-lg bg-black object-contain"
                />
              )}
              <div className="mt-3">{renderUseAsMenu(selectedAsset, `asset-${selectedAsset.id}`)}</div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-white/40">
                  {selectedAsset.kind === "video" ? copy.videoTab : copy.imageTab}
                </span>
                <button type="button" onClick={handleFavorite} className={`rounded-md border px-3 py-1.5 text-xs ${selectedAsset.favorite ? "border-pink-400/30 text-pink-300" : "border-white/10 text-white/65 hover:text-white"}`}>
                  {selectedAsset.favorite ? copy.favorited : copy.favorite}
                </button>
              </div>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-white/45">{copy.prompt}</h3>
                  <button type="button" onClick={handleCopyPrompt} className="text-xs text-white/60 hover:text-white">{copy.copy}</button>
                </div>
                <p className="whitespace-pre-wrap rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-sm leading-6 text-white/80">{selectedAsset.prompt || "—"}</p>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                {[
                  [copy.model, selectedAsset.model],
                  [copy.aspect, selectedAsset.aspectRatio],
                  [copy.resolution, selectedAsset.resolution],
                  [copy.format, getAssetFormat(selectedAsset)],
                  [copy.pixelSize, pixelSize],
                  [
                    copy.cost,
                    (selectedAsset.creditsCharged ?? selectedAsset.costCredits) == null
                      ? null
                      : copy.credits.replace(
                          "{count}",
                          String(selectedAsset.creditsCharged ?? selectedAsset.costCredits),
                        ),
                  ],
                  [copy.project, projectName(selectedAsset.projectId)],
                  [copy.created, formatDate(selectedAsset.createdAt, locale)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-white/40">{label}</dt>
                    <dd className="mt-1 break-words text-white/80">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => beginAssetAction("recreate")} className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-white/85">{copy.recreate}</button>
                <button type="button" onClick={() => beginAssetAction("reuse")} className="rounded-md border border-white/15 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/5">{copy.reuse}</button>
                <button type="button" onClick={() => beginAssetAction("reference")} className="col-span-2 rounded-md border border-white/15 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/5">{copy.useAsReference}</button>
                <a href={selectedAsset.url} download className="rounded-md border border-white/15 px-3 py-2 text-center text-xs font-medium text-white/80 hover:bg-white/5">{copy.download}</a>
                <button type="button" onClick={handleDeleteAsset} className="rounded-md border border-red-400/20 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-400/10">{copy.delete}</button>
              </div>
              <label className="mt-4 block text-xs text-white/45">
                {copy.moveToProject}
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
      {undoEntry && (
        <UndoBar
          key={undoEntry.id}
          message={copy.undoDeletedMessage}
          undoLabel={copy.undo}
          onUndo={handleUndoDelete}
          onDismiss={() => setUndoEntry(null)}
        />
      )}
    </div>
  );
}
