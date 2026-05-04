"""
EFIX販売管理.xlsx を Google Drive にアップロードしSheets化、
Webhook追記用「Web注文」シートを追加し、
ユーザー(takuma.ishikawa.line@gmail.com)にeditorで共有する。

サービスアカウント sheets-writer@efix-shop の Drive にアップ →
ユーザーに editor 共有 → ユーザーのDrive上の「共有アイテム」から見える。
"""

import sys
sys.stdout.reconfigure(encoding="utf-8")

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SA_PATH = r"C:\Users\tunag\accounting\credentials\efix-shop-service-account.json"
XLSX_PATH = r"C:\Users\tunag\it-efix-shop\.tmp_efix_sales.xlsx"
USER_EMAIL = "takuma.ishikawa.line@gmail.com"
SHEET_NAME = "EFIX販売管理"

SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
]


def main() -> None:
    creds = service_account.Credentials.from_service_account_file(
        SA_PATH, scopes=SCOPES
    )
    drive = build("drive", "v3", credentials=creds)
    sheets = build("sheets", "v4", credentials=creds)

    # 1. Excel をアップロードしつつ Google Sheets に変換
    file_metadata = {
        "name": SHEET_NAME,
        "mimeType": "application/vnd.google-apps.spreadsheet",
    }
    media = MediaFileUpload(
        XLSX_PATH,
        mimetype=(
            "application/vnd.openxmlformats-"
            "officedocument.spreadsheetml.sheet"
        ),
        resumable=True,
    )
    created = (
        drive.files()
        .create(
            body=file_metadata,
            media_body=media,
            fields="id,name,webViewLink,owners(emailAddress)",
            supportsAllDrives=True,
        )
        .execute()
    )
    spreadsheet_id = created["id"]
    print("[CREATED]", created)

    # 2. ユーザーに editor 権限で共有 (notification mail なし)
    drive.permissions().create(
        fileId=spreadsheet_id,
        body={
            "type": "user",
            "role": "writer",
            "emailAddress": USER_EMAIL,
        },
        fields="id,role,emailAddress",
        sendNotificationEmail=False,
        supportsAllDrives=True,
    ).execute()
    print(f"[SHARED] writer access granted to {USER_EMAIL}")

    # 3. 「Web注文」シート追加 + ヘッダー書き込み
    web_headers = [
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
    ]

    # 既存シートを取得して既に「Web注文」があれば追加しない
    meta = (
        sheets.spreadsheets()
        .get(spreadsheetId=spreadsheet_id, fields="sheets(properties(title))")
        .execute()
    )
    existing_titles = {s["properties"]["title"] for s in meta.get("sheets", [])}
    if "Web注文" not in existing_titles:
        sheets.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={
                "requests": [
                    {
                        "addSheet": {
                            "properties": {
                                "title": "Web注文",
                                "gridProperties": {
                                    "rowCount": 1000,
                                    "columnCount": len(web_headers),
                                    "frozenRowCount": 1,
                                },
                            }
                        }
                    }
                ]
            },
        ).execute()
        print("[ADDED] sheet 'Web注文'")

    # ヘッダー行書き込み
    sheets.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range="Web注文!A1",
        valueInputOption="RAW",
        body={"values": [web_headers]},
    ).execute()
    print("[WROTE] headers to 'Web注文'")

    print()
    print("=== RESULT ===")
    print(f"SPREADSHEET_ID: {spreadsheet_id}")
    print(f"URL: https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit")


if __name__ == "__main__":
    main()
