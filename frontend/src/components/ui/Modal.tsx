import { X } from "lucide-react";
import { createPortal } from "react-dom";

import { Button } from "./Button";
import { useI18n } from "../../lib/i18n";

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
  const { t } = useI18n();
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5">
      <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-auto rounded-3xl border border-white/80 bg-white shadow-premium sm:max-h-[90vh]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3 sm:px-5 sm:py-4">
          <h2 className="min-w-0 truncate text-base font-black text-ink sm:text-lg">{title}</h2>
          <Button type="button" variant="ghost" className="h-12 w-12 rounded-full px-0" onClick={onClose} aria-label={t("common.close")}>
            <X size={26} strokeWidth={2.4} />
          </Button>
        </div>
        <div className="bg-slate-50/55 p-4 sm:p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
