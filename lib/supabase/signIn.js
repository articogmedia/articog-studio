export async function requestEmailSignInLink(supabase, email, origin) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: new URL('/auth/callback', origin).toString(),
      shouldCreateUser: false,
    },
  });

  if (error) throw new Error(error.message || 'Could not send a sign-in link.');
  return 'Check your email for a sign-in link. Open it in this browser to continue.';
}