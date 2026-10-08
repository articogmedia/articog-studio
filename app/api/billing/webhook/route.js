import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { admin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Payments are not configured', { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const body = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      const { error } = await admin.rpc('add_credits', {
        p_user: session.metadata.userId,
        p_amount: Number(session.metadata.credits),
        p_reason: 'purchase',
        p_job: null,
        p_payment: session.id,
      });
      // 23505 = this payment was already credited (Stripe retried the webhook)
      if (error && error.code !== '23505') return new Response('Could not add credits', { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
