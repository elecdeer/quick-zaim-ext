import "../src/styles.css";
import { Link, useRouter, useShared } from "@void/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "集計" },
  { href: "/transactions", label: "取引" },
  { href: "/accounts", label: "口座" },
  { href: "/receipts/new", label: "レシート" },
] as const;

/**
 * パスがナビゲーションの項目の下にあれば true を返す。
 */
const isActive = (path: string, href: string): boolean =>
  href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);

/**
 * 台帳の画面に共通のヘッダー（ナビゲーションとログイン中のユーザー）。
 *
 * ヘッダーも本文と同じ 12 列のグリッドに載せ、ナビを本文の中身の列（右の 9 列）にそろえる。
 */
const Layout = ({ children }: { children: ReactNode }) => {
  const { email } = useShared();
  const { path } = useRouter();

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="mx-auto grid max-w-5xl grid-cols-[auto_1fr] items-end gap-x-4 px-4 pt-3 md:grid-cols-12">
          <span className="pb-2 text-sm font-semibold md:col-span-3">台帳</span>
          <div className="flex items-end gap-6 md:col-span-9">
            <nav className="flex gap-6">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "-mb-px border-b-2 border-transparent pb-2 text-sm text-muted-foreground hover:text-foreground",
                    isActive(path, item.href) && "border-primary font-medium text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-4 pb-2 text-xs text-muted-foreground">
              <span className="hidden sm:inline">{email}</span>
              <a href="/logout" className="hover:text-foreground">
                ログアウト
              </a>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
};

export default Layout;
