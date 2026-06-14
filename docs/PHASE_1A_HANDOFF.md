# Phase 1a 引き継ぎ仕様書

**作成日**: 2026-06-14
**対象**: 次のセッションを担当するエンジニア / Claude / おまい本人
**前提**: V3 要件書(`docs/efix-requirements-v3.md`)を一読していること

---

## 0. このドキュメントの目的

Phase 1a(取付サービス機能の MVP)実装が **2026-06-14 に完了** した。ビルド・型チェック・lint 全て通過。
本書は次のステップで行うべき作業を **A. 確定作業 / B. 動作確認 / C. Phase 1b 仕様** の 3 セクションでまとめる。

---

## 1. 現状サマリ

### 1.1 完了した実装(Phase 1a)

| 種別 | ファイル | 概要 |
|---|---|---|
| 新規 | `docs/efix-requirements-v3.md` | V3 要件書(取付/機種マスタ/返送同梱) |
| 新規 | `src/lib/installation.ts` | 取付料金マップ・割引計算ロジック |
| 更新 | `src/components/OrderForm.tsx` | 都道府県プルダウン/取付不要オプション/希望日 3 つ |
| 更新 | `src/app/api/checkout/route.ts` | 北海道バリデ/取付割引/拡張 metadata |
| 更新 | `src/app/api/webhook/route.ts` | Sheets 26 列書込+機種保留マスタ自動 upsert |
| 更新 | `src/lib/sheets.ts` | WebOrderRow 拡張(7 フィールド追加) |
| 更新 | `src/app/legal/page.tsx` | 特商法 V3 化(内訳統合/取付保証追記) |

### 1.2 ビルド結果

```
✓ Next.js 16.2.1 (Turbopack)
✓ Compiled successfully in 8.3s
✓ TypeScript: pass
✓ ESLint: clean (0 errors, 0 warnings)
✓ Static pages: 33/33 generated
```

### 1.3 未実装・保留事項

- Phase 1b(返送・修理依頼書印刷ページ、オンライン返送フォーム): **ヤマト/佐川契約成立後に着手**
- 外注 Google Calendar 連携: Phase 2 以降
- 機種マスタ承認 UI: V3.5 以降
- PAY.JP 移行: V2 要件書済みだが別 Phase

---

## A. 確定作業(Commit & PR)

### A.1 ブランチ運用

現在 main ブランチに変更が積まれている(uncommitted)。**直接 main コミットは避け、feature ブランチを切る**。

```bash
cd "C:/Users/user/マイドライブ/dev/it-efix-shop"
git checkout -b feature/v3-installation-service
```

### A.2 ステージするファイル

```bash
git add docs/efix-requirements-v3.md
git add docs/PHASE_1A_HANDOFF.md
git add src/lib/installation.ts
git add src/components/OrderForm.tsx
git add src/app/api/checkout/route.ts
git add src/app/api/webhook/route.ts
git add src/lib/sheets.ts
git add src/app/legal/page.tsx
```

**注意**: `git add -A` や `git add .` は使わない。リポジトリ直下に `.tmp_*` 大量にあるため誤って混入させない。

### A.3 コミットメッセージ案

```
feat(v3): 取付サービス機能と北海道限定バリデーションを追加

- 取付サービス込み価格をデフォルト化、不要時は -¥160k(20)/-¥200k(20MAX) 割引
- 都道府県プルダウン追加、北海道以外は次へ disabled
- 取付ご希望日 3 つ(第1必須/2-3任意・翌日〜90日先)
- 機種保留マスタの自動 upsert(注文ごとに occurrence_count++)
- Sheets スキーマ拡張: A〜S(19列) → A〜Z(26列)
- 特商法ページ刷新: 内訳統合、取付サービス込み価格表示、北海道限定明記
- 適格請求書発行事業者登録番号 T2810703528253 を特商法に追加

Refs: docs/efix-requirements-v3.md
```

