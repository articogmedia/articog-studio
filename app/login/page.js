'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const redirectTo = () => `${window.location.origin}/auth/callback`;

  async function sendLink(e) {
    e.preventDefault();
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo(), shouldCreateUser: false } });
    setMessage(error ? error.message : 'Check your email for a sign-in link.');
  }

  async function google() {
    const supabase = supabaseBrowser();
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
  }

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.03] p-8 text-white">
        <h1 className="text-xl font-semibold mb-6">Sign in to Articog Studio</h1>
        <button onClick={google} className="w-full rounded-full bg-white text-black py-2 font-medium mb-4">Continue with Google</button>
        <form onSubmit={sendLink} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2" />
          <button type="submit" className="w-full rounded-full border border-white/20 py-2">Email me a sign-in link</button>
        </form>
        {message && <p className="mt-4 text-sm text-white/60">{message}</p>}
      </div>
    </main>
  );
}
