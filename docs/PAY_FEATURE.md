# 請求書カード払い機能 (2026-07-15 実装)

現実世界で契約〜納品済みの売掛(EFIX販売スプシ「シート1」で管理、freee請求書番号=INV)をStripeのカード決済で回収するための機能。**ECの受注フロー(通常のショップ注文・卸注文)とはデータソース・Webhook処理とも完全に分離**しており、既存の注文フローには一切影響しない。

## 背景・データソース

- スプレッドシート: `GOOGLE_SALES_SPREADSHEET_ID`（デフォルト `1rD8a6c9g2Y-8ucGXu2Dajy2O57wwI0C3lkou5I3OB9Q`。EC注文用の `GOOGLE_WHOLESALE_SPREADSHEET_ID`/`GOOGLE_ORDERS_SPREADSHEET_ID` とは環境によって異なるIDになりうるため、意図的に別envに分離した）
- 認証: 既存の `GOOGLE_SERVICE_ACCOUNT_KEY`(sheets-writer SA)をそのまま流用
- タブ「シート1」: ヘッダ行=6行目、データ=7行目〜。使用列は A(通し番号) / G(入金日) / I(顧客名) / P(価格税込) / X(INV番号) / AN(入金経路) / AO(カード手数料) / AP(Stripe決済ID)
- タブ「入金自動連係」: 楽天銀行→freee突合と同じ台帳に、カード決済分もレコードとして追記する
- タブ「顧客LINEマスタ」: LIFF経由で取得した顧客名⇔LINE userIdの紐付けを保存(Phase 1では任意機能)

## 実装したファイル

### ライブラリ
- `src/lib/pay-token.ts` — HMAC-SHA256署名付きトークン(`createPayToken` / `verifyPayToken`)。ペイロードは `{ inv: 正規化INV番号, exp: 発行から60日 }`。外部依存追加なし(Node `crypto` のみ)。
- `src/lib/sales-sheet.ts` — シート1照合ライブラリ。`normalizeInvNumber`(INV表記ゆれの正規化)、`findInvoiceRow`、`listUnpaidInvoiceRows`(管理画面用)、`recordCardPayment`(決済完了時の記帳)、`upsertLineBinding`(LINEマスタ更新)

### API (customer-facing, app router route handlers)
- `POST /api/pay/lookup` — `{ token }` → 請求書情報を返す。INV番号の直接指定は不可(トークン必須、列挙攻撃防止)
- `POST /api/pay/checkout` — `{ token }` → Stripe Checkout Session (`mode: payment`, `payment_method_types: ["card"]` のみ) を作成しURLを返す。metadataは snake_case (`pay_type`, `inv_number`, `serial`, `customer_name`)
- `POST /api/pay/line-binding` — `{ token, userId, displayName }` → 顧客LINEマスタへupsert。**常に200を返し、失敗は握りつぶす**(決済フローを止めないため)

### API (admin)
- `POST /api/admin/pay-links/generate` — `{ invNumber }` → 支払いリンクURLを発行。`/api/admin/*` は既存middleware(`legacyAdminPartnerRouting`)が自動的にJWT Cookie認証で保護している

### Webhook
- `src/app/api/webhook/route.ts` を改修。`checkout.session.completed` ハンドラの最初で `session.metadata?.pay_type === "invoice"` を判定し、該当すれば専用の `handleInvoicePaymentCompleted()` に分岐して即 return する。既存の `upsertWebOrder` / `upsertPendingModel` / `upsertInstallationReservation` は一切実行しない。`async_payment_*` / `expired` で `pay_type=invoice` が来た場合はログのみ(カードオンリーのフローのため通常発生しない)

### 画面
- `src/app/pay/page.tsx` — `?t=<トークン>` の有無で分岐するルーター役(クライアントコンポーネント)。**既存の `/pay`(営業向けカスタム決済URL生成ツール)のURLは変更していない**。トークン無しなら従来通り `SalesQuoteGenerator`(旧 `/pay` の中身をそのまま移設)を表示、トークン有りなら新規の `InvoicePayView` を表示する
- `src/app/pay/InvoicePayView.tsx` — 顧客向け請求書支払い画面。lookup→金額表示→「クレジットカードでお支払い」ボタン→Stripeへredirect。無効/期限切れトークンは日本語エラーのみ表示しフォームは出さない。LIFF SDKは `NEXT_PUBLIC_PAY_LIFF_ID` が設定されている場合のみ `https://static.line-scdn.net/liff/edge/2/sdk.js` を動的スクリプトロードし、失敗は握りつぶして決済フローを優先する
- `src/app/pay/success/page.tsx` — 「お支払いが完了しました。ありがとうございました。」の静的ページ
- `src/app/admin/pay-links/page.tsx` + `PayLinksClient.tsx` — 未入金(X列にINVあり・G列が空)の請求書一覧と、行ごとの「リンク生成」ボタン。生成されたURLはコピーできる

## 制約・設計判断

- 新規npm依存の追加なし(`stripe` / `googleapis` / Node標準の `crypto` のみ)
- 既存の `/pay` はrobots.txtで `disallow` 済み・middlewareでは認証していない公開ページ。新しい顧客向け支払い画面もこの制約をそのまま引き継ぐ(トークンが実質的な認可情報)
- G列(入金日)は既に手入力等で埋まっていた場合は上書きしない。その場合は入金自動連係タブの詳細列に「G列既記入あり・要確認」と注記して人力確認に回す
- INV番号の正規化は `(\d+)` の最初の数字列を抽出し先頭ゼロを除去した整数に統一。`'INV-0000000097'` / `'INV-97'` / `97'` はすべて同じ請求書として扱う
- Stripe webhookは仕様上再送されうるため、`recordCardPayment` はAP列(Stripe決済ID)が既に同じ`paymentIntentId`なら完全な重複配信と判断してノーオペで返す(連係タブへの二重追記や誤った「要確認」フラグを防ぐ)

## 追加が必要なVercel環境変数

| 変数名 | 用途 |
| --- | --- |
| `PAY_LINK_SECRET` | 支払いトークンのHMAC署名鍵。32文字以上。**本番はローカル開発用とは別の値を新規発行すること** |
| `GOOGLE_SALES_SPREADSHEET_ID` | EFIX販売スプシ(シート1)のID。`1rD8a6c9g2Y-8ucGXu2Dajy2O57wwI0C3lkou5I3OB9Q` |
| `NEXT_PUBLIC_PAY_LIFF_ID` | (任意・Phase 2以降) LINE LIFFアプリID。未設定ならLINE連携はスキップされ決済自体は成立する |

## 残課題

- LIFFアプリの実際の作成・LINE公式アカウントとの紐付けはPhase 1未着手(env未設定で問題なく動く設計)
- 管理画面の「リンク生成」は都度APIコールでトークンを発行する設計。過去に発行したリンクの一覧・失効機能は無い(トークン自体に60日の有効期限があるため実害は小さいが、必要なら発行履歴シートを別途追加できる)
- 本番の `PAY_LINK_SECRET` はこのコミットのローカル開発用の値をそのまま使い回さないこと
