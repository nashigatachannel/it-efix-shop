import Link from "next/link";
import { getCurrentAdmin } from "@/lib/admin-auth";
import {
  fetchInstallationReservations,
  fetchWebOrders,
  SPREADSHEET_ID,
  type InstallationReservationRow,
  type InstallationStatus,
  type WebOrderRow,
} from "@/lib/sheets";
import InstallationRowEditor from "./InstallationRowEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

interface AdminInstallationsPageProps {
  searchParams?: SearchParams;
}

interface JoinedRow {
  reservation: InstallationReservationRow;
  order: WebOrderRow | null;
  desiredDates: string[];
}

interface CalendarDay {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

interface DayBucket {
  desired: JoinedRow[];
  confirmed: JoinedRow[];
  installed: JoinedRow[];
}

type StatusFilter = "active" | "all" | InstallationStatus;

const STATUS_LABEL: Record<string, string> = {
  requested: "希望日受領",
  proposing: "業者打診中",
  confirmed: "日程確定",
  installed: "取付完了",
  cancelled: "キャンセル",
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "未完了" },
  { value: "all", label: "すべて" },
  { value: "requested", label: "希望日受領" },
  { value: "proposing", label: "業者打診中" },
  { value: "confirmed", label: "日程確定" },
  { value: "installed", label: "取付完了" },
  { value: "cancelled", label: "キャンセル" },
];

const STATUS_PRIORITY: Record<string, number> = {
  requested: 0,
  proposing: 1,
  confirmed: 2,
  installed: 3,
  cancelled: 4,
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isMonthKey(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function toMonthKey(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

function splitDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

function getTodayKey(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return toDateKey(year, month, day);
}

function addMonths(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  return toMonthKey(next.getUTCFullYear(), next.getUTCMonth() + 1);
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${year}年${month}月`;
}

function dateLabel(dateKey: string): string {
  if (!isDateKey(dateKey)) return "日付なし";
  const { year, month, day } = splitDateKey(dateKey);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${month}/${day}(${weekday})`;
}

function buildCalendarDays(monthKey: string, todayKey: string): CalendarDay[] {
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const firstDow = firstDay.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cellCount = Math.max(35, Math.ceil((firstDow + daysInMonth) / 7) * 7);

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, 1 - firstDow + index));
    const key = toDateKey(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
    );
    return {
      key,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month - 1,
      isToday: key === todayKey,
    };
  });
}

function normalizeDesiredDates(order: WebOrderRow | null): string[] {
  if (!order) return [];
  return [order.desiredDate1, order.desiredDate2, order.desiredDate3].filter(
    (date): date is string => isDateKey(date),
  );
}

function getBucket(map: Map<string, DayBucket>, key: string): DayBucket {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = { desired: [], confirmed: [], installed: [] };
    map.set(key, bucket);
  }
  return bucket;
}

function buildCalendarBuckets(rows: JoinedRow[]): Map<string, DayBucket> {
  const buckets = new Map<string, DayBucket>();
  for (const row of rows) {
    const { reservation, desiredDates } = row;
    if (reservation.status === "cancelled") continue;

    for (const desiredDate of desiredDates) {
      if (desiredDate !== reservation.confirmedDate) {
        getBucket(buckets, desiredDate).desired.push(row);
      }
    }

    if (isDateKey(reservation.confirmedDate) && !reservation.installedAt) {
      getBucket(buckets, reservation.confirmedDate).confirmed.push(row);
    }

    if (isDateKey(reservation.installedAt)) {
      getBucket(buckets, reservation.installedAt).installed.push(row);
    }
  }
  return buckets;
}

function statusBadgeClass(status: string): string {
  if (status === "requested")
    return "bg-amber-50 text-amber-700 border border-amber-200";
  if (status === "proposing")
    return "bg-sky-50 text-sky-700 border border-sky-200";
  if (status === "confirmed")
    return "bg-indigo-50 text-indigo-700 border border-indigo-200";
  if (status === "installed")
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (status === "cancelled")
    return "bg-red-50 text-red-700 border border-red-200";
  return "bg-neutral-100 text-neutral-600 border border-neutral-200";
}

