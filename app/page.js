import { redirect } from 'next/navigation';

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const code = typeof params?.code === 'string' ? params.code : '';
  if (code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }

  redirect('/studio');
}
