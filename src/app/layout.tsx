import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://efix-shop.jp"),
  title: "E-FIX | 農機具電動ステアリングシステム",
  description:
    "E-FIXは農業機械向け電動ステアリングシステム e-steer を販売しています。トラクターに後付けで自動操舵を導入し、高精度な直進作業を実現します。",
  keywords: [
    "農機具",
    "電動ステアリング",
    "自動操舵",
    "GPS",
    "RTK",
    "後付け",
    "トラクター",
    "e-steer",
    "E-FIX",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "https://efix-shop.jp/",
    siteName: "E-FIX",
    title: "E-FIX | 農機具電動ステアリングシステム",
    description:
      "農業機械向け電動ステアリングシステム e-steer 公式販売サイト。後付けで自動操舵を導入し、精密な直進作業を実現します。",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
