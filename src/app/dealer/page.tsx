import { redirect } from "next/navigation";

export const metadata = {
  title: "E-FIX 販売店ページ",
  robots: { index: false, follow: false },
};

export default function DealerPage() {
  redirect("/partner");
}
