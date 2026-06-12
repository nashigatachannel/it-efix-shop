import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "E-FIX 販売店ログイン",
  robots: { index: false, follow: false },
};

interface PartnerLoginLayoutProps {
  children: React.ReactNode;
}

export default function PartnerLoginLayout({
  children,
}: PartnerLoginLayoutProps) {
  return <>{children}</>;
}
