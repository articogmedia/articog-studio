export const ACCESS_PROFILE_STORAGE_KEY = 'articog_access_profile_v1';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getStorage(storage) {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function normalizeProfile(profile) {
  const fullName = typeof profile?.fullName === 'string' ? profile.fullName.trim() : '';
  const email = typeof profile?.email === 'string' ? profile.email.trim().toLowerCase() : '';
  if (!fullName || fullName.length > 120 || email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return { fullName, email, company: '' };
}

export function readStoredAccessProfile(storage) {
  try {
    const store = getStorage(storage);
    if (!store) return null;
    return normalizeProfile(JSON.parse(store.getItem(ACCESS_PROFILE_STORAGE_KEY) || 'null'));
  } catch {
    return null;
  }
}

export function saveStoredAccessProfile(profile, storage) {
  const store = getStorage(storage);
  const normalizedProfile = normalizeProfile(profile);
  if (!store) throw new Error('Browser storage is unavailable.');
  if (!normalizedProfile) throw new Error('Enter a valid name and email address.');
  store.setItem(ACCESS_PROFILE_STORAGE_KEY, JSON.stringify(normalizedProfile));
  return normalizedProfile;
}

export function clearStoredAccessProfile(storage) {
  try {
    getStorage(storage)?.removeItem(ACCESS_PROFILE_STORAGE_KEY);
  } catch {
    // Clearing local access details is best-effort when storage is unavailable.
  }
}