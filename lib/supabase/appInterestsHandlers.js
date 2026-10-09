function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function storedInterests(user) {
  const interests = user.user_metadata?.articog_app_interests;
  return Array.isArray(interests)
    ? interests.filter((interest) => typeof interest === 'string')
    : [];
}

export function createAppInterestsHandlers({ getUser, saveInterests, proxyRequest }) {
  async function authenticate() {
    try {
      const user = await getUser();
      return user
        ? { user }
        : { response: json({ detail: 'Please sign in.' }, 401) };
    } catch (error) {
      const status = error?.code === 'SUPABASE_SERVER_CONFIG_MISSING' ? 503 : 502;
      return { response: json({ detail: 'Could not verify your account.' }, status) };
    }
  }

  async function GET(request) {
    const apiKey = request.headers.get('x-api-key');
    if (proxyRequest && apiKey) {
      const proxied = await proxyRequest(request, apiKey);
      if (proxied) return proxied;
    }

    const { user, response } = await authenticate();
    if (response) return response;
    return json(storedInterests(user));
  }

  async function POST(request) {
    const apiKey = request.headers.get('x-api-key');
    if (proxyRequest && apiKey) {
      const proxied = await proxyRequest(request, apiKey);
      if (proxied) return proxied;
    }

    const { user, response } = await authenticate();
    if (response) return response;

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ detail: 'Provide a valid app name.' }, 400);
    }

    const appName = typeof body?.app_name === 'string' ? body.app_name.trim() : '';
    if (!appName || appName.length > 160) {
      return json({ detail: 'App name must be between 1 and 160 characters.' }, 400);
    }

    const interests = storedInterests(user);
    if (!interests.includes(appName)) interests.push(appName);

    try {
      await saveInterests(user, interests);
    } catch {
      return json({ detail: 'Could not save app interest.' }, 503);
    }

    return json(interests);
  }

  return { GET, POST };
}