### A.4 PR タイトル & 本文ドラフト

**タイトル**:
```
[V3] 取付サービス機能・北海道限定バリデーション・機種マスタ自動蓄積
```

**本文**:
```markdown
## Summary
- V3 要件書(取付サービス・機種マスタ自動成長・返送同梱)に基づく Phase 1a 実装
- 取付サービス込み価格をデフォルトとし、オプトアウト時に商品単価から減算
- 都道府県プルダウン追加、サーバ側でも北海道バリデーション
- 取付ご希望日 3 つを date input で入力(取付サービス利用時のみ)
- Webhook で機種保留マスタを自動蓄積(将来の正規マスタ昇格の元データ)

## 変更ファイル
- 新規: `docs/efix-requirements-v3.md`, `docs/PHASE_1A_HANDOFF.md`, `src/lib/installation.ts`
- 更新: `OrderForm.tsx`, `checkout/route.ts`, `webhook/route.ts`, `sheets.ts`, `legal/page.tsx`

## デプロイ前にやること
1. Google Sheets に「機種保留マスタ」シート作成(A:E 5 列)
2. 既存「Web 注文」シートのヘッダー行に T〜Z 列を追加
3. Vercel preview で動作確認(動作確認手順は `docs/PHASE_1A_HANDOFF.md` §B 参照)

## Test plan
- [ ] /order ページが正常に表示される
- [ ] 北海道以外を選択すると「次へ」が disabled になる
- [ ] 取付不要チェックで割引額が表示・適用される
- [ ] 取付不要時は希望日入力が非表示になる
- [ ] Stripe Checkout に正しい金額(取付込み or 取付なし)が渡る
- [ ] Webhook 経由で Sheets に T〜Z 列が書き込まれる
- [ ] 機種保留マスタに新規メーカー/機種が upsert される
```

### A.5 デプロイ前の Google Sheets 作業

**① 「機種保留マスタ」シート作成**

既存スプレッドシート(`GOOGLE_SPREADSHEET_ID`)に新シート追加。

| A | B | C | D | E |
|---|---|---|---|---|
| メーカー | 機種名 | 初回入力日時 | 累計回数 | 関連session_ids |

ヘッダーは 1 行目に手動で入れる。シートが無い場合 webhook は catch で握りつぶすので、エラーで止まらないが**機種データは溜まらない**。

**② 「Web 注文」シートのヘッダー拡張**

T〜Z 列のヘッダーを追加:

| 列 | ヘッダー |
|---|---|
| T | 都道府県 |
| U | 取付要否 |
| V | 第1希望日 |
| W | 第2希望日 |
| X | 第3希望日 |
| Y | 取付完了日 |
| Z | 返送伝票番号 |

A〜S の既存行はそのまま(空欄になる)、新規行から自動入力される。

### A.6 Vercel デプロイ

`main` または `feature/*` push で自動デプロイ。Preview URL で動作確認(§B 参照)してから main merge。

---

## B. 動作確認手順

### B.1 ローカル開発サーバー起動

```bash
cd "C:/Users/user/マイドライブ/dev/it-efix-shop"
npm run dev
```

→ `http://localhost:3000` でアクセス。

`.env.local` が正しく配置されているか確認。Stripe 環境変数が test キーであることを確認。

### B.2 playwright/Chrome 経由の確認(Claude 自動化用)

playwright-mcp で動作確認する場合の前提:

1. 9222 Chrome が起動中か確認: `C:\Users\user\ai_handoff\scripts\check-shared-chrome.ps1`
2. 起動していなければ起動: `start-shared-chrome.ps1`
3. playwright-guard skill を必ず読んでから操作開始

### B.3 動作確認チェックリスト

#### B.3.1 商品選択(Step 1)

