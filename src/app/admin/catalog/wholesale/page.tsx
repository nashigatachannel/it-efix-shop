import AdminPlaceholderPage from "../../_components/AdminPlaceholderPage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminWholesaleCatalogPage() {
  return (
    <AdminPlaceholderPage
      title="卸の価格・商品管理"
      description="通常卸に出す商品、価格、販売可否を管理する画面です。"
      items={[
        "卸向け商品の表示/非表示",
        "卸価格の更新",
        "商品カテゴリの管理",
        "在庫連動の有無",
        "卸先ごとの販売条件",
      ]}
    />
  );
}
