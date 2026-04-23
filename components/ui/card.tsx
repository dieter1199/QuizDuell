import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(17,25,43,0.96),rgba(10,16,29,0.92))] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.44),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  );
}
