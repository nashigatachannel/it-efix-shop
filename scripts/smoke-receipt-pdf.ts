import { writeFileSync } from "fs";
import { generateReceiptPdf, splitTax } from "../src/lib/receipt-pdf";

async function main() {
  const total = 398000;
  const { taxExcluded, tax } = splitTax(total);
  console.log(`splitTax(${total}) => 税抜 ${taxExcluded} + 税 ${tax} = ${taxExcluded + tax}`);
  if (taxExcluded + tax !== total) throw new Error("splitTax mismatch");

  const bytes = await generateReceiptPdf({
    receiptNumber: "R-123",
    addressee: "テスト農場株式会社",
    description: "eSteer10 Package 代金",
    amountTotal: total,
    transactionDate: "2026年7月13日",
    paymentMethodLabel: "銀行振込",
    issuedDate: "2026年7月13日",
  });
  const out = process.argv[2] ?? "smoke-receipt.pdf";
  writeFileSync(out, bytes);
  console.log(`OK: ${out} (${bytes.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
