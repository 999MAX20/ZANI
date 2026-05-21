import { X } from "lucide-react";

import { Button } from "./Button";

export function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-2 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="glass-panel max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-auto rounded-3xl sm:max-h-[90vh]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-5 sm:py-4">
          <h2 className="min-w-0 truncate text-base font-semibold text-ink sm:text-lg">{title}</h2>
          <Button type="button" variant="ghost" className="h-12 w-12 rounded-full px-0" onClick={onClose} aria-label="Закрыть">
            <X size={26} strokeWidth={2.4} />
          </Button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
