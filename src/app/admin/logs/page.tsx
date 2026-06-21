import AdminPlaceholderPage from "../_components/AdminPlaceholderPage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminLogsPage() {
  return (
    <AdminPlaceholderPage
      title="ログ管理"
      description="注文、決済、在庫更新、納品状態変更などの操作履歴を確認する画面です。"
      items={[
        "注文作成ログ",
        "Stripe webhookログ",
        "在庫更新ログ",
        "納品状態変更ログ",
        "請求書ダウンロードログ",
        "管理者操作ログ",
      ]}
    />
  );
}
