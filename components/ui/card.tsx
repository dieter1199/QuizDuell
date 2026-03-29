import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(15,23,42,0.7))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  );
}
