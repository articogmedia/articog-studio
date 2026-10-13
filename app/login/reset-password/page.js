'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    async function verifyRecoverySession() {
      try {
        const user = await getAuthenticatedUser(supabaseBrowser());
        if (isCurrent && user) setCanReset(true);
        else if (isCurrent) setMessage('This recovery link is invalid or expired. Request a new one.');
      } catch {
        if (isCurrent) setMessage('Could not verify this recovery link. Request a new one.');
      } finally {
        if (isCurrent) setIsChecking(false);
      }
    }

    void verifyRecoverySession();
    return () => { isCurrent = false; };
  }, []);

  async function submitPassword(event) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage('Use a password with at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setMessage('The passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    try {
      const { error } = await supabaseBrowser().auth.updateUser({ password });
      if (error) throw error;
      router.replace('/studio');
      router.refresh();
    } catch {
      setMessage('Could not update your password. Request a new recovery link and try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4 text-white">
      <section className="w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.03] p-8">
        <h1 className="text-xl font-semibold mb-6">Reset your password</h1>
        {isChecking ? (
          <p className="text-sm text-white/60">Verifying recovery link...</p>
        ) : canReset ? (
          <form onSubmit={submitPassword} className="space-y-3">
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
            />
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-white text-black py-2 font-medium disabled:opacity-60"
            >
              {isSubmitting ? 'Updating...' : 'Update password'}
            </button>
          </form>
        ) : null}
        {message && <p role="status" className="mt-4 text-sm text-white/60">{message}</p>}
        {!canReset && !isChecking && (
          <a href="/studio" className="mt-4 inline-block text-sm text-white/60 underline underline-offset-4 hover:text-white">
            Return to Articog Studio
          </a>
        )}
      </section>
    </main>
  );
}