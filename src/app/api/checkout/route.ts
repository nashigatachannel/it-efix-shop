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
  applyWebCatalogItemToProduct,
  fetchWebCatalogItems,
  getWebCatalogAvailableQuantity,
  isWebCatalogItemSellable,
} from "@/lib/web-catalog";
import {
  getInstallationFeeIncTax,
  hasInstallationService,
} from "@/lib/installation";
import {
  JP_TAX_RATE_ID,
  INVOICE_FOOTER,
  INVOICE_CUSTOM_FIELDS,
} from "@/lib/invoice-config";
import { getCurrentPartner } from "@/lib/partner-auth";

interface CustomerInfo {
  name: string;
  postalCode: string;
  // V3: 都道府県と市町村以降を分離。後方互換のため address も受け付ける。
  prefecture?: string;
  addressDetail?: string;
  address?: string;
  deliveryAddressDifferent?: boolean;
  deliveryPostalCode?: string;
  deliveryPrefecture?: string;
  deliveryAddressDetail?: string;
  phone: string;
  email: string;
  machineType?: string;
  machineTypeOther?: string;
  machineMaker: string;
  machineMakerOther?: string;
  machineModel?: string;
  notes?: string;
}

interface InstallationOptions {
  selfInstall: boolean;
  desiredDate1?: string;
  desiredDate2?: string;
  desiredDate3?: string;
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
  installation?: InstallationOptions;
  /** "retail" | "wholesale" | "distributor"。未指定はretail */
  priceTier?: PriceTier;
}

// V3: 注文可能な都道府県。北海道のみ。将来エリア拡大時はここに追加する。
const AVAILABLE_PREFECTURES = new Set<string>(["北海道"]);
const OTHER_OPTION = "その他";

function buildAddressString(customer: CustomerInfo): string {
  if (customer.prefecture && customer.addressDetail) {
    return `${customer.prefecture} ${customer.addressDetail}`.trim();
  }
  return customer.address?.trim() ?? "";
}

function buildDeliveryAddressString(customer: CustomerInfo): string {
  if (!customer.deliveryAddressDifferent) return buildAddressString(customer);
  return `${customer.deliveryPrefecture ?? ""} ${
    customer.deliveryAddressDetail ?? ""
  }`.trim();
}

function resolveOtherChoice(value?: string, otherValue?: string): string {
  const trimmed = (value ?? "").trim();
  if (trimmed !== OTHER_OPTION) return trimmed;
  const other = (otherValue ?? "").trim();
  return other ? `${OTHER_OPTION}（${other}）` : OTHER_OPTION;
}

