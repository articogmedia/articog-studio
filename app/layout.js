import './globals.css';
import { Sora } from "next/font/google";
import { headers } from 'next/headers';
import { getLocaleConfig } from '@/lib/locales';

const sora = Sora({
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sora",
  subsets: ["latin"],
});

export const viewport = { themeColor: "#000000" };

export const metadata = {
  title: 'Articog Studio — Free AI Image & Video Studio',
  description: 'Generate AI images and videos using 200+ models — Flux, Midjourney, Kling, Veo, Seedance and more.',
};

export default async function RootLayout({ children }) {
  // Locale is derived from the URL path by middleware.js and passed
  // through as a plain response header — the root layout is shared by
  // every locale's route tree, so it can't take a `locale` prop directly.
  const headerList = await headers();
  const { htmlLang } = getLocaleConfig(headerList.get('x-locale'));

  return (
    <html lang={htmlLang}>
      <body className={sora.variable}>{children}</body>
    </html>
  );
}
