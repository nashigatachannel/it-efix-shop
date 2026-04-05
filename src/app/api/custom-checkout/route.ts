import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

interface CustomCheckoutRequest {
  amount: number;
  description: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
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

  const { amount, description, customer } = body;

  // バリデーション
  if (!amount || typeof amount !== "number" || amount < 1) {
    return NextResponse.json(
      { error: "amount must be a positive integer (JPY)" },
      { status: 400 }
    );
  }

  if (amount > 10_000_000) {
    return NextResponse.json(
      { error: "amount exceeds maximum (10,000,000 JPY)" },
      { status: 400 }
    );
  }

  if (!Number.isInteger(amount)) {
    return NextResponse.json(
      { error: "amount must be an integer (JPY has no decimals)" },
      { status: 400 }
    );
  }

  if (!description || description.trim().length === 0) {
    return NextResponse.json(
      { error: "description is required" },
      { status: 400 }
    );
  }

  if (!customer?.name || !customer?.email || !customer?.phone) {
    return NextResponse.json(
      { error: "customer name, email, and phone are required" },
      { status: 400 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (request.headers.get("origin") ?? "http://localhost:3000");

  // Bank Transfer は customer ID が必須
  const stripeCustomer = await stripe.customers.create({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
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
    line_items: [
      {
        price_data: {
          currency: "jpy",
          product_data: {
            name: description.trim(),
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/cancel`,
    locale: "ja",
    metadata: {
      type: "custom_payment",
      description: description.trim(),
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
    },
  });

  return NextResponse.json({ url: session.url });
}
