import { Undo2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { Button } from "../ui/Button";
import { ToastSurface } from "../ui/Overlay";
import { useI18n } from "../../lib/i18n";

type UndoToastOptions = {
  message: string;
  undoLabel?: string;
  durationMs?: number;
  onUndo: () => Promise<void> | void;
};

type UndoToastItem = UndoToastOptions & {
  id: number;
};

const UndoToastContext = createContext<((options: UndoToastOptions) => void) | null>(null);

export function UndoToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [item, setItem] = useState<UndoToastItem | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  const showUndoToast = useCallback((options: UndoToastOptions) => {
    setIsHovered(false);
    setIsUndoing(false);
    setItem({ ...options, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!item || isHovered || isUndoing) return;
    const timer = window.setTimeout(() => setItem(null), item.durationMs ?? 10_000);
    return () => window.clearTimeout(timer);
  }, [isHovered, isUndoing, item]);

  const value = useMemo(() => showUndoToast, [showUndoToast]);

  return (
    <UndoToastContext.Provider value={value}>
      {children}
      {item ? (
        <ToastSurface
          className="text-sm font-bold text-zani-text"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <Undo2 size={18} className="shrink-0 text-brand-700" />
          <span className="min-w-0 flex-1">{item.message}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            isLoading={isUndoing}
            onClick={async () => {
              setIsUndoing(true);
              await item.onUndo();
              setItem(null);
              setIsUndoing(false);
            }}
          >
            {item.undoLabel || t("actions.undo")}
          </Button>
          <button
            type="button"
            className="zani-focus-ring rounded-control p-1 text-zani-faint transition hover:bg-surface-muted hover:text-zani-text"
            aria-label={t("common.close")}
            onClick={() => setItem(null)}
          >
            <X size={16} />
          </button>
        </ToastSurface>
      ) : null}
    </UndoToastContext.Provider>
  );
}

export function useUndoToast() {
  const context = useContext(UndoToastContext);
  if (!context) {
    throw new Error("useUndoToast must be used within UndoToastProvider");
  }
  return context;
}
