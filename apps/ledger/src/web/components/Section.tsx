import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 見出しを左の 3 列、中身を右の 9 列に置くまとまり。狭い画面では見出しを中身の上に積む。
 */
export const Section = ({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section className={cn("grid gap-x-4 gap-y-2 md:grid-cols-12", className)}>
    <div className="text-sm font-medium md:col-span-3">{label}</div>
    <div className="min-w-0 md:col-span-9">{children}</div>
  </section>
);
