"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  hiddenClass?: string;
  isActive: (pathname: string) => boolean;
}

const navItems: NavItem[] = [
  {
    href: "/order",
    label: "注文する",
    isActive: (pathname) => pathname === "/order" || pathname.startsWith("/order/"),
  },
  {
    href: "/coverage",
    label: "基地局カバー",
    hiddenClass: "hidden sm:inline",
    isActive: (pathname) =>
      pathname === "/coverage" || pathname.startsWith("/coverage/"),
  },
  {
    href: "/orders/cancel",
    label: "注文キャンセル",
    hiddenClass: "hidden sm:inline",
    isActive: (pathname) =>
      pathname === "/orders/cancel" || pathname.startsWith("/orders/cancel/"),
  },
  {
    href: "/legal",
    label: "特定商取引法に基づく表記",
    hiddenClass: "hidden md:inline",
    isActive: (pathname) => pathname === "/legal" || pathname.startsWith("/legal/"),
  },
];

function navLinkClass(active: boolean, hiddenClass = ""): string {
  return [
    hiddenClass,
    "text-sm transition-colors",
    active
      ? "font-bold text-[#0b806b]"
      : "font-semibold text-[#607069] hover:text-[#0b806b]",
  ]
    .filter(Boolean)
    .join(" ");
}

export default function Header() {
  const pathname = usePathname();
  const partnerActive =
    pathname === "/partner" ||
    pathname.startsWith("/partner/") ||
    pathname === "/dealer" ||
    pathname.startsWith("/dealer/");

  return (
    <header className="sticky top-0 z-50 border-b border-[#eadfce] bg-[#fbf7ef]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="E-FIX ホーム">
          <span className="text-2xl font-black tracking-widest text-[#0b5c50]">
            E-FIX
          </span>
          <span className="hidden sm:block text-xs text-[#607069] border-l border-[#d8c9aa] pl-2 leading-tight">
            電動ステアリング
            <br />
            システム
          </span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5">
          {navItems.map((item) => {
            const active = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={navLinkClass(active, item.hiddenClass)}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/partner/login"
            aria-current={partnerActive ? "page" : undefined}
            className={[
              "rounded-lg border border-[#0b806b]/50 px-3 py-2 text-xs font-bold transition-colors sm:text-sm",
              partnerActive
                ? "bg-[#0b806b] text-white"
                : "bg-white text-[#0b806b] hover:bg-[#0b806b] hover:text-white",
            ].join(" ")}
          >
            販売店ログイン
          </Link>
        </nav>
      </div>
    </header>
  );
}
