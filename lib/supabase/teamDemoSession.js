import { createHash, createHmac, timingSafeEqual } from 'crypto';

export const TEAM_DEMO_COOKIE = 'articog_team_demo';
export const TEAM_DEMO_SESSION_TTL_SECONDS = 30 * 60;

const SESSION_AUDIENCE = 'articog-team-demo-v1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readConfig(env) {
  if (env.ARTICOG_ENABLE_TEAM_DEMO_ACCESS !== 'true') return null;

  const accessCode = env.ARTICOG_TEAM_DEMO_ACCESS_CODE;
  const sessionSecret = env.ARTICOG_TEAM_DEMO_SESSION_SECRET;
  const userId = env.ARTICOG_TEAM_DEMO_USER_ID;
  if (
    typeof accessCode !== 'string' || Buffer.byteLength(accessCode) < 32 ||
    typeof sessionSecret !== 'string' || Buffer.byteLength(sessionSecret) < 32 ||
    typeof userId !== 'string' || !UUID_PATTERN.test(userId)
  ) return null;

  return { accessCode, sessionSecret, userId };
}

export function isTeamDemoAccessEnabled(env = process.env) {
  return env.ARTICOG_ENABLE_TEAM_DEMO_ACCESS === 'true';
}

export function isTeamDemoAccessConfigured(env = process.env) {
  return Boolean(readConfig(env));
}

export function getTeamDemoUserId(env = process.env) {
  return readConfig(env)?.userId || null;
}

function digest(value) {
  return createHash('sha256').update(value).digest();
}

export function verifyTeamDemoAccessCode(accessCode, env = process.env) {
  const config = readConfig(env);
  if (!config || typeof accessCode !== 'string') return false;
  return timingSafeEqual(digest(accessCode), digest(config.accessCode));
}

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createTeamDemoSessionToken(env = process.env, now = Date.now()) {
  const config = readConfig(env);
  if (!config) throw new Error('Team demo access is not configured.');

  const issuedAt = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: config.userId,
    aud: SESSION_AUDIENCE,
    iat: issuedAt,
    exp: issuedAt + TEAM_DEMO_SESSION_TTL_SECONDS,
  })).toString('base64url');

  return `${payload}.${signature(payload, config.sessionSecret)}`;
}

export function verifyTeamDemoSessionToken(token, env = process.env, now = Date.now()) {
  const config = readConfig(env);
  if (!config || typeof token !== 'string') return null;

  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra !== undefined) return null;

  const expected = Buffer.from(signature(payload, config.sessionSecret));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const nowSeconds = Math.floor(now / 1000);
    if (
      claims.aud !== SESSION_AUDIENCE ||
      claims.sub !== config.userId ||
      !Number.isInteger(claims.iat) ||
      !Number.isInteger(claims.exp) ||
      claims.iat > nowSeconds + 60 ||
      claims.exp <= nowSeconds ||
      claims.exp - claims.iat > TEAM_DEMO_SESSION_TTL_SECONDS
    ) return null;

    return { userId: claims.sub, expiresAt: claims.exp };
  } catch {
    return null;
  }
}

export async function resolveTeamDemoUser(token, lookupUser, env = process.env, now = Date.now()) {
  const session = verifyTeamDemoSessionToken(token, env, now);
  if (!session) return null;

  const user = await lookupUser(session.userId);
  if (!user || user.id !== session.userId) return null;
  if (user.banned_until && Date.parse(user.banned_until) > now) return null;
  return user;
}