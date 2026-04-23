import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "warm" | "cool" | "danger" | "muted";
};

const toneStyles: Record<NonNullable<BadgeProps["tone"]>, string> = {
  warm: "border-amber-300/35 bg-amber-400/18 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  cool: "border-sky-300/35 bg-sky-400/16 text-sky-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  danger: "border-rose-300/30 bg-rose-400/16 text-rose-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  muted:
    "border-white/12 bg-[linear-gradient(180deg,rgba(43,53,74,0.92),rgba(29,37,54,0.92))] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
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