function rowMatchesStatus(row: JoinedRow, selected: StatusFilter): boolean {
  const status = row.reservation.status;
  if (selected === "all") return true;
  if (selected === "active") return status !== "installed" && status !== "cancelled";
  return status === selected;
}

function rowMatchesDate(row: JoinedRow, selectedDate: string): boolean {
  if (!selectedDate) return true;
  const { reservation, desiredDates } = row;
  return (
    reservation.confirmedDate === selectedDate ||
    reservation.installedAt === selectedDate ||
    desiredDates.includes(selectedDate)
  );
}

function primaryDate(row: JoinedRow, todayKey: string): string {
  const { reservation, desiredDates } = row;
  if (isDateKey(reservation.confirmedDate)) return reservation.confirmedDate;
  const futureDesired = desiredDates.find((date) => date >= todayKey);
  return futureDesired ?? desiredDates[0] ?? row.order?.orderedAt ?? "";
}

function sortRows(a: JoinedRow, b: JoinedRow, todayKey: string): number {
  const pa = STATUS_PRIORITY[a.reservation.status] ?? 99;
  const pb = STATUS_PRIORITY[b.reservation.status] ?? 99;
  if (pa !== pb) return pa - pb;
  const da = primaryDate(a, todayKey);
  const db = primaryDate(b, todayKey);
  if (da !== db) return da.localeCompare(db);
  return (b.order?.orderedAt ?? "").localeCompare(a.order?.orderedAt ?? "");
}

function buildHref(params: {
  month: string;
  date?: string;
  status: StatusFilter;
}): string {
  const search = new URLSearchParams();
  search.set("month", params.month);
  if (params.date) search.set("date", params.date);
  if (params.status !== "active") search.set("status", params.status);
  const query = search.toString();
  return query ? `/admin/installations?${query}` : "/admin/installations";
}

function selectedStatus(rawStatus: string): StatusFilter {
  const found = STATUS_FILTERS.find((filter) => filter.value === rawStatus);
  return found?.value ?? "active";
}

function statusCountLabel(count: number): string {
  return `${count}件`;
}

function CalendarCount({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "amber" | "indigo" | "emerald";
}) {
  if (count === 0) return null;
  const className =
    tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "indigo"
        ? "bg-indigo-50 text-indigo-700"
        : "bg-emerald-50 text-emerald-700";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${className}`}>
      {label} {count}
    </span>
  );
}

function ReservationMiniRow({
  row,
  date,
  kind,
}: {
  row: JoinedRow;
  date: string;
  kind: "desired" | "confirmed" | "installed";
}) {
  const { reservation, order } = row;
  const kindLabel =
    kind === "desired" ? "希望" : kind === "confirmed" ? "確定" : "完了";
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-neutral-950">
            {order?.customerName || "顧客情報なし"}
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            {dateLabel(date)} / {kindLabel}
          </div>
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(
            reservation.status,
          )}`}
        >
          {STATUS_LABEL[reservation.status] ?? reservation.status}
        </span>
      </div>
      <div className="mt-1 text-xs text-neutral-600">
        {order?.customerPrefecture || "地域未入力"} / {order?.model || "モデル未入力"}
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
      {children}
    </div>
  );
}

function desiredDateChips(dates: string[]) {
  if (dates.length === 0) {
    return <span className="text-neutral-400">未入力</span>;
  }
  return dates.map((date, index) => (
    <span
      key={`${date}-${index}`}
      className="rounded bg-amber-50 px-2 py-0.5 font-bold text-amber-700"
    >
      第{index + 1}希望 {dateLabel(date)}
    </span>
  ));
}

