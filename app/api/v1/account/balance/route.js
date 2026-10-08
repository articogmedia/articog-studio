import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/user';
import { admin } from '@/lib/supabase/admin';

export async function GET() {
  if (process.env.NEXT_PUBLIC_USE_OWN_GATEWAY === 'true') {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ detail: 'Please sign in.' }, { status: 401 });
    }

    try {
      const { data } = await admin.from('profiles').select('credits').eq('id', user.id).maybeSingle();
      return NextResponse.json({ balance: Number(data?.credits ?? 0) });
    } catch {
      return NextResponse.json({ balance: 0 });
    }
  }

  return NextResponse.json({ balance: 0 });
}
