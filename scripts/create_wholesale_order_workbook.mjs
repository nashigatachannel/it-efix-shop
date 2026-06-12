import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const [, , catalogPath, outputPath] = process.argv;

if (!catalogPath || !outputPath) {
  console.error("usage: node create_wholesale_order_workbook.mjs <catalog.json> <output.xlsx>");
  process.exit(2);
}

const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
const allItems = [...catalog.mainItems, ...catalog.optionItems];

const ORDER_HEADERS = [
  "受付番号",
  "受付日時",
  "ステータス",
  "会社名",
  "担当者名",
  "メール",
  "電話番号",
  "郵便番号",
  "納品先住所",
  "商品明細",
  "小計(税抜)",
  "消費税",
  "合計(税込)",
  "希望納期",
  "支払条件",
  "備考",
  "参照元",
];

const DETAIL_HEADERS = [
  "受付番号",
  "行No",
  "区分",
  "対応機種",
  "セクション",
  "カテゴリ",
  "品番",
  "商品名",
  "数量",
  "単価(税抜)",
  "小計(税抜)",
];

const MASTER_HEADERS = [
  "商品ID",
  "区分",
  "略称",
  "対応機種",
  "セクション",
  "カテゴリ",
  "品番",
  "商品名",
  "必要数",
  "通常卸(税抜)",
  "通常卸(税込)",
  "希望小売(税抜)",
  "希望小売(税込)",
  "画像パス",
];

function applyHeaderStyle(sheet, range) {
  sheet.getRange(range).format = {
    fill: "#166534",
    font: { bold: true, color: "#FFFFFF" },
  };
}

function setColumnWidths(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, 1, 1).format.columnWidthPx = width;
  });
}

function buildBlankRows(cols, rows) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
}

const workbook = Workbook.create();

const summary = workbook.worksheets.add("集計");
summary.showGridLines = false;
summary.getRange("A1:F1").values = [["E-FIX 卸受注管理票"]];
summary.mergeCells("A1:F1");
summary.getRange("A1:F1").format = {
  fill: "#14532D",
  font: { bold: true, color: "#FFFFFF", size: 18 },
};
summary.getRange("A3:B7").values = [
  ["受付件数", ""],
  ["受付中", ""],
  ["手配中", ""],
  ["完了", ""],
  ["合計(税込)", ""],
];
summary.getRange("B3:B7").formulas = [
  ['=COUNTIF(\'卸受注管理\'!A2:A1001,"EFW-*")'],
  ['=COUNTIF(\'卸受注管理\'!C2:C1001,"受付")'],
  ['=COUNTIF(\'卸受注管理\'!C2:C1001,"手配中")'],
  ['=COUNTIF(\'卸受注管理\'!C2:C1001,"完了")'],
  ["=SUM('卸受注管理'!M2:M1001)"],
];
summary.getRange("A3:A7").format = { fill: "#DCFCE7", font: { bold: true } };
summary.getRange("B3:B7").format.numberFormat = '#,##0';
summary.getRange("B7").format.numberFormat = '"¥"#,##0';
setColumnWidths(summary, [170, 150, 40, 40, 40, 40]);

const orders = workbook.worksheets.add("卸受注管理");
orders.showGridLines = false;
orders.getRangeByIndexes(0, 0, 1, ORDER_HEADERS.length).values = [ORDER_HEADERS];
orders.getRangeByIndexes(1, 0, 1000, ORDER_HEADERS.length).values = buildBlankRows(
  ORDER_HEADERS.length,
  1000,
);
applyHeaderStyle(orders, "A1:Q1");
orders.freezePanes.freezeRows(1);
orders.tables.add("A1:Q1001", true, "WholesaleOrders");
orders.getRange("K2:M1001").format.numberFormat = '"¥"#,##0';
orders.getRange("B2:B1001").format.numberFormat = "yyyy/mm/dd hh:mm";
setColumnWidths(orders, [
  130, 150, 90, 150, 110, 190, 120, 100, 240, 300, 110, 90, 120, 110, 150, 260, 110,
]);