export default async function AdminInstallationsPage({
  searchParams,
}: AdminInstallationsPageProps) {
  const admin = await getCurrentAdmin();
  const params = searchParams ? await searchParams : {};
  const todayKey = getTodayKey();
  const rawDate = firstParam(params.date);
  const selectedDate = isDateKey(rawDate) ? rawDate : "";
  const rawMonth = firstParam(params.month);
  const initialMonth = selectedDate ? selectedDate.slice(0, 7) : todayKey.slice(0, 7);
  const monthKey = isMonthKey(rawMonth) ? rawMonth : initialMonth;
  const filter = selectedStatus(firstParam(params.status));

  let reservations: InstallationReservationRow[] = [];
  let orders: WebOrderRow[] = [];
  let loadError: string | null = null;

  if (!SPREADSHEET_ID) {
    loadError = "GOOGLE_SPREADSHEET_ID が未設定です";
  } else {
    try {
      [reservations, orders] = await Promise.all([
        fetchInstallationReservations(),
        fetchWebOrders(),
      ]);
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Sheets読込エラー";
    }
  }

  const ordersBySessionId = new Map<string, WebOrderRow>();
  for (const order of orders) {
    if (order.sessionId) ordersBySessionId.set(order.sessionId, order);
  }

  const joined: JoinedRow[] = reservations.map((reservation) => {
    const order = ordersBySessionId.get(reservation.orderId) ?? null;
    return {
      reservation,
      order,
      desiredDates: normalizeDesiredDates(order),
    };
  });

  const sortedRows = [...joined].sort((a, b) => sortRows(a, b, todayKey));
  const filteredRows = sortedRows.filter(
    (row) => rowMatchesStatus(row, filter) && rowMatchesDate(row, selectedDate),
  );

  const calendarDays = buildCalendarDays(monthKey, todayKey);
  const calendarBuckets = buildCalendarBuckets(joined);
  const selectedDateRows = selectedDate
    ? sortedRows.filter((row) => rowMatchesDate(row, selectedDate))
    : [];

  const upcomingRows = sortedRows
    .filter((row) => rowMatchesStatus(row, "active"))
    .map((row) => {
      const confirmed = row.reservation.confirmedDate;
      if (isDateKey(confirmed)) {
        return { row, date: confirmed, kind: "confirmed" as const };
      }
      const futureDesired =
        row.desiredDates.find((date) => date >= todayKey) ?? row.desiredDates[0];
      if (!futureDesired) return null;
      return { row, date: futureDesired, kind: "desired" as const };
    })
    .filter(
      (item): item is { row: JoinedRow; date: string; kind: "desired" | "confirmed" } =>
        item !== null,
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  const counts = {
    requested: 0,
    proposing: 0,
    confirmed: 0,
    installed: 0,
    cancelled: 0,
    active: 0,
    total: joined.length,
  };
  for (const j of joined) {
    const key = j.reservation.status as keyof typeof counts;
    if (key in counts && key !== "total" && key !== "active") counts[key]++;
    if (j.reservation.status !== "installed" && j.reservation.status !== "cancelled") {
      counts.active++;
    }
  }

  const calendarTitle = selectedDate
    ? `${dateLabel(selectedDate)} の予約`
    : "今日以降の予定";

  return (
    <div className="mx-auto max-w-[1320px] px-2 py-4 sm:px-4 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 border-b-2 border-[#d1a227] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-950">
            取付予約管理
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            希望日、確定日、業者打診、取付完了をまとめて管理します。
          </p>
        </div>
        <p className="text-xs text-neutral-500">
          ログイン中: {admin?.email ?? "-"}
        </p>
      </div>

      {loadError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Sheets読込失敗</p>
          <p className="mt-1 text-xs leading-relaxed">{loadError}</p>
        </div>
      )}

      {!loadError && (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {(
              [
                ["active", counts.active, "未完了"],
                ["requested", counts.requested, STATUS_LABEL.requested],
                ["proposing", counts.proposing, STATUS_LABEL.proposing],
                ["confirmed", counts.confirmed, STATUS_LABEL.confirmed],
                ["installed", counts.installed, STATUS_LABEL.installed],
                ["cancelled", counts.cancelled, STATUS_LABEL.cancelled],
              ] as const
            ).map(([key, count, label]) => (
              <Link
                key={key}
                href={buildHref({ month: monthKey, date: selectedDate, status: key })}
                className={`rounded-lg border p-4 shadow-sm transition ${
                  filter === key
                    ? "border-[#d1a227] bg-[#fff8e4]"
                    : "border-neutral-200 bg-white hover:border-[#d1a227]"
                }`}
              >
                <div className="text-xs font-bold text-neutral-500">{label}</div>
                <div className="mt-1 text-2xl font-black text-neutral-950">
                  {count}
                </div>
              </Link>
            ))}
          </div>

          <section className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-neutral-950">
                    {monthLabel(monthKey)}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-600">
                    <span className="rounded bg-amber-50 px-2 py-0.5 font-bold text-amber-700">
                      希望
                    </span>
                    <span className="rounded bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">
                      確定
                    </span>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                      完了
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={buildHref({ month: addMonths(monthKey, -1), status: filter })}
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                  >
                    前月
                  </Link>
                  <Link
                    href={buildHref({ month: todayKey.slice(0, 7), date: todayKey, status: filter })}
                    className="rounded-md border border-[#d1a227] px-3 py-2 text-sm font-bold text-[#a77806] hover:bg-[#fff8e4]"
                  >
                    今日
                  </Link>
                  <Link
                    href={buildHref({ month: addMonths(monthKey, 1), status: filter })}
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                  >
                    翌月
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-7 border-y border-neutral-200 bg-neutral-50 text-center text-xs font-bold text-neutral-500">
                {WEEKDAYS.map((weekday) => (
                  <div key={weekday} className="py-2">
                    {weekday}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2 pt-2">
                {calendarDays.map((day) => {
                  const bucket = calendarBuckets.get(day.key);
                  const desiredCount = bucket?.desired.length ?? 0;
                  const confirmedCount = bucket?.confirmed.length ?? 0;
                  const installedCount = bucket?.installed.length ?? 0;
                  const hasEvents =
                    desiredCount + confirmedCount + installedCount > 0;
                  const selected = day.key === selectedDate;
                  return (
                    <Link
                      key={day.key}
                      href={buildHref({
                        month: day.key.slice(0, 7),
                        date: day.key,
                        status: filter,
                      })}
                      className={`min-h-[108px] rounded-md border p-2 text-left transition ${
                        selected
                          ? "border-[#d1a227] bg-[#fff8e4] ring-2 ring-[#d1a227]/25"
                          : hasEvents
                            ? "border-neutral-300 bg-white hover:border-[#d1a227]"
                            : "border-neutral-200 bg-white hover:border-neutral-300"
                      } ${day.inMonth ? "" : "bg-neutral-50 text-neutral-400"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${
                            day.isToday
                              ? "bg-neutral-950 text-white"
                              : "text-neutral-800"
                          }`}
                        >
                          {day.day}
                        </span>
                        {hasEvents && (
                          <span className="text-[10px] font-bold text-neutral-400">
                            {desiredCount + confirmedCount + installedCount}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-col items-start gap-1">
                        <CalendarCount label="希望" count={desiredCount} tone="amber" />
                        <CalendarCount
                          label="確定"
                          count={confirmedCount}
                          tone="indigo"
                        />
                        <CalendarCount
                          label="完了"
                          count={installedCount}
                          tone="emerald"
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <aside className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-neutral-950">
                  {calendarTitle}
                </h2>
                {selectedDate && (
                  <Link
                    href={buildHref({ month: monthKey, status: filter })}
                    className="shrink-0 text-xs font-bold text-[#a77806] hover:underline"
                  >
                    日付解除
                  </Link>
                )}
              </div>

              {selectedDate ? (
                <div className="space-y-2">
                  {selectedDateRows.length === 0 ? (
                    <EmptyState>この日の予約はありません。</EmptyState>
                  ) : (
                    selectedDateRows.map((row) => {
                      const { reservation, desiredDates } = row;
                      const kind =
                        reservation.installedAt === selectedDate
                          ? "installed"
                          : reservation.confirmedDate === selectedDate
                            ? "confirmed"
                            : "desired";
                      return (
                        <ReservationMiniRow
                          key={`${row.reservation.orderId}-${kind}`}
                          row={row}
                          date={selectedDate}
                          kind={desiredDates.includes(selectedDate) ? "desired" : kind}
                        />
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingRows.length === 0 ? (
                    <EmptyState>今日以降の未完了予約はありません。</EmptyState>
                  ) : (
                    upcomingRows.map((item) => (
                      <ReservationMiniRow
                        key={`${item.row.reservation.orderId}-${item.date}`}
                        row={item.row}
                        date={item.date}
                        kind={item.kind}
                      />
                    ))
                  )}
                </div>
              )}
            </aside>
          </section>

          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-neutral-950">予約一覧</h2>
              <p className="mt-1 text-sm text-neutral-600">
                表示中: {statusCountLabel(filteredRows.length)} / 全{counts.total}件
                {selectedDate ? ` / ${dateLabel(selectedDate)}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((statusFilter) => (
                <Link
                  key={statusFilter.value}
                  href={buildHref({
                    month: monthKey,
                    date: selectedDate,
                    status: statusFilter.value,
                  })}
                  className={`rounded-md border px-3 py-2 text-xs font-bold transition ${
                    filter === statusFilter.value
                      ? "border-[#d1a227] bg-[#fff8e4] text-[#a77806]"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {statusFilter.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {!loadError && joined.length === 0 && (
        <EmptyState>
          まだ取付予約はありません。決済成功時に自動で追加されます。
        </EmptyState>
      )}

      {!loadError && joined.length > 0 && filteredRows.length === 0 && (
        <EmptyState>条件に合う取付予約はありません。</EmptyState>
      )}

      {!loadError && filteredRows.length > 0 && (
        <div className="space-y-4">
          {filteredRows.map(({ reservation, order, desiredDates }) => {
            const isSample = reservation.orderId.startsWith("SAMPLE-");
            return (
              <div
                key={reservation.orderId}
                className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 border-b border-neutral-200 pb-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(
                            reservation.status,
                          )}`}
                        >
                          {STATUS_LABEL[reservation.status] ?? reservation.status}
                        </span>
                        {isSample && (
                          <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                            サンプル行
                          </span>
                        )}
                        {!order && !isSample && (
                          <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                            Web注文と未連携
                          </span>
                        )}
                      </div>
                      <div className="text-lg font-black text-neutral-950">
                        {order?.customerName || "顧客情報なし"}
                        {order?.customerPrefecture && (
                          <span className="ml-2 text-sm font-bold text-neutral-500">
                            {order.customerPrefecture}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 break-all font-mono text-xs text-neutral-500">
                        {reservation.orderId}
                      </div>
                    </div>

                    <div className="grid gap-2 text-xs text-neutral-700 sm:grid-cols-2 lg:w-[440px]">
                      <div className="rounded-md bg-neutral-50 px-3 py-2">
                        <span className="block font-bold text-neutral-500">確定日</span>
                        {reservation.confirmedDate
                          ? dateLabel(reservation.confirmedDate)
                          : "未確定"}
                      </div>
                      <div className="rounded-md bg-neutral-50 px-3 py-2">
                        <span className="block font-bold text-neutral-500">担当業者ID</span>
                        {reservation.vendorId || "未入力"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-xs text-neutral-700 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <span className="font-bold text-neutral-500">希望日:</span>
                        {desiredDateChips(desiredDates)}
                      </div>
                      {order && (
                        <div className="grid gap-1 sm:grid-cols-2">
                          <div>注文日時: {order.orderedAt || "-"}</div>
                          <div>モデル: {order.model || "-"}</div>
                          <div>
                            連絡先: {order.customerPhone || order.customerEmail || "-"}
                          </div>
                          <div>
                            機種: {order.machineMaker || "-"} {order.machineModel || ""}
                          </div>
                        </div>
                      )}
                    </div>
                    {reservation.proposalHistory && (
                      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <div className="mb-1 font-bold text-neutral-500">
                          打診履歴
                        </div>
                        <div className="leading-relaxed text-neutral-700">
                          {reservation.proposalHistory}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <InstallationRowEditor
                  orderId={reservation.orderId}
                  initialStatus={reservation.status}
                  initialConfirmedDate={reservation.confirmedDate}
                  initialVendorId={reservation.vendorId}
                  initialInstalledAt={reservation.installedAt}
                  initialReturnTrackingNumber={reservation.returnTrackingNumber}
                  initialNotes={reservation.notes}
                />
              </div>
            );
          })}
        </div>
      )}

      {!loadError && (
        <p className="mt-8 text-xs leading-relaxed text-neutral-500">
          ※ 取付予約は Stripe 決済成功時(取付サービス利用注文のみ)に「取付予約」シートへ自動 INSERT される。
          担当業者ID は将来「協力業者」シートと連携予定(現状は手入力)。
        </p>
      )}
    </div>
  );
}
