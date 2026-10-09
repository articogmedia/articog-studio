import { getUser } from '@/lib/supabase/user';
import { admin } from '@/lib/supabase/admin';
import { createBalanceHandler } from '@/lib/supabase/balanceHandler';

export const GET = createBalanceHandler({
  isOwnGateway: () => process.env.NEXT_PUBLIC_USE_OWN_GATEWAY === 'true',
  getUser,
  async getBalance(userId) {
    const { data } = await admin.from('profiles').select('credits').eq('id', userId).maybeSingle();
    return data?.credits;
  },
});
