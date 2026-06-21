"""
efix-shop 管理画面 軸2 向け Sheets スキーマ追加スクリプト

追加対象:
  1. 協力業者     - フリーランス取付業者マスタ(Phase 1b 自動化に向けた骨組み)
  2. 取付予約     - 取付日程の状態管理(/admin/installations の真実のソース)
  3. 在庫マスタ   - 商品ごとの現在庫/販売上限(/admin/inventory の真実のソース)

冪等性: 既存シートと同名の場合はスキップ。誤上書き防止。
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, r'C:/Users/user/.claude/lib')
import warnings; warnings.filterwarnings('ignore')

from secrets_age import load_service_account
SA_PATH = load_service_account('efix-shop-service-account.json')

import gspread
gc = gspread.service_account(filename=SA_PATH)

SHEET_ID = '19AG4PTu8aAxxzhZ5UiK7TYSKFjGD02uU0VBnB3DdOdg'
sh = gc.open_by_key(SHEET_ID)

SPECS = [
    {
        "title": "協力業者",
        "headers": [
            "vendor_id", "業者名", "タイプ", "LINE_ID", "メール", "電話",
            "対応エリア", "対応機種", "稼働曜日", "単価", "評価",
            "直近受注日", "ステータス", "備考",
        ],
        "sample": [
            "V001", "サンプル農機サービス", "個人", "@sample",
            "sample@example.com", "090-0000-0000",
            "帯広,釧路,北見", "e-steer-20,e-steer-20-max", "月,火,水,木,金",
            "35000", "4", "", "active",
            "（サンプル行・Phase 1b 着手時に実データへ差し替え）",
        ],
    },
    {
        "title": "取付予約",
        "headers": [
            "order_id", "status", "提案日履歴", "確定日",
            "担当業者ID", "取付完了日", "返送伝票番号", "備考",
        ],
        "sample": [
            "SAMPLE-001", "requested", "", "", "", "", "",
            "（サンプル行・Webhook 改修後に自動 INSERT される）",
        ],
    },
    {
        "title": "在庫マスタ",
        "headers": [
            "product_id", "現在庫数", "販売上限", "最終調整日", "備考",
        ],
        "samples": [
            ["e-steer-20", "0", "0", "", "（サンプル・実数値は管理画面から調整）"],
            ["e-steer-20-max", "0", "0", "", "（サンプル・実数値は管理画面から調整）"],
        ],
    },
]

existing_titles = {ws.title for ws in sh.worksheets()}
print(f"既存シート: {sorted(existing_titles)}")
print()

for spec in SPECS:
    title = spec["title"]
    if title in existing_titles:
        print(f"[SKIP] '{title}' は既存。手動確認してから再実行されたし。")
        continue

    cols = max(len(spec["headers"]), 5)
    ws = sh.add_worksheet(title=title, rows=100, cols=cols)
    print(f"[ADD ] '{title}' を追加 (cols={cols})")

    ws.update(range_name="A1", values=[spec["headers"]])
    print(f"       ヘッダー書込: {spec['headers']}")

    if "samples" in spec:
        for row in spec["samples"]:
            ws.append_row(row)
            print(f"       サンプル行追加: {row[0]}")
    elif "sample" in spec:
        ws.append_row(spec["sample"])
        print(f"       サンプル行追加: {spec['sample'][0]}")

print()
print("=== 完了 ===")
for ws in sh.worksheets():
    print(f"  - {ws.title} (rows={ws.row_count}, cols={ws.col_count})")
