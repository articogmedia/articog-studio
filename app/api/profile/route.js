import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase/admin';
import { getUser } from '@/lib/supabase/user';

export const runtime = 'nodejs';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeProfile(value, fallbackEmail = '') {
  const fullName = typeof value?.fullName === 'string' ? value.fullName.trim() : '';
  const email = typeof value?.email === 'string' ? value.email.trim().toLowerCase() : fallbackEmail;
  const company = typeof value?.company === 'string' ? value.company.trim() : '';

  return { fullName, email, company };
}

function isComplete(profile) {
  return profile.fullName.length > 0 && profile.fullName.length <= 120 && EMAIL_PATTERN.test(profile.email);
}

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, complete: false, profile: null }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const profile = normalizeProfile(user.user_metadata?.articog_profile, user.email || '');
  return NextResponse.json({
    authenticated: true,
    complete: isComplete(profile),
    profile,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ detail: 'Sign in to continue.' }, { status: 401 });
  }

  let submitted;
  try {
    submitted = await request.json();
  } catch {
    return NextResponse.json({ detail: 'Enter your details and try again.' }, { status: 400 });
  }

  const profile = normalizeProfile(submitted);
  if (!profile.fullName || profile.fullName.length > 120) {
    return NextResponse.json({ detail: 'Enter a full name of 1 to 120 characters.' }, { status: 400 });
  }
  if (profile.email.length > 254 || !EMAIL_PATTERN.test(profile.email)) {
    return NextResponse.json({ detail: 'Enter a valid email address.' }, { status: 400 });
  }
  if (profile.company.length > 160) {
    return NextResponse.json({ detail: 'Company or organization must be 160 characters or fewer.' }, { status: 400 });
  }

  const { data, error } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata || {}),
      articog_profile: { ...profile, completedAt: new Date().toISOString() },
    },
  });

  if (error || !data?.user) {
    return NextResponse.json({ detail: 'We could not save your details. Please try again.' }, { status: 503 });
  }

  return NextResponse.json({ complete: true, profile });
}
