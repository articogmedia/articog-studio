async function readResponse(response, fallback) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.detail || fallback);
  return result;
}

export async function createTeamDemoSession(accessCode, request = fetch) {
  const response = await request('/api/team-demo/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode }),
  });
  return readResponse(response, 'Team demo access could not be verified.');
}

export async function clearTeamDemoSession(request = fetch) {
  const response = await request('/api/team-demo/session', {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  await readResponse(response, 'Could not clear the temporary team session.');
}