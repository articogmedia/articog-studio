import {
  createTeamDemoSessionToken,
  getTeamDemoUserId,
  isTeamDemoAccessConfigured,
  isTeamDemoAccessEnabled,
  TEAM_DEMO_COOKIE,
  TEAM_DEMO_SESSION_TTL_SECONDS,
  verifyTeamDemoAccessCode,
} from './teamDemoSession.js';

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
}

function setCookieHeader(request, value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' || new URL(request.url).protocol === 'https:';
  return `${TEAM_DEMO_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function createTeamDemoSessionHandlers({ getEnv = () => process.env, lookupUser }) {
  async function POST(request) {
    const env = getEnv();
    if (!isTeamDemoAccessEnabled(env) || env.NEXT_PUBLIC_USE_OWN_GATEWAY !== 'true') {
      return json({ detail: 'Not found.' }, 404);
    }

    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) {
      return json({ detail: 'Request origin is not allowed.' }, 403);
    }

    if (Number(request.headers.get('content-length') || 0) > 2048) {
      return json({ detail: 'Request is too large.' }, 413);
    }
    if (!isTeamDemoAccessConfigured(env)) {
      return json({ detail: 'Team demo access is not configured.' }, 503);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ detail: 'Provide a valid access request.' }, 400);
    }

    const accessCode = typeof body?.accessCode === 'string' ? body.accessCode : '';
    if (accessCode.length > 512 || !verifyTeamDemoAccessCode(accessCode, env)) {
      return json({ detail: 'The team access code is invalid.' }, 401);
    }

    const userId = getTeamDemoUserId(env);
    let user;
    try {
      user = await lookupUser(userId);
    } catch {
      return json({ detail: 'Team demo account could not be verified.' }, 503);
    }

    if (!user || user.id !== userId || (user.banned_until && Date.parse(user.banned_until) > Date.now())) {
      return json({ detail: 'Team demo account is unavailable.' }, 403);
    }

    const response = json({ ok: true, expiresIn: TEAM_DEMO_SESSION_TTL_SECONDS });
    response.headers.append(
      'Set-Cookie',
      setCookieHeader(request, createTeamDemoSessionToken(env), TEAM_DEMO_SESSION_TTL_SECONDS),
    );
    return response;
  }

  async function DELETE(request) {
    return json(
      { ok: true },
      200,
      { 'Set-Cookie': setCookieHeader(request, '', 0) },
    );
  }

  return { POST, DELETE };
}