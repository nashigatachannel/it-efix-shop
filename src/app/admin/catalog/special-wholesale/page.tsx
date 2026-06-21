import AdminPlaceholderPage from "../../_components/AdminPlaceholderPage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminSpecialWholesaleCatalogPage() {
  return (
    <AdminPlaceholderPage
      title="特価卸の価格・商品管理"
      description="特価卸に出す商品、特別価格、販売条件を管理する画面です。"
      items={[
        "特価卸向け商品の表示/非表示",
        "特別価格の更新",
        "販売期間の設定",
        "販売先条件の設定",
        "通常卸価格との差分確認",
      ]}
    />
  );
}
