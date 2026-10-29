import "../src/styles.css";
import { Link, useNavigation, useRouter, useShared } from "@void/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { isActive, isNavigating, navPath } from "../src/web/nav.ts";

const NAV_ITEMS = [
  { href: "/", label: "集計" },
  { href: "/transactions", label: "取引" },
  { href: "/accounts", label: "口座" },
] as const;

/**
 * 台帳の画面に共通のヘッダー（ナビゲーションとログイン中のユーザー）。
 *
 * ヘッダーも本文と同じ 12 列のグリッドに載せ、ナビを本文の中身の列（右の 9 列）にそろえる。
 * 画面の移動中は前の画面が残るので、ヘッダーの上端に進行バーを出し、押したタブにすぐ下線を移す。
 */
const Layout = ({ children }: { children: ReactNode }) => {
  const { email } = useShared();
  const { path } = useRouter();
  const navigation = useNavigation();
  const activePath = navPath(path, navigation);

  return (
    <div className="min-h-dvh bg-background">
      <header className="relative border-b">
        {isNavigating(navigation) && (
          // 支援技術には main の aria-busy で伝えるので、バーは飾りとして隠す。
          // <progress> は不定の進み具合を左右に流す見た目にしにくいので使わない
          <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
            <div className="nav-progress h-full w-1/3 bg-foreground" />
          </div>
        )}
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
                    isActive(activePath, item.href) && "border-primary font-medium text-foreground",
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
      <main aria-busy={isNavigating(navigation)} className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
