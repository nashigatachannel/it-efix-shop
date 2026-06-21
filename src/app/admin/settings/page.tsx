import AdminPlaceholderPage from "../_components/AdminPlaceholderPage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminSettingsPage() {
  return (
    <AdminPlaceholderPage
      title="設定"
      description="注文管理、販売制御、通知、外部サービス連携の設定を管理する画面です。"
      items={[
        "管理者ログイン方式",
        "Google Sheets接続",
        "Stripe接続",
        "メール通知",
        "請求書設定",
        "物流連携の接続先",
      ]}
    />
  );
}
