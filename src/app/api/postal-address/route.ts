import { NextRequest, NextResponse } from "next/server";

interface ZipCloudResult {
  address1?: string;
  address2?: string;
  address3?: string;
  zipcode?: string;
}

interface ZipCloudResponse {
  status?: number;
  message?: string | null;
  results?: ZipCloudResult[] | null;
}

function normalizePostalCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 7);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const zipcode = normalizePostalCode(searchParams.get("zipcode") ?? "");

  if (zipcode.length !== 7) {
    return NextResponse.json(
      { error: "郵便番号は7桁で入力してください。" },
      { status: 400 },
    );
  }

  const response = await fetch(
    `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipcode}`,
    {
      next: { revalidate: 60 * 60 * 24 * 30 },
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "住所検索に失敗しました。" },
      { status: 502 },
    );
  }

  const data = (await response.json()) as ZipCloudResponse;
  const result = data.results?.[0];

  if (data.status !== 200 || !result) {
    return NextResponse.json(
      { error: data.message ?? "住所が見つかりませんでした。" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    postalCode: result.zipcode ?? zipcode,
    prefecture: result.address1 ?? "",
    addressDetail: [result.address2, result.address3].filter(Boolean).join(""),
  });
}
