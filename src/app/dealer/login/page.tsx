import { redirect } from "next/navigation";

export const metadata = {
  title: "E-FIX 販売店ログイン",
  robots: { index: false, follow: false },
};

export default function DealerLoginPage() {
  redirect("/partner/login");
}
