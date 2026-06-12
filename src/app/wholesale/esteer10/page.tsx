import WholesaleOrderClient from "@/components/WholesaleOrderClient";
import { redirect } from "next/navigation";
import { fetchPartnerById, getCurrentPartner } from "@/lib/partner-auth";
import {
  WHOLESALE_IMAGE_ASSETS,
  WHOLESALE_MAIN_ITEMS,
  WHOLESALE_OPTION_ITEMS,
} from "@/lib/wholesale-catalog";

const ESTEER10_HERO_IMAGE =
  "/wholesale-assets/wholesale-hero-option-d-cpu-lines-v4-backplane.png";

export const metadata = {
  title: "E-FIX eSteer 10 注文",
  description:
    "旧型機のeSteer 10本体、eSteer10対応部品、共用部品を卸価格で注文できます。",
};

export default async function ESteer10WholesalePage() {
  const session = await getCurrentPartner();
  if (!session) {
    redirect("/partner/login?next=/wholesale/esteer10");
  }
  if (session.tier === "distributor") {
    redirect("/wholesale/special/esteer10");
  }
  const profile = await fetchPartnerById(session.partnerId);

  const mainItems = WHOLESALE_MAIN_ITEMS.filter((item) => item.id === "set-10");
  const optionItems = WHOLESALE_OPTION_ITEMS.filter((item) => {
    if (["eSteer10", "その他"].includes(item.model)) return true;
    if (item.model !== "共用") return false;
    const text = `${item.shortName} ${item.partNumber} ${item.name}`
      .toLowerCase()
      .replace(/\s/g, "");
    return !text.includes("esteer20のみ") && !text.includes("esteer20用");
  });

  return (
    <WholesaleOrderClient
      heroImage={ESTEER10_HERO_IMAGE}
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
        pageKey: "legacy",
        badge: "LEGACY MODEL",
        title: "eSteer 10 注文",
        subtitle: "旧型機用の本体・部品ページ",
        description:
          "旧型のeSteer 10本体セット、eSteer10対応部品、共用部品をこのページで注文できます。20/20MAXと混ざらないよう、旧型向けだけを表示しています。",
        companionHref: "/wholesale/esteer20",
        companionLabel: "現行 20 / 20MAXページへ",
      }}
    />
  );
}
