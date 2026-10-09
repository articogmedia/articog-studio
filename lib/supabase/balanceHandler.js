function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function createBalanceHandler({ isOwnGateway, getUser, getBalance }) {
  return async function GET() {
    if (!isOwnGateway()) return json({ balance: 0 });

    const user = await getUser();
    if (!user) return json({ detail: 'Please sign in.' }, 401);

    try {
      const balance = await getBalance(user.id);
      return json({ balance: Number(balance ?? 0) });
    } catch {
      return json({ balance: 0 });
    }
  };
}