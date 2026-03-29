import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  getProductById,
  calcTaxIncluded,
  type ProductId,
} from "@/lib/products";

interface CheckoutRequestBody {
  productId: ProductId;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: CheckoutRequestBody;

  try {
    body = (await request.json()) as CheckoutRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { productId } = body;

  if (!productId) {
    return NextResponse.json(
      { error: "productId is required" },
      { status: 400 }
    );
  }

  const product = getProductById(productId);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (request.headers.get("origin") ?? "http://localhost:3000");

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "jpy",
          product_data: {
            name: product.name,
            description: product.description,
          },
          unit_amount: calcTaxIncluded(product.priceExTax),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    shipping_address_collection: {
      allowed_countries: ["JP"],
    },
    phone_number_collection: {
      enabled: true,
    },
    success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/cancel`,
    locale: "ja",
    metadata: {
      productId: product.id,
    },
  });

  return NextResponse.json({ url: session.url });
}
