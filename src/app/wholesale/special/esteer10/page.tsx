import WholesaleOrderClient from "@/components/WholesaleOrderClient";
import { redirect } from "next/navigation";
import { fetchPartnerById, getCurrentPartner } from "@/lib/partner-auth";
import {
  SPECIAL_WHOLESALE_MAIN_ITEMS,
  SPECIAL_WHOLESALE_OPTION_ITEMS,
  WHOLESALE_IMAGE_ASSETS,
} from "@/lib/wholesale-catalog";

const ESTEER10_HERO_IMAGE =
  "/wholesale-assets/wholesale-hero-option-d-cpu-lines-v4-backplane.png";

export const metadata = {
  title: "E-FIX eSteer 10 注文",
  description:
    "特価卸アカウント向けのeSteer 10本体・部品注文ページです。",
};

export default async function ESteer10SpecialWholesalePage() {
  const session = await getCurrentPartner();
  if (!session) {
    redirect("/partner/login?next=/wholesale/special/esteer10");
  }
  if (session.tier !== "distributor") {
    redirect("/wholesale/esteer10");
  }
  const profile = await fetchPartnerById(session.partnerId);

  const mainItems = SPECIAL_WHOLESALE_MAIN_ITEMS.filter(
    (item) => item.id === "set-10",
  );
  const optionItems = SPECIAL_WHOLESALE_OPTION_ITEMS.filter((item) => {
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
        badge: "SPECIAL WHOLESALE",
        title: "eSteer 10 注文",
        subtitle: "特価卸向けの旧型機用ページ",
        description:
          "特価卸アカウント向けのeSteer 10本体セット、eSteer10対応部品、共用部品をこのページで注文できます。",
        companionHref: "/wholesale/special/esteer20",
        companionLabel: "20 / 20MAX特価ページへ",
        currentHref: "/wholesale/special/esteer20",
        legacyHref: "/wholesale/special/esteer10",
        priceLabel: "特価卸価格 税抜",
        priceHeadingLabel: "税抜特価卸価格",
      }}
    />
  );
}
