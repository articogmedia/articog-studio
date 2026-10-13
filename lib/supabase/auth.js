export function createResponseCookieAdapter(requestCookies, responseCookies) {
  return {
    getAll: () => requestCookies.getAll(),
    setAll: (cookies) => {
      cookies.forEach(({ name, value, options }) => responseCookies.set(name, value, options));
    },
  };
}

export function requestEmailSignIn(supabase, email, redirectTo) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false,
    },
  });
}

export async function getAuthenticatedUser(supabase) {
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throw error;
  return data?.user ?? null;
}