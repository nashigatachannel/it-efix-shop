"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

type NavItem = {
  href: string;
  label: string;
  icon:
    | "grid"
    | "cart"
    | "calendar"
    | "box"
    | "globe"
    | "tag"
    | "user"
    | "stack"
    | "settings"
    | "file";
  match?: string[];
};

const topNavItems: NavItem[] = [
  { href: "/admin", label: "管理トップ", icon: "grid", match: ["/admin", "/admin/catalog"] },
  {
    href: "/admin/web-orders",
    label: "Web注文",
    icon: "cart",
    match: ["/admin/web-orders"],
  },
  {
    href: "/admin/installations",
    label: "取付予約",
    icon: "calendar",
    match: ["/admin/installations"],
  },
  {
    href: "/admin/wholesale",
    label: "卸注文",
    icon: "box",
    match: ["/admin/wholesale"],
  },
  {
    href: "/admin/hotta",
    label: "堀田機工",
    icon: "file",
    match: ["/admin/hotta"],
  },
];

const sideNavItems: NavItem[] = [
  {
    href: "/admin/catalog/web",
    label: "Web販売管理",
    icon: "globe",
    match: ["/admin/catalog/web"],
  },
  {
    href: "/admin/products",
    label: "商品管理",
    icon: "tag",
    match: [
      "/admin/products",
      "/admin/catalog/wholesale",
      "/admin/catalog/special-wholesale",
    ],
  },
  {
    href: "/admin/web-orders",
    label: "注文管理（Web）",
    icon: "cart",
    match: ["/admin/web-orders"],
  },
  {
    href: "/admin/installations",
    label: "取付予約",
    icon: "calendar",
    match: ["/admin/installations"],
  },
  {
    href: "/admin/wholesale",
    label: "注文管理（卸）",
    icon: "box",
    match: ["/admin/wholesale"],
  },
  {
    href: "/admin/hotta",
    label: "堀田機工",
    icon: "file",
    match: ["/admin/hotta"],
  },
  { href: "/admin/customers", label: "顧客管理", icon: "user" },
  { href: "/admin/pay-links", label: "請求書カード払い", icon: "tag" },
  { href: "/admin/inventory", label: "在庫管理", icon: "stack" },
  { href: "/admin/settings", label: "設定", icon: "settings" },
  { href: "/admin/logs", label: "ログ管理", icon: "file" },
];

function isActive(pathname: string, item: NavItem): boolean {
  const matches = item.match ?? [item.href];
  return matches.some((match) =>
    match === "/admin" ? pathname === "/admin" : pathname.startsWith(match),
  );
}

function AdminIcon({ name, className = "" }: { name: NavItem["icon"]; className?: string }) {
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
  };

  if (name === "grid") {
    return (
      <svg {...common}>
        <path d="M4 4h6v6H4z" />
        <path d="M14 4h6v6h-6z" />
        <path d="M4 14h6v6H4z" />
        <path d="M14 14h6v6h-6z" />
      </svg>
    );
  }
  if (name === "cart") {
    return (
      <svg {...common}>
        <path d="M6 6h15l-2 8H8L6 3H3" />
        <path d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
        <path d="M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      </svg>
    );
  }
  if (name === "calendar") {
    return (
      <svg {...common}>
        <path d="M8 3v4" />
        <path d="M16 3v4" />
        <path d="M4 9h16" />
        <path d="M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
        <path d="M8 13h.01" />
        <path d="M12 13h.01" />
        <path d="M16 13h.01" />
        <path d="M8 17h.01" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  if (name === "box") {
    return (
      <svg {...common}>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4 7.5 8 4.5 8-4.5" />
        <path d="M12 12v9" />
      </svg>
    );
  }
  if (name === "globe") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21" />
        <path d="M12 3c-2.5 2.7-3.8 5.7-3.8 9S9.5 18.3 12 21" />
      </svg>
    );
  }
  if (name === "tag") {
    return (
      <svg {...common}>
        <path d="M20 13 13 20 4 11V4h7l9 9Z" />
        <path d="M7.5 7.5h.01" />
      </svg>
    );
  }
  if (name === "user") {
    return (
      <svg {...common}>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="8" r="4" />
      </svg>
    );
  }
  if (name === "stack") {
    return (
      <svg {...common}>
        <path d="m12 3 8 4-8 4-8-4 8-4Z" />
        <path d="m4 12 8 4 8-4" />
        <path d="m4 17 8 4 8-4" />
      </svg>
    );
  }
  if (name === "settings") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.8 1.8 0 0 0-2.1.1 7 7 0 0 1-1.7.7 1.8 1.8 0 0 0-1.4 1.6V23H8v-.3a1.8 1.8 0 0 0-1.3-1.6 7 7 0 0 1-1.7-.7 1.8 1.8 0 0 0-2.1-.1l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 1.1 15a7 7 0 0 1 0-2 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1A1.8 1.8 0 0 0 5 7.6a7 7 0 0 1 1.7-.7A1.8 1.8 0 0 0 8 5.3V5h4.4v.3a1.8 1.8 0 0 0 1.4 1.6 7 7 0 0 1 1.7.7 1.8 1.8 0 0 0 2.1.1l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9 7 7 0 0 1 0 2Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-neutral-900">
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white shadow-sm">
        <div className="grid min-h-16 grid-cols-[160px_1fr_auto] lg:grid-cols-[190px_1fr_auto]">
          <Link
            href="/admin"
            className="flex items-center border-r border-neutral-200 px-5"
            aria-label="管理画面トップ"
          >
            <span className="text-3xl font-black tracking-widest text-[#c89518]">
              E-FIX
            </span>
          </Link>
          <nav className="flex min-w-0 items-stretch overflow-x-auto">
            {topNavItems.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-w-fit items-center gap-3 px-5 text-sm font-bold transition ${
                    active
                      ? "bg-[#d1a227] text-white"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-[#c89518]"
                  }`}
                >
                  <AdminIcon name={item.icon} className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center px-5">
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden min-h-[calc(100vh-4rem)] w-[190px] shrink-0 border-r border-neutral-200 bg-white px-2 py-6 shadow-sm lg:block">
          <nav className="space-y-2">
            {sideNavItems.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm font-bold transition ${
                    active
                      ? "bg-[#d1a227] text-white shadow-sm"
                      : "text-neutral-700 hover:bg-[#fbf4df] hover:text-[#a77806]"
                  }`}
                >
                  <AdminIcon name={item.icon} className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