function appendNote(baseNote: string | undefined, extraLines: string[]): string {
  return [baseNote ?? "", ...extraLines]
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: CheckoutRequestBody;

  try {
    body = (await request.json()) as CheckoutRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { productIds, lines, customer, installation } = body;
  const priceTier: PriceTier = body.priceTier ?? "retail";

  // 卸/特価卸のときはセッションcookieからpartnerIdを取得
  let partnerId = "";
  if (priceTier !== "retail") {
    const session = await getCurrentPartner();
    if (!session) {
      return NextResponse.json(
        { error: "卸取引のログインセッションが切れています" },
        { status: 401 }
      );
    }
    if (session.tier !== priceTier) {
      return NextResponse.json(
        { error: "ログイン中の階層と注文階層が一致しません" },
        { status: 403 }
      );
    }
    partnerId = session.partnerId;
  }

  if (!customer || !customer.name || !customer.email) {
    return NextResponse.json(
      { error: "customer.name and customer.email are required" },
      { status: 400 }
    );
  }
  const customerAddressString = buildAddressString(customer);
  const deliveryAddressString = buildDeliveryAddressString(customer);
  const machineTypeDisplay = resolveOtherChoice(
    customer.machineType,
    customer.machineTypeOther,
  );
  const machineMakerDisplay = resolveOtherChoice(
    customer.machineMaker,
    customer.machineMakerOther,
  );
  const machineModel = (customer.machineModel ?? "").trim();

  // V3: 一般客(retail)は都道府県を必須かつ販売可能エリアのみ
  if (priceTier === "retail") {
    if (
      !customer.phone ||
      !customer.postalCode ||
      !customer.prefecture ||
      !customer.addressDetail ||
      !customer.machineType ||
      !customer.machineMaker
    ) {
      return NextResponse.json(
        {
          error:
            "氏名、郵便番号、都道府県、住所、電話番号、メールアドレス、農機種別、農機メーカーは必須です。",
        },
        { status: 400 },
      );
    }
    if (
      customer.machineType === OTHER_OPTION &&
      !customer.machineTypeOther?.trim()
    ) {
      return NextResponse.json(
        { error: "その他の農機種別を入力してください。" },
        { status: 400 },
      );
    }
    if (
      customer.machineMaker === OTHER_OPTION &&
      !customer.machineMakerOther?.trim()
    ) {
      return NextResponse.json(
        { error: "その他の農機メーカー名を入力してください。" },
        { status: 400 },
      );
    }
    if (customer.prefecture) {
      if (!AVAILABLE_PREFECTURES.has(customer.prefecture)) {
        return NextResponse.json(
          {
            error:
              "現在は北海道のみ販売しております。本州・四国・九州への展開は順次拡大予定です。",
          },
          { status: 400 }
        );
      }
    }
    if (!customerAddressString) {
      return NextResponse.json(
        { error: "customer.prefecture and customer.addressDetail are required" },
        { status: 400 }
      );
    }
    if (customer.deliveryAddressDifferent) {
      if (
        !customer.deliveryPostalCode ||
        !customer.deliveryPrefecture ||
        !customer.deliveryAddressDetail
      ) {
        return NextResponse.json(
          { error: "納品先住所を入力してください。" },
          { status: 400 },
        );
      }
      if (!AVAILABLE_PREFECTURES.has(customer.deliveryPrefecture)) {
        return NextResponse.json(
          {
            error:
              "現在は北海道のみ販売しております。本州・四国・九州への展開は順次拡大予定です。",
          },
          { status: 400 },
        );
      }
    }
  }

  // 入力をlines形式に正規化 (productIds は数量1のlines扱い)
  let normalizedLines: OrderLine[];
  if (lines && Array.isArray(lines) && lines.length > 0) {
    normalizedLines = [];
    for (const l of lines) {
      const quantity = Math.floor(Number(l.quantity));
      if (
        !l.productId ||
        !Number.isFinite(quantity) ||
        quantity < 1 ||
        quantity > 99
      ) {
        return NextResponse.json(
          { error: "each line requires productId and integer quantity 1..99" },
          { status: 400 }
        );
      }
      normalizedLines.push({ productId: l.productId, quantity });
    }
  } else if (productIds && Array.isArray(productIds) && productIds.length > 0) {
    normalizedLines = productIds.map((id) => ({ productId: id, quantity: 1 }));
  } else {
    return NextResponse.json(
      { error: "productIds[] or lines[] is required" },
      { status: 400 }
    );
  }

  const retailCatalog =
    priceTier === "retail" ? await fetchWebCatalogItems() : null;
  const retailCatalogById = new Map(
    (retailCatalog?.items ?? []).map((item) => [item.productId, item]),
  );

  // 全商品を解決+価格決定
  const resolvedLines = normalizedLines.map((l) => {
    const product = getProductById(l.productId);
    if (!product) return null;
    if (priceTier !== "retail") return { product, quantity: l.quantity };

    const catalogItem = retailCatalogById.get(l.productId);
    if (!catalogItem || !isWebCatalogItemSellable(catalogItem)) {
      return { product, quantity: l.quantity, unavailable: true };
    }
    return {
      product: applyWebCatalogItemToProduct(product, catalogItem),
      quantity: l.quantity,
      catalogItem,
    };
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
  if (priceTier === "retail") {
    const unavailable = resolvedLines
      .filter((rl) => rl && "unavailable" in rl && rl.unavailable)
      .map((rl) => rl?.product.name);
    if (unavailable.length > 0) {
      return NextResponse.json(
        { error: `現在販売停止中です: ${unavailable.join(", ")}` },
        { status: 409 },
      );
    }

    const overLimit = resolvedLines
      .map((rl) => {
        if (!rl || !("catalogItem" in rl) || !rl.catalogItem) return null;
        const available = getWebCatalogAvailableQuantity(rl.catalogItem);
        if (available === null || rl.quantity <= available) return null;
        return `${rl.product.name} は最大 ${available} 点までです`;
      })
      .filter((message): message is string => message !== null);
    if (overLimit.length > 0) {
      return NextResponse.json({ error: overLimit.join(" / ") }, { status: 409 });
    }
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

  // V3: 取付サービスのオプトアウト(retail tier 限定)
  const selfInstall =
    priceTier === "retail" && installation?.selfInstall === true;
  const needsDesiredDates =
    priceTier === "retail" &&
    !selfInstall &&
    resolvedLines.some((rl) => rl && hasInstallationService(rl.product.id));
  if (
    needsDesiredDates &&
    (!installation?.desiredDate1?.trim() || !installation?.desiredDate2?.trim())
  ) {
    return NextResponse.json(
      { error: "取付希望日は第1希望と第2希望が必須です。" },
      { status: 400 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (request.headers.get("origin") ?? "http://localhost:3000");
  const deliveryPostalCode = customer.deliveryAddressDifferent
    ? customer.deliveryPostalCode ?? ""
    : customer.postalCode;
  const notesWithContext = appendNote(customer.notes, [
    machineTypeDisplay ? `農機種別: ${machineTypeDisplay}` : "",
    customer.deliveryAddressDifferent
      ? `納品先: ${
          deliveryPostalCode ? `〒${deliveryPostalCode} ` : ""
        }${deliveryAddressString}`
      : "",
  ]);

  // Bank Transfer は customer ID が必須なので Stripe Customer を作成
  const stripeCustomer = await stripe.customers.create({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    preferred_locales: ["ja"],
    metadata: {
      postalCode: customer.postalCode,
      address: customerAddressString,
      deliveryPostalCode,
      deliveryAddress: deliveryAddressString,
      deliveryAddressDifferent: customer.deliveryAddressDifferent ? "true" : "false",
      machineType: machineTypeDisplay,
      machineMaker: machineMakerDisplay,
      machineModel,
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
      const baseUnitIncTax = calcTaxIncluded(priceExTax);
      const installationDiscount = selfInstall
        ? getInstallationFeeIncTax(rl!.product.id)
        : 0;
      const adjustedUnitIncTax = Math.max(0, baseUnitIncTax - installationDiscount);
      const displayName =
        installationDiscount > 0
          ? `${rl!.product.name}（取付サービスなし）`
          : rl!.product.name;
      return {
        price_data: {
          currency: "jpy",
          product_data: {
            name: displayName,
            description: rl!.product.description,
          },
          unit_amount: adjustedUnitIncTax,
        },
        quantity: rl!.quantity,
        tax_rates: [JP_TAX_RATE_ID],
      };
    }),
    mode: "payment",
    success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:
      priceTier === "retail" ? `${baseUrl}/cancel` : `${baseUrl}/partner`,
    locale: "ja",
    invoice_creation: {
      enabled: true,
      invoice_data: {
        description: `E-FIX ご注文 (${resolvedLines.map((rl) => rl!.product.name).join(", ")})${selfInstall ? "（取付サービスなし）" : ""}`,
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
      customerPrefecture: customer.prefecture ?? "",
      customerAddress: customerAddressString,
      deliveryAddressDifferent: customer.deliveryAddressDifferent ? "true" : "false",
      deliveryPostalCode,
      deliveryPrefecture: customer.deliveryAddressDifferent
        ? customer.deliveryPrefecture ?? ""
        : customer.prefecture ?? "",
      deliveryAddress: deliveryAddressString,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      machineType: machineTypeDisplay,
      machineMaker: machineMakerDisplay,
      machineModel,
      notes: notesWithContext,
      requestInvoice: "true",
      priceTier,
      partnerId,
      selfInstall: selfInstall ? "true" : "false",
      desiredDate1: installation?.desiredDate1 ?? "",
      desiredDate2: installation?.desiredDate2 ?? "",
      desiredDate3: installation?.desiredDate3 ?? "",
    },
  });

  return NextResponse.json({ url: session.url });
}
