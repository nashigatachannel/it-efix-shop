import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  JP_TAX_RATE_ID,
  INVOICE_FOOTER,
  INVOICE_CUSTOM_FIELDS,
} from "@/lib/invoice-config";

interface LineItem {
  name: string;
  unitAmount: number;
  quantity: number;
}

interface CustomCheckoutRequest {
  // 新仕様: 複数明細
  lineItems?: LineItem[];
  // 後方互換: 単一行
  amount?: number;
  description?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
}

const MAX_AMOUNT_PER_ITEM = 10_000_000;
const MAX_TOTAL_AMOUNT = 10_000_000;
const MAX_LINE_ITEMS = 20;

function normalizeLineItems(body: CustomCheckoutRequest): LineItem[] | { error: string } {
  if (Array.isArray(body.lineItems) && body.lineItems.length > 0) {
    if (body.lineItems.length > MAX_LINE_ITEMS) {
      return { error: `lineItems too many (max ${MAX_LINE_ITEMS})` };
    }
    for (const item of body.lineItems) {
      if (!item.name || item.name.trim().length === 0) {
        return { error: "each lineItem requires non-empty name" };
      }
      if (
        typeof item.unitAmount !== "number" ||
        !Number.isInteger(item.unitAmount) ||
        item.unitAmount < 1 ||
        item.unitAmount > MAX_AMOUNT_PER_ITEM
      ) {
        return {
          error: `each lineItem unitAmount must be integer 1..${MAX_AMOUNT_PER_ITEM}`,
        };
      }
      if (
        typeof item.quantity !== "number" ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 999
      ) {
        return { error: "each lineItem quantity must be integer 1..999" };
      }
    }
    return body.lineItems.map((item) => ({
      name: item.name.trim(),
      unitAmount: item.unitAmount,
      quantity: item.quantity,
    }));
  }

  // 後方互換: amount + description
  if (
    typeof body.amount === "number" &&
    Number.isInteger(body.amount) &&
    body.amount >= 1 &&
    body.amount <= MAX_AMOUNT_PER_ITEM &&
    typeof body.description === "string" &&
    body.description.trim().length > 0
  ) {
    return [
      {
        name: body.description.trim(),
        unitAmount: body.amount,
        quantity: 1,
      },
    ];
  }

  return { error: "lineItems[] or (amount + description) is required" };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: CustomCheckoutRequest;

  try {
    body = (await request.json()) as CustomCheckoutRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { customer } = body;

  if (!customer?.name || !customer?.email || !customer?.phone) {
    return NextResponse.json(
      { error: "customer name, email, and phone are required" },
      { status: 400 }
    );
  }

  const normalized = normalizeLineItems(body);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const total = normalized.reduce(
    (sum, item) => sum + item.unitAmount * item.quantity,
    0
  );
  if (total > MAX_TOTAL_AMOUNT) {
    return NextResponse.json(
      { error: `total exceeds maximum (${MAX_TOTAL_AMOUNT} JPY)` },
      { status: 400 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (request.headers.get("origin") ?? "http://localhost:3000");

  const stripeCustomer = await stripe.customers.create({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    preferred_locales: ["ja"],
  });

  const summary = normalized
    .map((item) =>
      item.quantity > 1
        ? `${item.name} ×${item.quantity}`
        : item.name
    )
    .join(" / ");

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card", "customer_balance"],
    payment_method_options: {
      customer_balance: {
        funding_type: "bank_transfer",
        bank_transfer: {
          type: "jp_bank_transfer",
        },
      },
    },
    customer: stripeCustomer.id,
    line_items: normalized.map((item) => ({
      price_data: {
        currency: "jpy",
        product_data: {
          name: item.name,
        },
        unit_amount: item.unitAmount,
      },
      quantity: item.quantity,
      tax_rates: [JP_TAX_RATE_ID],
    })),
    mode: "payment",
    success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/cancel`,
    locale: "ja",
    invoice_creation: {
      enabled: true,
      invoice_data: {
        description: summary,
        footer: INVOICE_FOOTER,
        custom_fields: INVOICE_CUSTOM_FIELDS,
        rendering_options: {
          amount_tax_display: "include_inclusive_tax",
        },
        metadata: {
          orderType: "custom_payment",
          customerName: customer.name,
        },
      },
    },
    metadata: {
      type: "custom_payment",
      description: summary,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      lineItemCount: String(normalized.length),
      totalAmount: String(total),
      requestInvoice: "true",
    },
  });

  return NextResponse.json({ url: session.url, total, summary });
}
