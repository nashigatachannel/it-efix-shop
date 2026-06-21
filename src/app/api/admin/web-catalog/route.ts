import { NextRequest, NextResponse } from "next/server";
import {
  fetchWebCatalogItems,
  saveWebCatalogItems,
  type WebCatalogItem,
} from "@/lib/web-catalog";

export const dynamic = "force-dynamic";

interface SaveRequestBody {
  items?: WebCatalogItem[];
}

export async function GET(): Promise<NextResponse> {
  const catalog = await fetchWebCatalogItems({ seedIfEmpty: true });
  return NextResponse.json(catalog);
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  let body: SaveRequestBody;
  try {
    body = (await request.json()) as SaveRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json(
      { error: "items[] が指定されていません" },
      { status: 400 },
    );
  }

  try {
    const items = await saveWebCatalogItems(body.items);
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Web販売商品マスタの保存に失敗しました",
      },
      { status: 500 },
    );
  }
}
