import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AccountTabs from "./AccountTabs";

// マイページは常に最新のログイン状態・注文状況を表示する。
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountPage() {
  // middleware(/account)で既に保護されているが、Next.js 16 の推奨に従い
  // Server Component 側でも認証を確認する(多層防御)。
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?next=/account");
  }

  const user = await currentUser();
  const displayName =
    user?.fullName?.trim() ||
    user?.primaryEmailAddress?.emailAddress ||
    "お客様";

  return (
    <>
      <Header />
      <main className="mx-auto flex-1 w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm font-bold text-[#0b806b]">MY PAGE</p>
        <h1 className="mt-2 text-3xl font-black text-[#1c2b25]">
          {displayName} 様
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#607069]">
          ご注文履歴の確認や、アカウント情報の変更ができます。
        </p>

        <div className="mt-8">
          <AccountTabs />
        </div>
      </main>
      <Footer />
    </>
  );
}
