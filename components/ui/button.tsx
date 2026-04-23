import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[linear-gradient(135deg,#fb923c_0%,#facc15_58%,#fde047_100%)] text-slate-950 shadow-[0_16px_44px_rgba(251,146,60,0.34)] hover:-translate-y-px hover:brightness-105",
  secondary:
    "border border-white/14 bg-[linear-gradient(180deg,rgba(45,56,79,0.96),rgba(27,35,52,0.96))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-white/22 hover:bg-[linear-gradient(180deg,rgba(54,66,91,0.98),rgba(33,41,61,0.98))]",
  ghost:
    "border border-transparent bg-transparent text-slate-200 hover:border-white/10 hover:bg-white/7",
  danger: "bg-rose-500/90 text-white shadow-[0_14px_36px_rgba(244,63,94,0.2)] hover:bg-rose-500",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-2xl font-medium transition duration-200 disabled:cursor-not-allowed disabled:opacity-60",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    />
  );
}
