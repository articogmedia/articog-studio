export async function requireAuthenticatedGatewayUser(getUser) {
  const user = await getUser();
  if (user) return { user, response: null };

  return {
    user: null,
    response: Response.json(
      { detail: 'Please sign in to use the gateway.' },
      { status: 401 },
    ),
  };
}