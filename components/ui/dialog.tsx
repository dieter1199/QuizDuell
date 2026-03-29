import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose?: () => void;
  children: ReactNode;
};

export function Dialog({ open, title, description, onClose, children }: DialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 w-full max-w-2xl rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#101b32,#0c1324)] p-6 shadow-[0_25px_80px_rgba(2,6,23,0.65)]",
        )}
      >
        <div className="mb-5">
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          {description ? <p className="mt-2 text-sm text-slate-300">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
