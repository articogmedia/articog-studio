'use client';

import { useState } from 'react';
import ArticogLogo from './ArticogLogo';
import { saveStoredAccessProfile } from '@/lib/accessProfileStorage';
import {
  createAuthCallbackUrl,
  getAuthenticatedUser,
  requestPasswordReset,
  signInWithPassword,
} from '@/lib/supabase/auth';
import { supabaseBrowser } from '@/lib/supabase/client';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ArticogAccessScreen({ initialProfile, authError, onComplete }) {
  const [fullName, setFullName] = useState(initialProfile?.fullName || '');
  const [email, setEmail] = useState(initialProfile?.email || '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    const nextErrors = {};
    const trimmedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName) nextErrors.fullName = 'Enter your full name.';
    else if (trimmedName.length > 120) nextErrors.fullName = 'Use 120 characters or fewer.';
    if (!normalizedEmail) nextErrors.email = 'Enter your email address.';
    else if (normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) nextErrors.email = 'Enter a valid email address.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const supabase = supabaseBrowser();
      let user = await getAuthenticatedUser(supabase);

      if (user?.email?.toLowerCase() !== normalizedEmail) {
        if (!password) {
          setErrors({ password: 'Enter your password or use password recovery.' });
          return;
        }
        const { data, error } = await signInWithPassword(supabase, normalizedEmail, password);
        if (error) throw new Error('Email or password did not match. Use password recovery if needed.');
        user = data?.user;
      }

      if (!user?.email || user.email.toLowerCase() !== normalizedEmail) {
        throw new Error('Could not verify that account. Please sign in again.');
      }

      try {
        saveStoredAccessProfile({ fullName: trimmedName, email: normalizedEmail });
      } catch {
        // The server profile is authoritative; browser storage is optional.
      }

      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ fullName: trimmedName, email: normalizedEmail }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Could not save your account details.');
      await onComplete(result.profile);
    } catch (error) {
      setErrors({ form: error?.message || 'Could not start sign-in. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordRecovery() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
      setErrors({ email: 'Enter a valid email address first.' });
      return;
    }

    try {
      if (fullName.trim()) saveStoredAccessProfile({ fullName: fullName.trim(), email: normalizedEmail });
    } catch {
      // Recovery must still work when browser storage is unavailable.
    }

    setIsSubmitting(true);
    setErrors({});
    try {
      const { error } = await requestPasswordReset(
        supabaseBrowser(),
        normalizedEmail,
        createAuthCallbackUrl(window.location.origin, '/login/reset-password'),
      );
      if (error) throw error;
      setMessage('If this email belongs to an authorized account, a password reset link will be sent.');
    } catch {
      setErrors({ form: 'Could not request password recovery. Please wait before trying again.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldClass = (field) => `mt-2 w-full rounded-lg border bg-white/[0.035] px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-white/45 ${errors[field] ? 'border-rose-400/70' : 'border-white/10'}`;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070808] px-4 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.07),transparent_58%)]" />
      <section className="relative w-full max-w-[480px] rounded-xl border border-white/10 bg-[#0b0c0c]/95 px-6 py-9 shadow-2xl shadow-black/50 sm:px-10 sm:py-11">
        <div className="mb-9 text-center">
          <ArticogLogo className="mx-auto mb-6" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">ARTICOG STUDIO</p>
          <h1 className="mt-3 text-[25px] font-semibold leading-tight">Your creative studio, ready.</h1>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {authError && <p role="alert" className="rounded-lg border border-rose-400/25 bg-rose-400/5 px-3 py-2.5 text-sm text-rose-200">{authError}</p>}
          {errors.form && <p role="alert" className="rounded-lg border border-rose-400/25 bg-rose-400/5 px-3 py-2.5 text-sm text-rose-200">{errors.form}</p>}
          <div>
            <label htmlFor="access-full-name" className="text-[13px] font-medium text-white/85">Full Name <span className="text-rose-300">*</span></label>
            <input
              id="access-full-name"
              name="name"
              autoComplete="name"
              type="text"
              required
              maxLength={120}
              value={fullName}
              onChange={(event) => { setFullName(event.target.value); setErrors((current) => ({ ...current, fullName: '' })); }}
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? 'access-full-name-error' : undefined}
              placeholder="Your full name"
              className={fieldClass('fullName')}
            />
            {errors.fullName && <p id="access-full-name-error" className="mt-1.5 text-xs text-rose-300">{errors.fullName}</p>}
          </div>

          <div>
            <label htmlFor="access-email" className="text-[13px] font-medium text-white/85">Email Address <span className="text-rose-300">*</span></label>
            <input
              id="access-email"
              name="email"
              autoComplete="email"
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: '' })); }}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'access-email-error' : undefined}
              placeholder="name@example.com"
              className={fieldClass('email')}
            />
            {errors.email && <p id="access-email-error" className="mt-1.5 text-xs text-rose-300">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="access-password" className="text-[13px] font-medium text-white/85">Password</label>
            <input
              id="access-password"
              name="password"
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: '' })); }}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'access-password-error' : undefined}
              placeholder="Your account password"
              className={fieldClass('password')}
            />
            {errors.password && <p id="access-password-error" className="mt-1.5 text-xs text-rose-300">{errors.password}</p>}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handlePasswordRecovery}
              className="mt-2 text-xs text-white/60 underline decoration-white/30 underline-offset-4 hover:text-white disabled:opacity-50"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-[#101111] transition-colors hover:bg-white/90 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" aria-hidden="true" />}
            {isSubmitting ? 'Signing in...' : 'Continue to Studio'}
          </button>
          {message && <p role="status" className="text-center text-sm text-white/60">{message}</p>}
        </form>
      </section>
    </main>
  );
}
