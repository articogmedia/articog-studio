export async function saveArticogProfile(profile, request = fetch) {
  const response = await request('/api/profile', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.detail || 'Could not save your profile. Please try again.');
  }

  return result.profile;
}