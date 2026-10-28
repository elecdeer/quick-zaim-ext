import "../src/styles.css";
import { Link, useRouter, useShared } from "@void/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "集計" },
  { href: "/transactions", label: "取引" },
  { href: "/accounts", label: "口座" },
] as const;

/**
 * パスがナビゲーションの項目の下にあれば true を返す。
 */
const isActive = (path: string, href: string): boolean =>
  href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);

/**
 * 台帳の画面に共通のヘッダー（ナビゲーションとログイン中のユーザー）。
 */
const Layout = ({ children }: { children: ReactNode }) => {
  const { email } = useShared();
  const { path } = useRouter();

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-2">
          <span className="font-semibold">台帳</span>
          <nav className="flex gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted",
                  isActive(path, item.href) && "bg-muted font-medium text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span className="hidden sm:inline">{email}</span>
            <a href="/logout" className="hover:text-foreground hover:underline">
              ログアウト
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
};

export default Layout;
