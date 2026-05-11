import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "E-FIX 販売店ページ",
  robots: { index: false, follow: false },
};

interface PartnerLayoutProps {
  children: React.ReactNode;
}

export default function PartnerLayout({ children }: PartnerLayoutProps) {
  return <>{children}</>;
}
