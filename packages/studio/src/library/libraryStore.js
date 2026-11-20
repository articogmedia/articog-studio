const DATABASE_NAME = "articog-assets-library";
const DATABASE_VERSION = 1;
const STORE_NAME = "library";
const STATE_KEY = "state";
const LOCAL_STORAGE_KEY = "articog-assets-library";
const DEFAULT_PROJECT_ID = "default";
let stateUpdateQueue = Promise.resolve();

// Phase 8 will replace this storage layer with Supabase calls using the same function names.
function createDefaultProject() {
  return {
    id: DEFAULT_PROJECT_ID,
    name: "Untitled",
    createdAt: new Date().toISOString(),
  };
}

function createInitialState() {
  return { projects: [createDefaultProject()], assets: [], inputs: [] };
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeState(state) {
  const projects = Array.isArray(state?.projects) ? state.projects : [];
  const assets = Array.isArray(state?.assets) ? state.assets : [];
  const inputs = Array.isArray(state?.inputs) ? state.inputs : [];
  const defaultProject = projects.find((project) => project.id === DEFAULT_PROJECT_ID);
  return {
    projects: defaultProject
      ? projects.map((project) =>
        project.id === DEFAULT_PROJECT_ID ? { ...project, name: "Untitled" } : project,
      )
      : [createDefaultProject(), ...projects],
    assets,
    inputs,
  };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open IndexedDB"));
  });
}

function readLocalState() {
  if (typeof localStorage === "undefined") return createInitialState();
  const storedState = localStorage.getItem(LOCAL_STORAGE_KEY);
  return storedState ? normalizeState(JSON.parse(storedState)) : createInitialState();
}

function writeLocalState(state) {
  if (typeof localStorage === "undefined") {
    throw new Error("Neither IndexedDB nor localStorage is available");
  }
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
}

async function readState() {
  try {
    const database = await openDatabase();
    const state = await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .get(STATE_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not read library state"));
    });
    database.close();
    const normalized = normalizeState(state || createInitialState());
    const storedDefaultProject = Array.isArray(state?.projects)
      ? state.projects.find((project) => project.id === DEFAULT_PROJECT_ID)
      : null;
    if (
      !state
      || normalized.projects.length !== state.projects?.length
      || storedDefaultProject?.name !== "Untitled"
    ) {
      await writeState(normalized);
    }
    return normalized;
  } catch (error) {
    return readLocalState();
  }
}

async function writeState(state) {
  const normalized = normalizeState(state);
  try {
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(normalized, STATE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Could not save library state"));
      transaction.onabort = () => reject(transaction.error || new Error("Could not save library state"));
    });
    database.close();
  } catch (error) {
    writeLocalState(normalized);
  }
}