- [ ] /order にアクセス → ステップ 1 が表示される
- [ ] e-steer 20 を数量 1 で追加 → 「取付サービスは不要」チェックボックスが表示される
- [ ] チェックなしの状態で小計が ¥1,150,000 表示
- [ ] チェックを入れると割引「-¥160,000」が表示され、お支払合計が ¥990,000 になる
- [ ] e-steer 20 MAX も同様に動作(-¥200,000 で ¥1,100,000)
- [ ] 両方追加した場合の割引合計が ¥360,000 になる
- [ ] オプション商品(NMEA タブレットケーブル等)を追加しても取付関連の挙動に影響しない

#### B.3.2 カート(Step 2)

- [ ] カート画面に商品リスト・小計・割引・合計が正しく表示される
- [ ] 「お客様情報へ」で Step 3 に進める

#### B.3.3 お客様情報(Step 3)

- [ ] 都道府県プルダウンに 47 都道府県が表示される
- [ ] 「東京都」など北海道以外を選択 → 「次へ」を押すと赤エラー
- [ ] 「北海道」を選択 → 必須項目埋めれば次に進める
- [ ] 取付不要をオプトアウトしている場合、希望日入力欄が**非表示**
- [ ] 取付サービス利用の場合、希望日 3 つの入力欄が表示される
- [ ] 第 1 希望未入力で次へ押すと赤エラー
- [ ] 過去日付・90 日超を選択するとブラウザの date input が制限する(min/max 設定)

#### B.3.4 同意確認(Step 4)

- [ ] 3 つのチェックを入れないと「次へ」が disabled
- [ ] 全部入れたら次へ進む

#### B.3.5 注文確認(Step 5)

- [ ] 注文商品一覧・小計・取付サービス割引(該当時)・合計が表示される
- [ ] 取付サービスセクション:
  - 取付不要時: 「取付サービスは利用しません(自分で取付)」表示
  - 取付利用時: 希望日が表示される
- [ ] お客様情報の住所が「北海道 札幌市豊平区...」のように都道府県+市町村結合で表示

#### B.3.6 Stripe Checkout

- [ ] 「注文を確定する」→ confirm ダイアログで内容確認
- [ ] OK → Stripe Checkout 画面に遷移
- [ ] 商品名が「e-steer 20」or「e-steer 20(取付サービスなし)」と表示
- [ ] 単価が ¥1,150,000 or ¥990,000
- [ ] テストカード(4242 4242 4242 4242)で決済成功

#### B.3.7 Webhook → Sheets

Stripe CLI で webhook をローカルに転送して確認:

```bash
# 別ターミナルで起動
stripe listen --forward-to localhost:3000/api/webhook
```

決済完了後、Google Sheets「Web 注文」シートに行が追加されるか確認:

- [ ] 連番(A 列)が +1 される
- [ ] T 列に「北海道」
- [ ] U 列に「取付サービス利用」または「取付なし(自分で取付)」
- [ ] V〜X 列に希望日(取付利用時のみ)
- [ ] Y/Z 列は空欄(運営手入力用)

機種保留マスタも確認:

- [ ] 新規メーカー/機種なら 1 行追加(累計回数=1)
- [ ] 既存ペアなら累計回数 +1、session_ids に追記

### B.4 既存フロー(卸/特価卸/営業)が壊れていないか確認

- [ ] /partner からのログイン→注文フローが従来通り動く(都道府県不要、取付なし)
- [ ] /pay からのカスタム決済が動く
- [ ] /wholesale 系のフローが動く

PartnerOrderForm と BuyButton は旧 `address` フィールドを送り続ける。checkout/route.ts は両方対応済み(下位互換)。

---

## C. Phase 1b 仕様(黒猫契約後に実装)

### C.1 概要

ヤマト運輸または佐川急便の業務契約が成立した後、返送・修理依頼書同梱機能を実装する。
**Phase 1b は仕様だけ確定済み、コードは黒猫契約成立後に着手**。

### C.2 追加ファイル一覧

