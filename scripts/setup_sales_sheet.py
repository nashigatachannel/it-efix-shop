"""新規Sheets「EFIX販売管理」をWebhook接続用に構築する。

- 既存「シート1」を「Web注文」にrename
- 列幅をヘッダー数に拡張
- 1行目にヘッダー（17列）を書き込み、太字＋固定行
"""

import sys
sys.stdout.reconfigure(encoding="utf-8")

from google.oauth2 import service_account
from googleapiclient.discovery import build

SA_PATH = r"C:\Users\tunag\accounting\credentials\efix-shop-service-account.json"
SHEET_ID = "1QNUcpyDnXc12GU8Uvxm_tMX1ZGG09Sm4azIKFAPrjTY"

WEB_HEADERS = [
    "通し番号",
    "サブID",
    "注文日時",
    "Stripe Session ID",
    "決済ステータス",
    "決済方法",
    "モデル",
    "金額(税込)",
    "顧客名",
    "メール",
    "電話",
    "郵便番号",
    "住所",
    "メーカー",
    "機種型式",
    "備考",
    "適格請求書希望",
    "PartnerID",
    "支払期日",
]


def main() -> None:
    creds = service_account.Credentials.from_service_account_file(
        SA_PATH, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    sheets = build("sheets", "v4", credentials=creds, cache_discovery=False)

    meta = sheets.spreadsheets().get(
        spreadsheetId=SHEET_ID,
        fields="sheets(properties(sheetId,title,gridProperties))",
    ).execute()

    target = None
    for s in meta["sheets"]:
        p = s["properties"]
        if p["title"] in ("Web注文", "シート1", "Sheet1"):
            target = p
            break
    if target is None:
        raise RuntimeError("対象シートが見つからない")

    sheet_id = target["sheetId"]
    requests = []

    # 1) rename to "Web注文" if needed
    if target["title"] != "Web注文":
        requests.append({
            "updateSheetProperties": {
                "properties": {
                    "sheetId": sheet_id,
                    "title": "Web注文",
                    "gridProperties": {
                        "rowCount": 1000,
                        "columnCount": len(WEB_HEADERS),
                        "frozenRowCount": 1,
                    },
                },
                "fields": "title,gridProperties.rowCount,"
                "gridProperties.columnCount,gridProperties.frozenRowCount",
            }
        })
    else:
        # ensure size + frozen row even if already named
        requests.append({
            "updateSheetProperties": {
                "properties": {
                    "sheetId": sheet_id,
                    "gridProperties": {
                        "rowCount": 1000,
                        "columnCount": len(WEB_HEADERS),
                        "frozenRowCount": 1,
                    },
                },
                "fields": "gridProperties.rowCount,"
                "gridProperties.columnCount,gridProperties.frozenRowCount",
            }
        })

    # 2) header row formatting (bold + background)
    requests.append({
        "repeatCell": {
            "range": {
                "sheetId": sheet_id,
                "startRowIndex": 0,
                "endRowIndex": 1,
                "startColumnIndex": 0,
                "endColumnIndex": len(WEB_HEADERS),
            },
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": {
                        "red": 0.15, "green": 0.18, "blue": 0.23,
                    },
                    "textFormat": {
                        "foregroundColor": {
                            "red": 1.0, "green": 1.0, "blue": 1.0,
                        },
                        "bold": True,
                    },
                    "horizontalAlignment": "CENTER",
                }
            },
            "fields": "userEnteredFormat("
                      "backgroundColor,textFormat,horizontalAlignment)",
        }
    })

    sheets.spreadsheets().batchUpdate(
        spreadsheetId=SHEET_ID,
        body={"requests": requests},
    ).execute()
    print("[OK] sheet renamed/sized + header formatted")

    # 3) write header values (USER_ENTERED so dates etc parse later)
    sheets.spreadsheets().values().update(
        spreadsheetId=SHEET_ID,
        range="Web注文!A1",
        valueInputOption="RAW",
        body={"values": [WEB_HEADERS]},
    ).execute()
    print("[OK] headers written:", len(WEB_HEADERS), "cols")

    # 4) confirm
    after = sheets.spreadsheets().get(
        spreadsheetId=SHEET_ID,
        fields="sheets(properties(title,gridProperties))",
    ).execute()
    print("---after---")
    for s in after["sheets"]:
        p = s["properties"]
        print(p["title"], p["gridProperties"])


if __name__ == "__main__":
    main()