function updateState(updater) {
  const operation = stateUpdateQueue.then(async () => {
    const state = await readState();
    const nextState = updater(state);
    await writeState(nextState);
    return nextState;
  });
  stateUpdateQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function listProjects() {
  const { projects } = await readState();
  return projects;
}

export async function createProject(name) {
  const project = {
    id: createId(),
    name: String(name || "").trim() || "Untitled",
    createdAt: new Date().toISOString(),
  };
  await updateState((state) => ({ ...state, projects: [...state.projects, project] }));
  return project;
}

export async function renameProject(id, name) {
  if (id === DEFAULT_PROJECT_ID) return (await listProjects()).find((project) => project.id === id);
  const normalizedName = String(name || "").trim();
  if (!normalizedName) throw new Error("Project name cannot be empty");
  let renamedProject;
  await updateState((state) => ({
    ...state,
    projects: state.projects.map((project) => {
      if (project.id !== id) return project;
      renamedProject = { ...project, name: normalizedName };
      return renamedProject;
    }),
  }));
  return renamedProject || null;
}

export async function deleteProject(id) {
  if (id === DEFAULT_PROJECT_ID) return false;
  await updateState((state) => ({
    projects: state.projects.filter((project) => project.id !== id),
    assets: state.assets.map((asset) =>
      asset.projectId === id ? { ...asset, projectId: DEFAULT_PROJECT_ID } : asset,
    ),
    inputs: state.inputs.map((input) =>
      input.projectId === id ? { ...input, projectId: DEFAULT_PROJECT_ID } : input,
    ),
  }));
  return true;
}

export async function addAsset(asset) {
  let newAsset;
  await updateState((state) => {
    newAsset = {
      ...asset,
      id: asset.id || createId(),
      projectId: state.projects.some((project) => project.id === asset.projectId)
        ? asset.projectId
        : DEFAULT_PROJECT_ID,
      favorite: Boolean(asset.favorite),
      creditsCharged: asset.creditsCharged ?? asset.costCredits ?? null,
      createdAt: asset.createdAt || new Date().toISOString(),
    };
    return { ...state, assets: [newAsset, ...state.assets] };
  });
  return newAsset;
}

export async function restoreAsset(asset) {
  if (!asset?.id) throw new Error("An asset ID is required");
  let restoredAsset;
  await updateState((state) => {
    const existingAsset = state.assets.find((current) => current.id === asset.id);
    if (existingAsset) {
      restoredAsset = existingAsset;
      return state;
    }
    restoredAsset = { ...asset };
    return { ...state, assets: [restoredAsset, ...state.assets] };
  });
  return restoredAsset;
}

export async function listAssets({ kind, projectId, favoritesOnly } = {}) {
  const { assets } = await readState();
  return assets.filter((asset) =>
    (!kind || asset.kind === kind)
    && (!projectId || asset.projectId === projectId)
    && (!favoritesOnly || asset.favorite),
  );
}

export async function addInput(input) {
  if (!input || !["image", "video"].includes(input.kind) || !input.url) {
    throw new Error("An input kind and URL are required");
  }
  let newInput;
  await updateState((state) => {
    newInput = {
      ...input,
      id: input.id || createId(),
      projectId: state.projects.some((project) => project.id === input.projectId)
        ? input.projectId
        : DEFAULT_PROJECT_ID,
      createdAt: input.createdAt || new Date().toISOString(),
    };
    return { ...state, inputs: [newInput, ...state.inputs] };
  });
  return newInput;
}

export async function listInputs({ projectId } = {}) {
  const { inputs } = await readState();
  return inputs.filter((input) => !projectId || input.projectId === projectId);
}

export async function removeInput(id) {
  let removedInput;
  await updateState((state) => ({
    ...state,
    inputs: state.inputs.filter((input) => {
      if (input.id !== id) return true;
      removedInput = input;
      return false;
    }),
  }));
  return removedInput || null;
}

export async function restoreInput(input) {
  if (!input?.id) throw new Error("An input ID is required");
  let restoredInput;
  await updateState((state) => {
    const existingInput = state.inputs.find((current) => current.id === input.id);
    if (existingInput) {
      restoredInput = existingInput;
      return state;
    }
    restoredInput = { ...input };
    return { ...state, inputs: [restoredInput, ...state.inputs] };
  });
  return restoredInput;
}

export async function moveInput(id, projectId) {
  let movedInput;
  await updateState((state) => {
    if (!state.projects.some((project) => project.id === projectId)) {
      throw new Error("Project does not exist");
    }
    return {
      ...state,
      inputs: state.inputs.map((input) => {
        if (input.id !== id) return input;
        movedInput = { ...input, projectId };
        return movedInput;
      }),
    };
  });
  return movedInput || null;
}

export async function getAsset(id) {
  const { assets } = await readState();
  return assets.find((asset) => asset.id === id) || null;
}

export async function moveAsset(id, projectId) {
  let movedAsset;
  await updateState((state) => {
    if (!state.projects.some((project) => project.id === projectId)) {
      throw new Error("Project does not exist");
    }
    return {
      ...state,
      assets: state.assets.map((asset) => {
        if (asset.id !== id) return asset;
        movedAsset = { ...asset, projectId };
        return movedAsset;
      }),
    };
  });
  return movedAsset || null;
}

export async function toggleFavorite(id) {
  let updatedAsset;
  await updateState((state) => ({
    ...state,
    assets: state.assets.map((asset) => {
      if (asset.id !== id) return asset;
      updatedAsset = { ...asset, favorite: !asset.favorite };
      return updatedAsset;
    }),
  }));
  return updatedAsset || null;
}

export async function deleteAsset(id) {
  let deletedAsset;
  await updateState((state) => ({
    ...state,
    assets: state.assets.filter((asset) => {
      if (asset.id !== id) return true;
      deletedAsset = asset;
      return false;
    }),
  }));
  return deletedAsset || null;
}
