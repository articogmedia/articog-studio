'use client';

import { useState } from 'react';
import ArticogLogo from './ArticogLogo';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ArticogAccessScreen({ initialProfile, accessError, onComplete }) {
  const [fullName, setFullName] = useState(initialProfile?.fullName || '');
  const [email, setEmail] = useState(initialProfile?.email || '');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

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
      const result = await onComplete({ fullName: trimmedName, email: normalizedEmail });
      if (typeof result === 'string') {
        setStatusMessage(result);
      }
      setIsSubmitting(false);
    } catch (error) {
      setErrors({ form: error?.message || 'Could not save your details in this browser.' });
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
          {accessError && <p role="alert" className="rounded-lg border border-rose-400/25 bg-rose-400/5 px-3 py-2.5 text-sm text-rose-200">{accessError}</p>}
          {errors.form && <p role="alert" className="rounded-lg border border-rose-400/25 bg-rose-400/5 px-3 py-2.5 text-sm text-rose-200">{errors.form}</p>}
          {statusMessage && <p role="status" className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/75">{statusMessage}</p>}
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-[#101111] transition-colors hover:bg-white/90 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" aria-hidden="true" />}
            {isSubmitting ? 'Opening Studio...' : 'Continue to Studio'}
          </button>
        </form>
      </section>
    </main>
  );
}
