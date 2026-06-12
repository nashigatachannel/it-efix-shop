import WholesaleOrderClient from "@/components/WholesaleOrderClient";
import { redirect } from "next/navigation";
import { fetchPartnerById, getCurrentPartner } from "@/lib/partner-auth";
import {
  WHOLESALE_IMAGE_ASSETS,
  WHOLESALE_MAIN_ITEMS,
  WHOLESALE_OPTION_ITEMS,
} from "@/lib/wholesale-catalog";

const ESTEER20_HERO_IMAGE =
  "/wholesale-assets/wholesale-hero-esteer20-cpu-lines-v3-backplane.png";

export const metadata = {
  title: "E-FIX eSteer 20 / 20MAX 注文",
  description:
    "現行機のeSteer 20、eSteer 20MAX、共用部品を卸価格で注文できます。",
};

export default async function ESteer20WholesalePage() {
  const session = await getCurrentPartner();
  if (!session) {
    redirect("/partner/login?next=/wholesale/esteer20");
  }
  if (session.tier === "distributor") {
    redirect("/wholesale/special/esteer20");
  }
  const profile = await fetchPartnerById(session.partnerId);

  const mainItems = WHOLESALE_MAIN_ITEMS.filter((item) =>
    ["set-20", "set-20max"].includes(item.id),
  );
  const optionItems = WHOLESALE_OPTION_ITEMS.filter((item) => {
    if (item.model === "eSteer20/20MAX") return true;
    if (item.model !== "共用") return false;
    const text = `${item.shortName} ${item.partNumber} ${item.name}`
      .toLowerCase()
      .replace(/\s/g, "");
    return !text.includes("esteer10のみ") && !text.includes("esteer10用");
  });

  return (
    <WholesaleOrderClient
      heroImage={ESTEER20_HERO_IMAGE}
      mainItems={mainItems}
      optionItems={optionItems}
      imageAssets={WHOLESALE_IMAGE_ASSETS}
      partnerCompanyName={profile?.companyName || session.companyName}
      partnerDefaults={{
        contactName: profile?.contactName ?? "",
        email: profile?.email ?? "",
        phone: profile?.phone ?? "",
        postalCode: profile?.postalCode ?? "",
        address: profile?.address ?? "",
      }}
      pageConfig={{
        pageKey: "current",
        badge: "CURRENT MODEL",
        title: "eSteer 20 / 20MAX 注文",
        subtitle: "現行機用の本体・部品ページ",
        description:
          "eSteer 20とeSteer 20MAXの本体セット、20/20MAX対応部品、共用部品をまとめて数量指定できます。請求書は納品日時に合わせて別作成する前提で、ここでは注文内容と履歴を確認できます。",
        companionHref: "/wholesale/esteer10",
        companionLabel: "旧型 eSteer 10ページへ",
      }}
    />
  );
}
