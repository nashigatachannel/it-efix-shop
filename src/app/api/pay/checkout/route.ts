import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { verifyPayToken } from "@/lib/pay-token";
import { findInvoiceRow } from "@/lib/sales-sheet";

export const dynamic = "force-dynamic";

interface CheckoutRequestBody {
  token?: string;
}

const INVALID_TOKEN_MESSAGE =
  "このリンクは無効です。お手数ですがEFIX担当までご連絡ください";
const EXPIRED_TOKEN_MESSAGE =
  "このリンクの有効期限が切れています。お手数ですがEFIX担当までご連絡ください";
const NOT_FOUND_MESSAGE =
  "対応する請求書が見つかりませんでした。お手数ですがEFIX担当までご連絡ください";
const LOOKUP_FAILED_MESSAGE =
  "請求書情報の取得に失敗しました。時間をおいて再度お試しください";
const ALREADY_PAID_MESSAGE = "この請求書はお支払い済みです";
const AMOUNT_INVALID_MESSAGE =
  "金額の取得に失敗しました。お手数ですがEFIX担当までご連絡ください";
const CHECKOUT_CREATE_FAILED_MESSAGE =
  "決済ページの作成に失敗しました。時間をおいて再度お試しください";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: CheckoutRequestBody;
  try {
    body = (await request.json()) as CheckoutRequestBody;
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const token = body.token;
  if (!token || typeof token !== "string") {
    return NextResponse.json(
      { error: "支払いリンクが指定されていません" },
      { status: 400 },
    );
  }

  const verified = verifyPayToken(token);
  if (!verified.ok) {
    const message =
      verified.error === "expired" ? EXPIRED_TOKEN_MESSAGE : INVALID_TOKEN_MESSAGE;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let invoice;
  try {
    invoice = await findInvoiceRow(verified.inv);
  } catch (err) {
    console.error("Failed to look up invoice row before checkout:", err);
    return NextResponse.json({ error: LOOKUP_FAILED_MESSAGE }, { status: 500 });
  }

  if (!invoice) {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
  }

  if (invoice.paidDate) {
    return NextResponse.json({ error: ALREADY_PAID_MESSAGE }, { status: 409 });
  }

  if (!Number.isInteger(invoice.amountJpy) || invoice.amountJpy < 1) {
    return NextResponse.json({ error: AMOUNT_INVALID_MESSAGE }, { status: 500 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (request.headers.get("origin") ?? "http://localhost:3000");

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: {
              name: `請求書 ${invoice.invDisplay} お支払い（${invoice.customerName}様）`,
            },
            unit_amount: invoice.amountJpy,
          },
          quantity: 1,
        },
      ],
      metadata: {
        pay_type: "invoice",
        inv_number: invoice.invDisplay,
        serial: invoice.serial,
        customer_name: invoice.customerName,
      },
      success_url: `${baseUrl}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pay?t=${encodeURIComponent(token)}`,
      locale: "ja",
    });

    if (!session.url) {
      return NextResponse.json(
        { error: CHECKOUT_CREATE_FAILED_MESSAGE },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Failed to create invoice pay checkout session:", err);
    return NextResponse.json(
      { error: CHECKOUT_CREATE_FAILED_MESSAGE },
      { status: 500 },
    );
  }
}
