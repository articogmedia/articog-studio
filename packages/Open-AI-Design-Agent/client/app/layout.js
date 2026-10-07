import { Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "react-hot-toast";

const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata = {
  title: "Open Muapi Assistant",
  description: "Open source AI creative assistant powered by Muapi API",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={sora.variable} suppressHydrationWarning>
      <body className={`${sora.variable} antialiased`}>
        <Providers>
          {children}
        </Providers>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
