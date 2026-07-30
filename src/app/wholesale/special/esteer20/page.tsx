import WholesaleOrderClient from "@/components/WholesaleOrderClient";
import { redirect } from "next/navigation";
import { fetchPartnerById, getCurrentPartner } from "@/lib/partner-auth";
import {
  SPECIAL_WHOLESALE_MAIN_ITEMS,
  SPECIAL_WHOLESALE_OPTION_ITEMS,
  WHOLESALE_IMAGE_ASSETS,
  isHottaBracketItem,
} from "@/lib/wholesale-catalog";

const ESTEER20_HERO_IMAGE =
  "/wholesale-assets/wholesale-hero-esteer20-cpu-lines-v3-backplane.png";

export const metadata = {
  title: "E-FIX eSteer 20 / 20MAX 注文",
  description:
    "特価卸アカウント向けのeSteer 20、eSteer 20MAX本体・部品注文ページです。",
};

export default async function ESteer20SpecialWholesalePage() {
  const session = await getCurrentPartner();
  if (!session) {
    redirect("/partner/login?next=/wholesale/special/esteer20");
  }
  if (session.tier !== "distributor") {
    redirect("/wholesale/esteer20");
  }
  const profile = await fetchPartnerById(session.partnerId);

  const mainItems = SPECIAL_WHOLESALE_MAIN_ITEMS.filter((item) =>
    ["set-20", "set-20max"].includes(item.id),
  );
  const optionItems = SPECIAL_WHOLESALE_OPTION_ITEMS.filter((item) => {
    if (item.model === "eSteer20/20MAX") return true;
    // 堀田機工ブラケットはトラクター側金具のため機種を問わず掲載
    if (isHottaBracketItem(item)) return true;
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
        badge: "SPECIAL WHOLESALE",
        title: "eSteer 20 / 20MAX 注文",
        subtitle: "特価卸向けの本体・部品ページ",
        description:
          "特価卸アカウント向けのeSteer 20とeSteer 20MAX本体セット、20/20MAX対応部品、共用部品をまとめて数量指定できます。",
        companionHref: "/wholesale/special/esteer10",
        companionLabel: "eSteer 10特価ページへ",
        currentHref: "/wholesale/special/esteer20",
        legacyHref: "/wholesale/special/esteer10",
        priceLabel: "特価卸価格 税抜",
        priceHeadingLabel: "税抜特価卸価格",
      }}
    />
  );
}
