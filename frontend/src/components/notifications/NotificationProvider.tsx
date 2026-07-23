import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

type NotificationTone = "success" | "info" | "warning" | "danger";

type NotificationOptions = {
  message: string;
  tone?: NotificationTone;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => Promise<void> | void;
};

type NotificationItem = NotificationOptions & {
  id: number;
  createdAt: number;
};

const NotificationContext = createContext<((options: NotificationOptions) => void) | null>(null);

const toneStyles: Record<NotificationTone, { icon: typeof Info; iconClassName: string; className: string }> = {
  success: {
    icon: CheckCircle2,
    iconClassName: "text-zani-success",
    className: "border-[rgba(21,128,61,0.18)] bg-[var(--zani-success-soft)] text-zani-text",
  },
  info: {
    icon: Info,
    iconClassName: "text-brand-600",
    className: "border-brand-100 bg-brand-50 text-zani-text",
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: "text-zani-warning",
    className: "border-[rgba(183,121,31,0.22)] bg-[var(--zani-warning-soft)] text-zani-text",
  },
  danger: {
    icon: XCircle,
    iconClassName: "text-zani-danger",
    className: "border-[rgba(194,65,12,0.2)] bg-[var(--zani-danger-soft)] text-zani-text",
  },
};

function NotificationCard({ item, onDismiss }: { item: NotificationItem; onDismiss: (id: number) => void }) {
  const { t } = useI18n();
  const [isHovered, setIsHovered] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const tone = item.tone || "info";
  const style = toneStyles[tone];
  const Icon = style.icon;

  useEffect(() => {
    if (isHovered || isActing) return undefined;
    const timer = window.setTimeout(() => onDismiss(item.id), item.durationMs ?? 5_000);
    return () => window.clearTimeout(timer);
  }, [isActing, isHovered, item.durationMs, item.id, onDismiss]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-card border px-4 py-3 text-sm font-semibold shadow-panel backdrop-blur transition",
        style.className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      aria-live={tone === "danger" || tone === "warning" ? "assertive" : "polite"}
    >
      <Icon size={18} className={cn("mt-0.5 shrink-0", style.iconClassName)} />
      <div className="min-w-0 flex-1">
        <p className="leading-5">{item.message}</p>
        {item.actionLabel && item.onAction ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2 h-8"
            isLoading={isActing}
            onClick={async () => {
              setIsActing(true);
              await item.onAction?.();
              onDismiss(item.id);
              setIsActing(false);
            }}
          >
            {item.actionLabel}
          </Button>
        ) : null}
      </div>
      <button
        type="button"
        className="zani-focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-control text-zani-faint transition hover:bg-surface-card hover:text-zani-text"
        aria-label={t("common.close")}
        onClick={() => onDismiss(item.id)}
      >
        <X size={15} />
      </button>
    </div>
  );
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const showNotification = useCallback((options: NotificationOptions) => {
    setItems((current) =>
      [
        {
          ...options,
          id: Date.now() + Math.floor(Math.random() * 1000),
          createdAt: Date.now(),
        },
        ...current,
      ].slice(0, 4),
    );
  }, []);

  const value = useMemo(() => showNotification, [showNotification]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 right-5 flex max-h-[calc(100dvh-8rem)] flex-col-reverse items-end gap-2 overflow-y-auto"
        style={{ zIndex: "var(--zani-z-toast)" }}
      >
        {items.map((item) => (
          <NotificationCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
}
