"""新Sheets「EFIX販売管理」に「卸先マスタ」タブを追加してテスト企業を投入する。

列:
  A 企業ID
  B 企業名
  C 担当者名
  D Email (ログインID)
  E Password (平文、社内Sheetsのみで管理)
  F 階層 (wholesale / distributor)
  G 電話番号
  H 郵便番号
  I 住所
  J 有効 (TRUE / FALSE)
  K 備考
"""

import sys
sys.stdout.reconfigure(encoding="utf-8")

from google.oauth2 import service_account
from googleapiclient.discovery import build

SA_PATH = r"C:\Users\tunag\accounting\credentials\efix-shop-service-account.json"
SHEET_ID = "1QNUcpyDnXc12GU8Uvxm_tMX1ZGG09Sm4azIKFAPrjTY"
TAB = "卸先マスタ"

HEADERS = [
    "企業ID",
    "企業名",
    "担当者名",
    "Email",
    "Password",
    "階層",
    "電話",
    "郵便番号",
    "住所",
    "有効",
    "備考",
]

TEST_PARTNERS = [
    [
        "WS-001",
        "（株）奥原商会",
        "（テスト担当）",
        "okuhara@partner-test.efix.local",
        "Okuhara2026!",
        "wholesale",
        "",
        "",
        "",
        "TRUE",
        "通常卸テスト用ダミー",
    ],
    [
        "DS-001",
        "（株）大井アグリサポート",
        "（テスト担当）",
        "oi@partner-test.efix.local",
        "OiAgri2026!",
        "distributor",
        "",
        "",
        "",
        "TRUE",
        "特価卸テスト用ダミー",
    ],
    [
        "DS-002",
        "高橋サービス",
        "（テスト担当）",
        "takahashi@partner-test.efix.local",
        "Takahashi2026!",
        "distributor",
        "",
        "",
        "",
        "TRUE",
        "特価卸テスト用ダミー",
    ],
    [
        "DS-003",
        "塚本忠行（個人事業主）",
        "塚本 忠行",
        "tsukamoto@partner-test.efix.local",
        "Tsukamoto2026!",
        "distributor",
        "",
        "",
        "",
        "TRUE",
        "特価卸テスト用ダミー",
    ],
]


def main() -> None:
    creds = service_account.Credentials.from_service_account_file(
        SA_PATH, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    sheets = build("sheets", "v4", credentials=creds, cache_discovery=False)

    meta = sheets.spreadsheets().get(
        spreadsheetId=SHEET_ID,
        fields="sheets(properties(sheetId,title))",
    ).execute()
    existing = {s["properties"]["title"]: s["properties"]["sheetId"] for s in meta["sheets"]}

    requests = []
    if TAB in existing:
        sheets.spreadsheets().values().clear(
            spreadsheetId=SHEET_ID,
            range=f"{TAB}!A:Z",
        ).execute()
        requests.append({
            "updateSheetProperties": {
                "properties": {
                    "sheetId": existing[TAB],
                    "gridProperties": {
                        "rowCount": 100,
                        "columnCount": len(HEADERS),
                        "frozenRowCount": 1,
                    },
                },
                "fields": "gridProperties.rowCount,gridProperties.columnCount,gridProperties.frozenRowCount",
            }
        })
    else:
        requests.append({
            "addSheet": {
                "properties": {
                    "title": TAB,
                    "gridProperties": {
                        "rowCount": 100,
                        "columnCount": len(HEADERS),
                        "frozenRowCount": 1,
                    },
                }
            }
        })

    sheets.spreadsheets().batchUpdate(
        spreadsheetId=SHEET_ID,
        body={"requests": requests},
    ).execute()
    print(f"[OK] tab '{TAB}' prepared")

    values = [HEADERS] + TEST_PARTNERS
    sheets.spreadsheets().values().update(
        spreadsheetId=SHEET_ID,
        range=f"{TAB}!A1",
        valueInputOption="USER_ENTERED",
        body={"values": values},
    ).execute()
    print(f"[OK] wrote {len(values)} rows × {len(HEADERS)} cols")

    # ヘッダー書式
    new_meta = sheets.spreadsheets().get(
        spreadsheetId=SHEET_ID,
        fields="sheets(properties(sheetId,title))",
    ).execute()
    sheet_id = next(
        s["properties"]["sheetId"]
        for s in new_meta["sheets"]
        if s["properties"]["title"] == TAB
    )

    sheets.spreadsheets().batchUpdate(
        spreadsheetId=SHEET_ID,
        body={
            "requests": [
                {
                    "repeatCell": {
                        "range": {
                            "sheetId": sheet_id,
                            "startRowIndex": 0,
                            "endRowIndex": 1,
                            "startColumnIndex": 0,
                            "endColumnIndex": len(HEADERS),
                        },
                        "cell": {
                            "userEnteredFormat": {
                                "backgroundColor": {"red": 0.13, "green": 0.30, "blue": 0.20},
                                "textFormat": {
                                    "foregroundColor": {"red": 1, "green": 1, "blue": 1},
                                    "bold": True,
                                },
                                "horizontalAlignment": "CENTER",
                            }
                        },
                        "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
                    }
                }
            ]
        },
    ).execute()
    print("[OK] header formatted")
    print(f"\nDONE. {TAB} ready with {len(TEST_PARTNERS)} test partners.")


if __name__ == "__main__":
    main()
