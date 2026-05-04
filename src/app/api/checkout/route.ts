import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  getProductById,
  calcTaxIncluded,
  getPriceForTier,
  type ProductId,
  type PriceTier,
} from "@/lib/products";
import {
  JP_TAX_RATE_ID,
  INVOICE_FOOTER,
  INVOICE_CUSTOM_FIELDS,
} from "@/lib/invoice-config";

interface CustomerInfo {
  name: string;
  postalCode: string;
  address: string;
  phone: string;
  email: string;
  machineMaker: string;
  machineModel: string;
  notes?: string;
}

interface OrderLine {
  productId: ProductId;
  quantity: number;
}

interface CheckoutRequestBody {
  // 末端LP: productIds[](量はそれぞれ1)
  productIds?: ProductId[];
  // 卸/特価卸: 数量付きライン
  lines?: OrderLine[];
  customer: CustomerInfo;
  requestInvoice?: boolean;
  /** "retail" | "wholesale" | "distributor"。未指定はretail */
  priceTier?: PriceTier;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: CheckoutRequestBody;

  try {
    body = (await request.json()) as CheckoutRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { productIds, lines, customer, requestInvoice } = body;
  const priceTier: PriceTier = body.priceTier ?? "retail";

  if (!customer || !customer.name || !customer.email) {
    return NextResponse.json(
      { error: "customer.name and customer.email are required" },
      { status: 400 }
    );
  }

  // 入力をlines形式に正規化 (productIds は数量1のlines扱い)
  let normalizedLines: OrderLine[];
  if (lines && Array.isArray(lines) && lines.length > 0) {
    for (const l of lines) {
      if (!l.productId || typeof l.quantity !== "number" || l.quantity < 1) {
        return NextResponse.json(
          { error: "each line requires productId and quantity>=1" },
          { status: 400 }
        );
      }
    }
    normalizedLines = lines;
  } else if (productIds && Array.isArray(productIds) && productIds.length > 0) {
    normalizedLines = productIds.map((id) => ({ productId: id, quantity: 1 }));
  } else {
    return NextResponse.json(
      { error: "productIds[] or lines[] is required" },
      { status: 400 }
    );
  }

  // 全商品を解決+価格決定
  const resolvedLines = normalizedLines.map((l) => {
    const product = getProductById(l.productId);
    return product ? { product, quantity: l.quantity } : null;
  });
  const notFound = resolvedLines
    .map((rl, i) => (rl ? null : normalizedLines[i].productId))
    .filter((x): x is ProductId => x !== null);
  if (notFound.length > 0) {
    return NextResponse.json(
      { error: `Product not found: ${notFound.join(", ")}` },
      { status: 404 }
    );
  }
  // 卸/特価卸では当該tierに価格設定がある商品のみ販売可
  if (priceTier !== "retail") {
    const noTier = resolvedLines
      .filter((rl) => {
        if (!rl) return false;
        return getPriceForTier(rl.product, priceTier) === null;
      })
      .map((rl) => rl?.product.name);
    if (noTier.length > 0) {
      return NextResponse.json(
        { error: `Not available for ${priceTier}: ${noTier.join(", ")}` },
        { status: 400 }
      );
    }
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (request.headers.get("origin") ?? "http://localhost:3000");

  // Bank Transfer は customer ID が必須なので Stripe Customer を作成
  const stripeCustomer = await stripe.customers.create({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    preferred_locales: ["ja"],
    metadata: {
      postalCode: customer.postalCode,
      address: customer.address,
      machineMaker: customer.machineMaker,
      machineModel: customer.machineModel,
    },
  });

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
    line_items: resolvedLines.map((rl) => {
      const priceExTax =
        getPriceForTier(rl!.product, priceTier) ?? rl!.product.priceExTax;
      return {
        price_data: {
          currency: "jpy",
          product_data: {
            name: rl!.product.name,
            description: rl!.product.description,
          },
          unit_amount: calcTaxIncluded(priceExTax),
        },
        quantity: rl!.quantity,
        tax_rates: [JP_TAX_RATE_ID],
      };
    }),
    mode: "payment",
    success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/cancel`,
    locale: "ja",
    ...(requestInvoice && {
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: `E-FIX ご注文 (${resolvedLines.map((rl) => rl!.product.name).join(", ")})`,
          footer: INVOICE_FOOTER,
          custom_fields: INVOICE_CUSTOM_FIELDS,
          rendering_options: {
            amount_tax_display: "include_inclusive_tax",
          },
          metadata: {
            orderType: "main_product",
            customerName: customer.name,
            priceTier,
          },
        },
      },
    }),
    metadata: {
      productIds: resolvedLines
        .map((rl) =>
          rl!.quantity > 1
            ? `${rl!.product.id}×${rl!.quantity}`
            : rl!.product.id
        )
        .join(","),
      customerName: customer.name,
      customerPostalCode: customer.postalCode,
      customerAddress: customer.address,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      machineMaker: customer.machineMaker,
      machineModel: customer.machineModel,
      notes: customer.notes ?? "",
      requestInvoice: requestInvoice ? "true" : "false",
      priceTier,
    },
  });

  return NextResponse.json({ url: session.url });
}
