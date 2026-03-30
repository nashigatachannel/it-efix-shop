import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  getProductById,
  calcTaxIncluded,
  type ProductId,
} from "@/lib/products";

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

interface CheckoutRequestBody {
  productIds: ProductId[];
  customer: CustomerInfo;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: CheckoutRequestBody;

  try {
    body = (await request.json()) as CheckoutRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { productIds, customer } = body;

  // バリデーション
  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return NextResponse.json(
      { error: "productIds is required and must be a non-empty array" },
      { status: 400 }
    );
  }

  if (!customer || !customer.name || !customer.email) {
    return NextResponse.json(
      { error: "customer.name and customer.email are required" },
      { status: 400 }
    );
  }

  // 全商品を解決
  const products = productIds.map((id) => getProductById(id));
  const notFound = productIds.filter((_, i) => !products[i]);
  if (notFound.length > 0) {
    return NextResponse.json(
      { error: `Product not found: ${notFound.join(", ")}` },
      { status: 404 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (request.headers.get("origin") ?? "http://localhost:3000");

  // Bank Transfer は customer ID が必須なので Stripe Customer を作成
  const stripeCustomer = await stripe.customers.create({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
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
    line_items: products.map((product) => ({
      price_data: {
        currency: "jpy",
        product_data: {
          name: product!.name,
          description: product!.description,
        },
        unit_amount: calcTaxIncluded(product!.priceExTax),
      },
      quantity: 1,
    })),
    mode: "payment",
    success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/cancel`,
    locale: "ja",
    metadata: {
      productIds: productIds.join(","),
      customerName: customer.name,
      customerPostalCode: customer.postalCode,
      customerAddress: customer.address,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      machineMaker: customer.machineMaker,
      machineModel: customer.machineModel,
      notes: customer.notes ?? "",
    },
  });

  return NextResponse.json({ url: session.url });
}
