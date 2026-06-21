import { fetchPartnerProfiles, type PartnerProfile } from "@/lib/partner-auth";
import {
  fetchWebOrders,
  fetchWholesaleOrders,
  type WebOrderRow,
  type WholesaleOrderRow,
} from "@/lib/sheets";

export type AdminCustomerKind = "web" | "wholesale" | "distributor" | "mixed";

export interface AdminCustomerRow {
  key: string;
  kind: AdminCustomerKind;
  sources: string[];
  name: string;
  companyName: string;
  contactName: string;
  partnerId: string;
  email: string;
  phone: string;
  postalCode: string;
  address: string;
  orderCount: number;
  webOrderCount: number;
  wholesaleOrderCount: number;
  totalAmount: number;
  latestOrderAt: string;
  latestStatus: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function customerKey(input: {
  partnerId?: string;
  email?: string;
  phone?: string;
  name?: string;
  address?: string;
}): string {
  if (input.partnerId) return `partner:${normalize(input.partnerId)}`;
  if (input.email) return `email:${normalize(input.email)}`;
  if (input.phone) return `phone:${normalize(input.phone)}`;
  return `name:${normalize(input.name ?? "")}:${normalize(input.address ?? "")}`;
}

function emptyCustomer(key: string): AdminCustomerRow {
  return {
    key,
    kind: "web",
    sources: [],
    name: "",
    companyName: "",
    contactName: "",
    partnerId: "",
    email: "",
    phone: "",
    postalCode: "",
    address: "",
    orderCount: 0,
    webOrderCount: 0,
    wholesaleOrderCount: 0,
    totalAmount: 0,
    latestOrderAt: "",
    latestStatus: "",
  };
}

function addSource(row: AdminCustomerRow, source: string): void {
  if (!row.sources.includes(source)) row.sources.push(source);
}

function mergeText(current: string, next: string): string {
  return current || next;
}

function updateKind(row: AdminCustomerRow): void {
  const hasWeb = row.webOrderCount > 0 || row.sources.includes("Web販売");
  const hasWholesale =
    row.wholesaleOrderCount > 0 || row.sources.includes("通常卸");
  const hasDistributor = row.sources.includes("特価卸");
  if ([hasWeb, hasWholesale, hasDistributor].filter(Boolean).length > 1) {
    row.kind = "mixed";
    return;
  }
  if (hasDistributor) row.kind = "distributor";
  else if (hasWholesale) row.kind = "wholesale";
  else row.kind = "web";
}

function applyWebOrder(row: AdminCustomerRow, order: WebOrderRow): void {
  addSource(row, "Web販売");
  row.name = mergeText(row.name, order.customerName);
  row.email = mergeText(row.email, order.customerEmail);
  row.phone = mergeText(row.phone, order.customerPhone);
  row.postalCode = mergeText(row.postalCode, order.customerPostalCode);
  row.address = mergeText(row.address, order.customerAddress);
  row.partnerId = mergeText(row.partnerId, order.partnerId);
  row.orderCount += 1;
  row.webOrderCount += 1;
  row.totalAmount += order.amountTotal ?? 0;
  if (!row.latestOrderAt || order.orderedAt > row.latestOrderAt) {
    row.latestOrderAt = order.orderedAt;
    row.latestStatus = order.paymentStatus || "";
  }
  updateKind(row);
}

function wholesaleSource(order: WholesaleOrderRow): "通常卸" | "特価卸" {
  const tier = `${order.priceTier} ${order.source}`.toLowerCase();
  return tier.includes("special") ||
    tier.includes("distributor") ||
    tier.includes("特価")
    ? "特価卸"
    : "通常卸";
}

function applyWholesaleOrder(
  row: AdminCustomerRow,
  order: WholesaleOrderRow,
): void {
  addSource(row, wholesaleSource(order));
  row.companyName = mergeText(row.companyName, order.companyName);
  row.contactName = mergeText(row.contactName, order.contactName);
  row.name = mergeText(row.name, order.contactName || order.companyName);
  row.partnerId = mergeText(row.partnerId, order.partnerId);
  row.email = mergeText(row.email, order.email);
  row.phone = mergeText(row.phone, order.phone);
  row.postalCode = mergeText(row.postalCode, order.postalCode);
  row.address = mergeText(row.address, order.deliveryAddress);
  row.orderCount += 1;
  row.wholesaleOrderCount += 1;
  row.totalAmount += order.totalIncTax ?? 0;
  if (!row.latestOrderAt || order.orderedAt > row.latestOrderAt) {
    row.latestOrderAt = order.orderedAt;
    row.latestStatus = order.deliveryStatus || order.orderStatus || "";
  }
  updateKind(row);
}

function applyPartnerProfile(
  row: AdminCustomerRow,
  profile: PartnerProfile,
): void {
  addSource(row, profile.tier === "distributor" ? "特価卸" : "通常卸");
  row.companyName = mergeText(row.companyName, profile.companyName);
  row.contactName = mergeText(row.contactName, profile.contactName);
  row.name = mergeText(row.name, profile.contactName || profile.companyName);
  row.partnerId = mergeText(row.partnerId, profile.partnerId);
  row.email = mergeText(row.email, profile.email);
  row.phone = mergeText(row.phone, profile.phone);
  row.postalCode = mergeText(row.postalCode, profile.postalCode);
  row.address = mergeText(row.address, profile.address);
  updateKind(row);
}

function hasCustomerIdentity(row: AdminCustomerRow): boolean {
  return Boolean(
    row.name ||
      row.companyName ||
      row.contactName ||
      row.email ||
      row.phone ||
      row.partnerId,
  );
}

export async function fetchAdminCustomers(): Promise<AdminCustomerRow[]> {
  const [webOrders, wholesaleOrders, partnerProfiles] = await Promise.all([
    fetchWebOrders(),
    fetchWholesaleOrders(),
    fetchPartnerProfiles().catch(() => []),
  ]);

  const customers = new Map<string, AdminCustomerRow>();

  function getOrCreate(key: string): AdminCustomerRow {
    const current = customers.get(key);
    if (current) return current;
    const row = emptyCustomer(key);
    customers.set(key, row);
    return row;
  }

  for (const order of webOrders) {
    const key = customerKey({
      partnerId: order.partnerId,
      email: order.customerEmail,
      phone: order.customerPhone,
      name: order.customerName,
      address: order.customerAddress,
    });
    applyWebOrder(getOrCreate(key), order);
  }

  for (const order of wholesaleOrders) {
    const key = customerKey({
      partnerId: order.partnerId,
      email: order.email,
      phone: order.phone,
      name: order.companyName || order.contactName,
      address: order.deliveryAddress,
    });
    applyWholesaleOrder(getOrCreate(key), order);
  }

  for (const profile of partnerProfiles) {
    const key = customerKey({
      partnerId: profile.partnerId,
      email: profile.email,
      phone: profile.phone,
      name: profile.companyName || profile.contactName,
      address: profile.address,
    });
    applyPartnerProfile(getOrCreate(key), profile);
  }

  return Array.from(customers.values())
    .filter(hasCustomerIdentity)
    .sort((a, b) => {
      if (a.latestOrderAt !== b.latestOrderAt) {
        return b.latestOrderAt.localeCompare(a.latestOrderAt);
      }
      return (a.companyName || a.name).localeCompare(b.companyName || b.name);
    });
}
