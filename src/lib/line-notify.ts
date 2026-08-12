/**
 * LINE Messaging API push で店主(石川)に通知を送る。
 * 受注・入金・エラーの「気づき」用であり、失敗しても注文処理は止めない。
 * env 未設定時は何もしない(ローカル開発やプレビュー環境で安全に無効化)。
 */
const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";

export async function notifyOwnerViaLine(text: string): Promise<boolean> {
  const channelAccessToken = process.env.LINE_NOTIFY_CHANNEL_ACCESS_TOKEN;
  const ownerUserId = process.env.LINE_NOTIFY_OWNER_USER_ID;
  if (!channelAccessToken || !ownerUserId) {
    console.log("LINE notify skipped: env not configured");
    return false;
  }

  try {
    const res = await fetch(LINE_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: ownerUserId,
        messages: [{ type: "text", text: text.slice(0, 4900) }],
      }),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`LINE notify failed: ${res.status} ${errorBody}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("LINE notify request error:", err);
    return false;
  }
}

export function formatJpy(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "¥不明";
  return `¥${amount.toLocaleString("ja-JP")}`;
}
