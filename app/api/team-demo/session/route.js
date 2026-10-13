import { admin } from '@/lib/supabase/admin';
import { createTeamDemoSessionHandlers } from '@/lib/supabase/teamDemoRoute';

export const runtime = 'nodejs';

const handlers = createTeamDemoSessionHandlers({
  lookupUser: async (userId) => {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) throw error;
    return data?.user || null;
  },
});

export const POST = handlers.POST;
export const DELETE = handlers.DELETE;