import { writeFileSync } from "fs";
import { generateInvoicePdf, splitTax } from "../src/lib/receipt-pdf";

async function main() {
  const total = 1258400;
  const { taxExcluded, tax } = splitTax(total);
  console.log(`splitTax(${total}) => 税抜 ${taxExcluded} + 税 ${tax} = ${taxExcluded + tax}`);
  if (taxExcluded + tax !== total) throw new Error("splitTax mismatch");

  const bytes = await generateInvoicePdf({
    documentNumber: "W-70616",
    addressee: "テスト農場株式会社",
    lineItems: [
      { description: "e-steer 20（本体）", quantity: 1, unitAmount: 1100000, amountTotal: 1100000 },
      { description: "E20用 NMEAタブレットケーブル", quantity: 2, unitAmount: 24200, amountTotal: 48400 },
      { description: "無線リモコン（Engage/Disengage）", quantity: 1, unitAmount: 55000, amountTotal: 55000 },
      { description: "取付サービス", quantity: 1, unitAmount: 55000, amountTotal: 55000 },
    ],
    amountTotal: total,
    transactionDate: "2026年7月13日",
    paymentMethodLabel: "クレジットカード",
    issuedDate: "2026年7月13日",
  });
  const out = process.argv[2] ?? "smoke-invoice.pdf";
  writeFileSync(out, bytes);
  console.log(`OK: ${out} (${bytes.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
