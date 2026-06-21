import { getCurrentAdmin } from "@/lib/admin-auth";
import { fetchWebCatalogItems } from "@/lib/web-catalog";
import WebCatalogClient from "./WebCatalogClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminWebCatalogPage() {
  const admin = await getCurrentAdmin();
  const catalog = await fetchWebCatalogItems({ seedIfEmpty: true });

  return (
    <WebCatalogClient catalog={catalog} adminEmail={admin?.email ?? "-"} />
  );
}
