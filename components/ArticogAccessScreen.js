'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ArticogAccessScreen({ authenticated, initialProfile, accessError, onComplete }) {
  const [fullName, setFullName] = useState(initialProfile?.fullName || '');
  const [email, setEmail] = useState(initialProfile?.email || '');
  const [company, setCompany] = useState(initialProfile?.company || '');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    const nextErrors = {};
    const trimmedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedCompany = company.trim();

    if (!trimmedName) nextErrors.fullName = 'Enter your full name.';
    else if (trimmedName.length > 120) nextErrors.fullName = 'Use 120 characters or fewer.';
    if (!normalizedEmail) nextErrors.email = 'Enter your email address.';
    else if (normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) nextErrors.email = 'Enter a valid email address.';
    if (trimmedCompany.length > 160) nextErrors.company = 'Use 160 characters or fewer.';

    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0) return;

    const profile = { fullName: trimmedName, email: normalizedEmail, company: trimmedCompany };
    setIsSubmitting(true);

    try {
      if (!authenticated) {
        const supabase = supabaseBrowser();
        const { error } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            shouldCreateUser: true,
            data: {
              articog_profile: { ...profile, completedAt: new Date().toISOString() },
            },
          },
        });
        if (error) throw new Error(error.message);
        setEmailSent(true);
        return;
      }

      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'We could not save your details. Please try again.');
      onComplete(result.profile);
    } catch (error) {
      setFormError(error.message || 'Something went wrong. Please try again.');
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
          <div className="mx-auto mb-6 flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-white text-[#101111]">
            <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2 2 7l10 5 10-5-10-5Z" />
              <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">Articog Studio</p>
          <h1 className="mt-3 text-[25px] font-semibold leading-tight">Your creative studio, ready.</h1>
          <p className="mx-auto mt-3 max-w-[340px] text-sm leading-6 text-white/55">
            Create, edit and generate with Articog&apos;s AI-powered creative tools.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {accessError && <p role="alert" className="rounded-lg border border-rose-400/25 bg-rose-400/5 px-3 py-2.5 text-sm text-rose-200">{accessError}</p>}
          <div>
            <label htmlFor="access-full-name" className="text-[13px] font-medium text-white/85">Full name <span className="text-rose-300">*</span></label>
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
            <label htmlFor="access-email" className="text-[13px] font-medium text-white/85">Email address <span className="text-rose-300">*</span></label>
            <input
              id="access-email"
              name="email"
              autoComplete="email"
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: '' })); setEmailSent(false); }}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'access-email-error' : undefined}
              placeholder="you@company.com"
              className={fieldClass('email')}
            />
            {errors.email && <p id="access-email-error" className="mt-1.5 text-xs text-rose-300">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="access-company" className="text-[13px] font-medium text-white/85">Company / organization <span className="text-white/40">(optional)</span></label>
            <input
              id="access-company"
              name="organization"
              autoComplete="organization"
              type="text"
              maxLength={160}
              value={company}
              onChange={(event) => { setCompany(event.target.value); setErrors((current) => ({ ...current, company: '' })); }}
              aria-invalid={!!errors.company}
              aria-describedby={errors.company ? 'access-company-error' : undefined}
              placeholder="Your company or organization"
              className={fieldClass('company')}
            />
            {errors.company && <p id="access-company-error" className="mt-1.5 text-xs text-rose-300">{errors.company}</p>}
          </div>

          {formError && <p role="alert" className="rounded-lg border border-rose-400/25 bg-rose-400/5 px-3 py-2.5 text-sm text-rose-200">{formError}</p>}
          {emailSent && (
            <p role="status" className="rounded-lg border border-emerald-400/25 bg-emerald-400/5 px-3 py-2.5 text-sm leading-5 text-emerald-100">
              Check your inbox for a secure sign-in link. Open it to finish setting up your studio access.
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-[#101111] transition-colors hover:bg-white/90 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" aria-hidden="true" />}
            {isSubmitting ? (authenticated ? 'Saving your details…' : 'Sending secure sign-in link…') : (emailSent ? 'Send another sign-in link' : 'Continue to Articog Studio')}
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-white/40">
          {authenticated ? 'Your details are saved securely to your Articog account.' : 'We’ll email you a secure link to verify your address and continue.'}
        </p>
      </section>
    </main>
  );
}
