import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "つくりて | おいしいが、作者に返る。",
  description: "ひらめきがレシピに。誰かの食卓で役立つほど、作者に価値が返る料理SNS。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
