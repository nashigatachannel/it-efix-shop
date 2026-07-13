/**
 * 顧客向け注文番号 ↔ 「Web注文」シートA列の通し番号(連番) の可逆変換。
 *
 * 連番をそのまま見せると累計注文数が推測できてしまうため、
 * 10000〜99999 の5桁へ全単射(アフィン置換)で写す。見た目はランダムだが
 * 決定的で衝突しない。シート側・管理画面はあくまで連番のままにし、
 * この変換は顧客への表示・顧客からの入力の境界でのみ使う。
 *
 * 通し番号が 90000 以上になると番号が一巡して衝突するが、現実の注文数では到達しない。
 */
const MODULUS = 90_000;
const MULTIPLIER = 48_271; // MODULUS と互いに素な素数
const INCREMENT = 12_345;
const BASE = 10_000;

function modInverse(value: number, modulus: number): number {
  let [remainderPrev, remainder] = [value % modulus, modulus];
  let [coefficientPrev, coefficient] = [1, 0];
  while (remainder !== 0) {
    const quotient = Math.floor(remainderPrev / remainder);
    [remainderPrev, remainder] = [remainder, remainderPrev - quotient * remainder];
    [coefficientPrev, coefficient] = [coefficient, coefficientPrev - quotient * coefficient];
  }
  if (remainderPrev !== 1) {
    throw new Error(`modInverse: ${value} と ${modulus} が互いに素ではありません`);
  }
  return ((coefficientPrev % modulus) + modulus) % modulus;
}

const MULTIPLIER_INVERSE = modInverse(MULTIPLIER, MODULUS);

/** 通し番号 → 顧客向け5桁注文番号 (例: 1 → "70616") */
export function toDisplayOrderNumber(serialNumber: number): string {
  const mapped = ((serialNumber % MODULUS) * MULTIPLIER + INCREMENT) % MODULUS;
  return String(BASE + mapped);
}

/**
 * 顧客向け5桁注文番号 → 通し番号。
 * 5桁の数字でなければ null(旧形式の生連番などは呼び出し側で別途扱う)。
 */
export function fromDisplayOrderNumber(displayNumber: string): number | null {
  const trimmed = displayNumber.trim();
  if (!/^\d{5}$/.test(trimmed)) return null;
  const offsetValue = Number(trimmed) - BASE;
  if (offsetValue < 0 || offsetValue >= MODULUS) return null;
  const shifted = (((offsetValue - INCREMENT) % MODULUS) + MODULUS) % MODULUS;
  return (shifted * MULTIPLIER_INVERSE) % MODULUS;
}

/**
 * Web注文行の顧客向け注文ID。通し番号があれば5桁注文番号、
 * 無ければ従来どおり Stripe セッションIDにフォールバックする。
 */
export function webOrderDisplayId(
  serialNumber: number | null,
  sessionId: string,
): string {
  return serialNumber !== null ? toDisplayOrderNumber(serialNumber) : sessionId;
}
