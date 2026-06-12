import { redirect } from "next/navigation";

export const metadata = {
  title: "E-FIX 注文サイト",
  description: "E-FIX eSteerの注文ページです。",
};

export default function WholesalePage() {
  redirect("/wholesale/esteer20");
}