const details = workbook.worksheets.add("卸受注明細");
details.showGridLines = false;
details.getRangeByIndexes(0, 0, 1, DETAIL_HEADERS.length).values = [DETAIL_HEADERS];
details.getRangeByIndexes(1, 0, 2000, DETAIL_HEADERS.length).values = buildBlankRows(
  DETAIL_HEADERS.length,
  2000,
);
applyHeaderStyle(details, "A1:K1");
details.freezePanes.freezeRows(1);
details.tables.add("A1:K2001", true, "WholesaleOrderDetails");
details.getRange("J2:K2001").format.numberFormat = '"¥"#,##0';
setColumnWidths(details, [130, 60, 120, 120, 130, 120, 170, 260, 70, 110, 120]);

const master = workbook.worksheets.add("商品マスタ");
master.showGridLines = false;
const masterRows = allItems.map((item) => [
  item.id,
  item.kind === "set" ? "本体セット" : "部品・オプション",
  item.shortName,
  item.model,
  item.section,
  item.category,
  item.partNumber,
  item.name,
  item.requiredQty,
  item.wholesalePriceExTax,
  item.wholesalePriceIncTax,
  item.retailPriceExTax ?? "",
  item.retailPriceIncTax ?? "",
  item.image,
]);
master.getRangeByIndexes(0, 0, 1, MASTER_HEADERS.length).values = [MASTER_HEADERS];
master.getRangeByIndexes(1, 0, masterRows.length, MASTER_HEADERS.length).values =
  masterRows;
applyHeaderStyle(master, "A1:N1");
master.freezePanes.freezeRows(1);
master.tables.add(`A1:N${masterRows.length + 1}`, true, "WholesaleProductMaster");
master.getRange(`J2:M${masterRows.length + 1}`).format.numberFormat = '"¥"#,##0';
setColumnWidths(master, [210, 120, 160, 120, 130, 120, 180, 280, 70, 120, 120, 120, 120, 220]);

const usage = workbook.worksheets.add("使い方");
usage.showGridLines = false;
usage.getRange("A1:D1").values = [["E-FIX 卸受注管理票 使い方"]];
usage.mergeCells("A1:D1");
usage.getRange("A1:D1").format = {
  fill: "#0F766E",
  font: { bold: true, color: "#FFFFFF", size: 16 },
};
usage.getRange("A3:D10").values = [
  ["1", "卸注文サイト", "/wholesale から注文を送信", ""],
  ["2", "受付", "卸受注管理シートに受付行が追加されます", ""],
  ["3", "明細", "卸受注明細シートに商品行が追加されます", ""],
  ["4", "商品マスタ", "販売価格一覧（卸）20260518.xlsxから生成", ""],
  ["5", "Google Sheets連携", "GOOGLE_WHOLESALE_SPREADSHEET_ID をVercel環境変数へ設定", ""],
  ["6", "シート名", "卸受注管理 / 卸受注明細", ""],
  ["7", "ステータス例", "受付、手配中、出荷済、完了、キャンセル", ""],
  ["8", "価格", "通常卸(税抜)を元にサイト・管理票で税込計算", ""],
];
usage.getRange("A3:A10").format = { fill: "#DCFCE7", font: { bold: true } };
setColumnWidths(usage, [60, 170, 500, 80]);

for (const sheetName of ["集計", "卸受注管理", "卸受注明細", "商品マスタ", "使い方"]) {
  const sheet = workbook.worksheets.getItem(sheetName);
  sheet.getUsedRange(true).format.wrapText = true;
  sheet.getUsedRange(true).format.autofitRows();
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const preview = await workbook.render({
  sheetName: "集計",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(
  outputPath.replace(/\.xlsx$/i, "_preview.png"),
  new Uint8Array(await preview.arrayBuffer()),
);

console.log(outputPath);
