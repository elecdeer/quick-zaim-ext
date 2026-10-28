import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // 枠の代わりに下線だけを引き、入力中は下線を太くする（docs/design.md）。太さは影で足して、高さを変えない
        "h-8 w-full min-w-0 rounded-none border-0 border-b border-foreground/40 bg-transparent px-0 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-foreground focus-visible:border-foreground focus-visible:shadow-[inset_0_-1px_0_var(--foreground)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:shadow-[inset_0_-1px_0_var(--destructive)] md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
