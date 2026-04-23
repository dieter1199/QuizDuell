import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "warm" | "cool" | "danger" | "muted";
};

const toneStyles: Record<NonNullable<BadgeProps["tone"]>, string> = {
  warm: "border-amber-300/25 bg-amber-400/10 text-amber-100",
  cool: "border-sky-300/25 bg-sky-400/10 text-sky-100",
  danger: "border-rose-300/25 bg-rose-400/10 text-rose-100",
  muted: "border-white/10 bg-white/6 text-slate-300",
};

export function Badge({ className, tone = "muted", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide",
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  );
}
