export const INTERNAL_SESSION_KEY = 'articog-session';

export function getForwardableApiKey(value) {
  const apiKey = typeof value === 'string' ? value.trim() : '';
  return apiKey && apiKey !== INTERNAL_SESSION_KEY ? apiKey : null;
}

export function stripInternalSessionCredential(headers) {
  if (headers.get('x-api-key')?.trim() === INTERNAL_SESSION_KEY) {
    headers.delete('x-api-key');
  }

  const authorization = headers.get('authorization');
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearerToken === INTERNAL_SESSION_KEY) {
    headers.delete('authorization');
  }

  return headers;
}