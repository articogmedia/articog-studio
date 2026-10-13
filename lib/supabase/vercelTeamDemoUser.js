const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolveVercelTeamDemoUser({
  isVercelProduction,
  ownGatewayEnabled,
  demoAccessEnabled,
  userId,
  lookupUser,
}) {
  if (
    isVercelProduction !== true ||
    ownGatewayEnabled !== true ||
    demoAccessEnabled !== true ||
    typeof userId !== 'string' ||
    !UUID_PATTERN.test(userId)
  ) return null;

  const user = await lookupUser(userId);
  if (!user || user.id !== userId) return null;
  if (user.banned_until && Date.parse(user.banned_until) > Date.now()) return null;
  return user;
}