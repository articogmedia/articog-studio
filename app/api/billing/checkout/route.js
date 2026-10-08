import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getUser } from '@/lib/supabase/user';
import { getPacks } from '@/lib/billing/packs';

export const runtime = 'nodejs';

export async function POST(request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ detail: 'Please sign in.' }, { status: 401 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ detail: 'Payments are not configured.' }, { status: 503 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { pack } = await request.json();
  const chosen = getPacks()[pack];
  if (!chosen?.price || !chosen.credits) return NextResponse.json({ detail: 'Unknown pack' }, { status: 400 });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: chosen.price, quantity: 1 }],
    customer_email: user.email,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/studio?payment=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/studio?payment=cancelled`,
    metadata: { userId: user.id, credits: String(chosen.credits) },
  });

  return NextResponse.json({ url: session.url });
}
