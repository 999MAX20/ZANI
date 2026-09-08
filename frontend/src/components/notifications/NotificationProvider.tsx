import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { AppError } from "../../api/appError";
import { Button } from "../ui/Button";
import { useI18n } from "../../lib/i18n";
import { StatusNotice, type StatusNoticeTone } from "../ui/StatusNotice";

type NotificationTone = StatusNoticeTone;

export type NotificationOptions = {
  appError?: AppError;
  message?: string;
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

export function ActionFeedbackToast({ item, onDismiss }: { item: NotificationItem; onDismiss: (id: number) => void }) {
  const { t } = useI18n();
  const [isHovered, setIsHovered] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const tone = item.tone || (item.appError ? "danger" : "info");
  const message = item.appError ? t(item.appError.messageKey) : item.message || t("actions.errorGeneric");

  useEffect(() => {
    if (isHovered || isActing) return undefined;
    const timer = window.setTimeout(() => onDismiss(item.id), item.durationMs ?? 5_000);
    return () => window.clearTimeout(timer);
  }, [isActing, isHovered, item.durationMs, item.id, onDismiss]);

  return (
    <StatusNotice
      data-testid="action-feedback"
      compact
      tone={tone}
      title={message}
      className="pointer-events-auto w-[min(360px,calc(100vw-2rem))] shadow-panel backdrop-blur transition"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      ariaLive={tone === "danger" || tone === "warning" ? "assertive" : "polite"}
      action={(
        <button
          type="button"
          className="zani-focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-control text-zani-faint transition hover:bg-surface-card hover:text-zani-text"
          aria-label={t("common.close")}
          onClick={() => onDismiss(item.id)}
        >
          <X size={15} />
        </button>
      )}
      details={item.actionLabel && item.onAction ? (
          <Button
            data-testid="action-feedback-action"
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2 h-8"
            isLoading={isActing}
            onClick={async () => {
              setIsActing(true);
              try {
                await item.onAction?.();
              } catch {
                // The mutation owns the follow-up error notification. Keep the
                // retry control recoverable and avoid an unhandled rejection.
              } finally {
                onDismiss(item.id);
                setIsActing(false);
              }
            }}
          >
            {item.actionLabel}
          </Button>
      ) : null}
    />
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
          <ActionFeedbackToast key={item.id} item={item} onDismiss={dismiss} />
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
