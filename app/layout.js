import './globals.css';
import { Sora } from "next/font/google";
import { headers } from 'next/headers';
import { getLocaleConfig } from '@/lib/locales';

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: 'Articog Studio',
  description: 'AI creative studio by Articog. Generate images and videos with leading AI models.',
  icons: { icon: '/articog-logo.png' },
};

export default async function RootLayout({ children }) {
  // Locale is derived from the URL path by middleware.js and passed
  // through as a plain response header — the root layout is shared by
  // every locale's route tree, so it can't take a `locale` prop directly.
  const headerList = await headers();
  const { htmlLang } = getLocaleConfig(headerList.get('x-locale'));

  return (
    <html lang={htmlLang} className={sora.variable}>
      <body className={sora.variable}>{children}</body>
    </html>
  );
}
