'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { createAuthCallbackUrl, requestPasswordReset, signInWithPassword } from '@/lib/supabase/auth';
import { useRouter } from 'next/navigation';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function sendLink(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    try {
      const supabase = supabaseBrowser();
      const { error } = await signInWithPassword(supabase, email.trim().toLowerCase(), password);
      if (error) {
        setMessage('Email or password did not match. Use password recovery if needed.');
        return;
      }
      router.replace('/studio');
    } catch {
      setMessage('Could not sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function google() {
    try {
      const supabase = supabaseBrowser();
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: createAuthCallbackUrl(window.location.origin) },
      });
    } catch {
      setMessage('Could not start Google sign-in. Please try again.');
    }
  }

  async function recoverPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setMessage('Enter a valid email address first.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    try {
      const supabase = supabaseBrowser();
      const { error } = await requestPasswordReset(
        supabase,
        normalizedEmail,
        createAuthCallbackUrl(window.location.origin, '/login/reset-password'),
      );
      if (error) throw error;
      setMessage('If this email belongs to an authorized account, a password reset link will be sent.');
    } catch {
      setMessage('Could not request password recovery. Check the address and try again later.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.03] p-8 text-white">
        <h1 className="text-xl font-semibold mb-6">Sign in to Articog Studio</h1>
        <button onClick={google} disabled={isSubmitting} className="w-full rounded-full bg-white text-black py-2 font-medium mb-4 disabled:opacity-60">Continue with Google</button>
        <form onSubmit={sendLink} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2" />
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2" />
          <button type="submit" disabled={isSubmitting} className="w-full rounded-full border border-white/20 py-2 disabled:opacity-60">{isSubmitting ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <button type="button" disabled={isSubmitting} onClick={recoverPassword} className="mt-3 text-sm text-white/60 underline underline-offset-4 hover:text-white disabled:opacity-50">Forgot password?</button>
        {message && <p className="mt-4 text-sm text-white/60">{message}</p>}
      </div>
    </main>
  );
}
