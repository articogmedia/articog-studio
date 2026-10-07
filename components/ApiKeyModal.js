'use client';

import { useState } from 'react';
import { getCommonCopy } from '@/lib/locales';

export default function ApiKeyModal({ onSave, onClose, overlay = false, title, subtitle, locale = 'en' }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const copy = getCommonCopy(locale).apiKeyModal;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) { setError(copy.missingKeyError); return; }
    onSave(trimmed);
  };

  const wrapperClass = overlay
    ? 'fixed inset-0 z-[200] bg-black/80 flex items-center justify-center px-4 animate-fade-in-up'
    : 'min-h-screen bg-black flex items-center justify-center px-4';

  return (
    <div className={wrapperClass}>
      <div className="w-full max-w-sm bg-[#080808] border border-white/10 rounded-xl p-8 relative">
        {overlay && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="absolute top-3 right-3 w-8 h-8 rounded-full text-white/55 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-14 h-14 bg-white/[0.03] rounded-xl flex items-center justify-center border border-white/10 mb-6 group hover:border-white/20 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" className="group-hover:scale-110 transition-transform">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L12 17.25l-4.5-4.5L15.5 7.5z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mb-2">
            {title || copy.title}
          </h1>
          <p className="text-white/55 text-[13px] leading-relaxed px-4">
            {subtitle || (
              <>{copy.subtitlePrefix} <a href="https://muapi.ai/access-keys" target="_blank" rel="noreferrer" className="text-white hover:text-white/80 transition-colors">Muapi.ai</a> {copy.subtitleSuffix}</>
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55 ml-1">
              {copy.label}
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(''); }}
              placeholder={copy.placeholder}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-[#e6e6e6] placeholder:text-[#a6a6a6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 transition-colors"
              suppressHydrationWarning
            />
            {error && <p className="mt-2 text-red-500/80 text-[11px] font-medium ml-1">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-white text-black text-sm font-medium py-2.5 rounded-full hover:bg-white/90 active:scale-[0.98] transition-colors"
            suppressHydrationWarning
          >
            {copy.submit}
          </button>

          <p className="text-center text-[12px] text-white/55 pt-2">
            {copy.needKey}{' '}
            <a href="https://muapi.ai/access-keys" target="_blank" rel="noreferrer" className="text-white/70 hover:text-white transition-colors font-medium">
              {copy.getOneFree}
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