| ファイル | 役割 |
|---|---|
| `src/lib/return-slip.ts` | 保証期限計算ロジック・伝票データ生成 |
| `src/lib/return-address.ts` | 返送先住所マスタ(NOVA STELLA 帯広) |
| `src/app/admin/orders/[orderId]/return-slip/page.tsx` | 印刷用ページ(A4 縦・印刷 CSS) |
| `src/app/return/page.tsx` | オンライン返送依頼フォーム |
| `src/app/api/return-request/route.ts` | フォーム受付 API→Sheets「Web 返送依頼」シート追記 |

### C.3 各ファイルの責務

#### C.3.1 `src/lib/return-slip.ts`

```ts
import type { WebOrderRow } from "./sheets";

export interface WarrantyDeadlines {
  display: string;  // ディスプレイ 1年
  antenna: string;  // アンテナ 1年
  motor: string;    // モーター 1年
  cable: string;    // ケーブル 半年
  other: string;    // その他 半年
  installation: string; // 取付起因 1ヶ月
}

export function calcWarrantyDeadlines(row: WebOrderRow): WarrantyDeadlines {
  // 取付完了日 > 発送日 > (購入日+7日) の優先順位で起算日決定
  const baseDate = row.installedAt
    ? new Date(row.installedAt)
    : new Date(row.orderedAt); // V3 では「発送日」は注文日で代用
  return {
    display:      addMonths(baseDate, 12),
    antenna:      addMonths(baseDate, 12),
    motor:        addMonths(baseDate, 12),
    cable:        addMonths(baseDate, 6),
    other:        addMonths(baseDate, 6),
    installation: addMonths(baseDate, 1),
  };
}

function addMonths(d: Date, months: number): string {
  const next = new Date(d);
  next.setMonth(next.getMonth() + months);
  return next.toISOString().slice(0, 10);
}
```

#### C.3.2 `src/lib/return-address.ts`

```ts
export const RETURN_ADDRESS = {
  postalCode: "082-0004",
  prefecture: "北海道",
  cityLine: "河西郡芽室町東芽室北1線20番25",
  companyLine: "NOVA STELLA 内 E-FIX 修理窓口",
  noteLine: "※同建物内・三菱農機販売株式会社 帯広営業所",
  phone: "080-6282-4834",
} as const;
```

#### C.3.3 `src/app/admin/orders/[orderId]/return-slip/page.tsx`

- 管理画面の認証必須(`src/lib/admin-auth.ts` 流用)
- URL パラメータの `orderId` で Sheets から該当注文取得
- A4 縦サイズの印刷専用ページ
- 印刷 CSS:
  ```css
  @media print {
    @page { size: A4 portrait; margin: 15mm; }
    body { background: white; }
    .no-print { display: none; }
  }
  ```
- 含める内容(V3 §25.2):
  1. ヘッダー: ロゴ・「返送・修理依頼書」
  2. 注文情報: 購入番号、お名前、ご住所、ご購入日、取付完了日(あれば)
  3. 保証期間一覧(`calcWarrantyDeadlines` の結果を表示)
  4. お客様記入欄: 返送理由・故障部位・症状詳細
  5. 返送先(`RETURN_ADDRESS` 使用)
  6. 着払い/元払い案内
  7. QR コード(`qrcode.react` 使用): `https://efix-shop.jp/return?o=<sessionId末尾>`

#### C.3.4 `src/app/return/page.tsx`

- 公開ページ(認証不要)
- クエリパラメータ `?o=<sessionId末尾>` から注文識別
- 客が記入: 注文番号(自動)/メアド or 電話/返送理由/故障部位/症状
- POST `/api/return-request`
- 送信後は「受付ました」ページ

#### C.3.5 `src/app/api/return-request/route.ts`

- リクエストバリデーション
- Sheets「Web 返送依頼」シートに追記
- 完了したらおまい宛てに通知(まずはメール、後で LINE)

