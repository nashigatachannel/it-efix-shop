import WholesaleOrderForm from "@/components/WholesaleOrderForm";

export default function WholesalePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-widest text-emerald-400">
              E-FIX
            </span>
            <span className="text-xs text-slate-500 border-l border-slate-700 pl-2">
              通常卸 / Wholesale
            </span>
          </div>
          <form action="/api/wholesale/logout" method="post">
            <button
              type="submit"
              className="text-xs text-slate-400 hover:text-red-400"
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white">通常卸 ご発注</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            こちらは通常卸契約の販売店様専用ページです。
            <br className="hidden sm:inline" />
            セット品単位で数量を指定し、適格請求書付きの決済URLを生成します。
          </p>
        </div>
        <WholesaleOrderForm tier="wholesale" tierLabel="通常卸" />
        <p className="mt-8 text-xs text-slate-500">
          ※ オプション部品の卸価格表は別途お問い合わせください。
        </p>
      </main>
    </div>
  );
}
