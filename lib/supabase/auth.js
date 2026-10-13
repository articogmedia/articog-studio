export function createResponseCookieAdapter(requestCookies, responseCookies) {
  return {
    getAll: () => requestCookies.getAll(),
    setAll: (cookies) => {
      cookies.forEach(({ name, value, options }) => responseCookies.set(name, value, options));
    },
  };
}

export function signInWithPassword(supabase, email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export function requestPasswordReset(supabase, email, redirectTo) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export function createAuthCallbackUrl(origin, nextPath = '/studio') {
  const callbackUrl = new URL('/auth/callback', origin);
  if (nextPath !== '/studio') callbackUrl.searchParams.set('next', nextPath);
  return callbackUrl.toString();
}

export async function getAuthenticatedUser(supabase) {
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throw error;
  return data?.user ?? null;
}

export function createAuthCallbackHandler({
  createServerClient,
  createRedirect,
  getConfig = () => ({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }),
  onError = (error) => console.error('[auth] callback exchange failed', error?.name || 'unknown'),
}) {
  return async function handleAuthCallback(request) {
    const config = getConfig();
    const callbackUrl = new URL(request.url);
    const code = callbackUrl.searchParams.get('code');
    const nextPath = callbackUrl.searchParams.get('next') === '/login/reset-password'
      ? '/login/reset-password'
      : '/studio';

    const redirect = (errorCode) => {
      const target = new URL(nextPath, request.url);
      if (errorCode) target.searchParams.set('auth_error', errorCode);
      return createRedirect(target);
    };

    if (!code || !config.url || !config.key) return redirect('callback_unavailable');

    const response = redirect(null);
    try {
      const supabase = createServerClient(config.url, config.key, {
        cookies: createResponseCookieAdapter(request.cookies, response.cookies),
      });
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return response;
    } catch (error) {
      onError(error);
      return redirect('callback_failed');
    }
  };
}

export async function completeProfileFromDraft({ profileCheck, draft, fetchImpl = fetch }) {
  const verifiedEmail = profileCheck?.profile?.email?.trim().toLowerCase();
  const draftEmail = draft?.email?.trim().toLowerCase();
  const fullName = draft?.fullName?.trim();

  if (profileCheck?.complete) return profileCheck.profile;
  if (!profileCheck?.authenticated || !verifiedEmail || draftEmail !== verifiedEmail || !fullName) return null;

  const response = await fetchImpl('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ fullName, email: verifiedEmail }),
  });
  const result = await response.json();
  if (!response.ok || !result.complete || !result.profile) {
    throw new Error(result.detail || 'Could not save your account details.');
  }
  return result.profile;
}