### C.4 スキーマ追加: Sheets「Web 返送依頼」

| 列 | 内容 |
|---|---|
| A | 連番 |
| B | 受付日時 |
| C | 関連 sessionId |
| D | 元注文連番 |
| E | お名前 |
| F | メアド |
| G | 電話 |
| H | 返送理由 |
| I | 故障部位 |
| J | 症状詳細 |
| K | 保証期間内/外 |
| L | 処理ステータス(管理者更新) |
| M | 処理メモ(管理者更新) |

### C.5 印刷時の運用フロー(Phase 1b 完成後)

1. 客が注文 → 決済完了 → Sheets に行追加
2. おまい(or 堀田機工)が出荷準備
3. 管理画面で /admin/orders/<連番>/return-slip を開く
4. Ctrl+P で印刷(返送票 A4 1 枚)
5. 同時に着払い伝票(ヤマト B2 クラウドで発行)を 1 枚印刷
6. 返送票 + 着払い伝票 + 商品 を箱詰めして発送

### C.6 配送業者契約状況の確認方法

`memory: it-efix-shop-v3-installation` を参照。契約成立したらここを更新する。

- ヤマト: 営業の連絡待ち(2026-06-14 時点)
- 佐川: 業務向け登録予定(おまいのアクション待ち)

### C.7 Phase 1b の実装着手条件

以下が全て満たされたら着手 OK:

1. ヤマトまたは佐川の業務契約成立(B2 クラウド or e 飛伝Ⅲにアクセス可能)
2. クロネコビジネスメンバーズ or スマートクラブ for business のログイン情報取得
3. NOVA STELLA という会社情報の確認(別屋号 / 関連会社 / 協力会社のどれか)

---

## 2. 次セッション着手時のチェックリスト

```
[ ] memory MEMORY.md を読んで現状把握
[ ] memory it-efix-shop-v3-installation.md を読む
[ ] memory it-efix-shop-architecture.md を読む
[ ] docs/efix-requirements-v3.md を読む
[ ] このドキュメント docs/PHASE_1A_HANDOFF.md を読む
[ ] git status で未コミット状態確認
[ ] npm run lint && npm run build で現状ビルド可能性を確認
[ ] §A, §B, §C のどれを進めるかユーザーと決める
```

---

## 3. 既知の懸念

| 項目 | 内容 | 対応方針 |
|---|---|---|
| Sheets「機種保留マスタ」シート未作成 | webhook はエラー回避するが機種データ溜まらない | デプロイ前にシート作成 |
| middleware → proxy 移行 | Next.js 16 の deprecation 警告 | 別 PR で対応(本 PR スコープ外) |
| Resend 通知未実装 | おまい宛て注文通知の自動化保留 | Phase 1c で実装 |
| PartnerOrderForm の都道府県 | 卸は都道府県プルダウン未対応 | 卸取引はバリデ不要(法人住所前提)で意図的に未対応 |
| BuyButton の単一商品決済 | 取付不要オプション未対応 | BuyButton は「カートに入れず直接決済」用、取付は OrderForm 経由で |
| NOVA STELLA の正体不明 | 関連会社/別屋号/協力会社のどれか不明 | おまい確認後、`return-address.ts` 実装時に最終確認 |

---

## 4. 連絡先・参考リンク

- リポジトリ: https://github.com/nashigatachannel/it-efix-shop
- 本番ドメイン: https://efix-shop.jp
- Stripe ダッシュボード: dashboard.stripe.com
- Google Sheets: スプレッドシート ID は環境変数 `GOOGLE_SPREADSHEET_ID`
- 返送先(NOVA STELLA): 〒082-0004 北海道河西郡芽室町東芽室北1線20番25 / TEL 080-6282-4834

---

*この HANDOFF は Phase 1a 完了時点(2026-06-14)のスナップショット。Phase 1b 着手時に更新する。*
