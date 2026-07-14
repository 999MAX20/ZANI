import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { HTMLAttributes, useEffect, useId } from "react";

import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

type OverlaySize = "sm" | "md" | "lg" | "xl";

const dialogSizeClass: Record<OverlaySize, string> = {
  sm: "max-w-lg",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
};

function useEscapeClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);
}

function CloseButton({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="zani-touch-target inline-flex shrink-0 items-center justify-center rounded-control text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
      onClick={onClose}
      aria-label={t("common.close")}
    >
      <X size={20} strokeWidth={2.2} />
    </button>
  );
}

export function Dialog({
  title,
  open,
  onClose,
  children,
  size = "md",
  className,
  bodyClassName,
  closeOnBackdrop = true,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: OverlaySize;
  className?: string;
  bodyClassName?: string;
  closeOnBackdrop?: boolean;
}) {
  const titleId = useId();
  useBodyScrollLock(open);
  useEscapeClose(open, onClose);

  if (!open) return null;

  return createPortal(
    <div
      className="zani-overlay-backdrop fixed inset-0 grid place-items-center p-3 sm:p-5"
      style={{ zIndex: "var(--zani-z-modal)" }}
      onMouseDown={closeOnBackdrop ? onClose : undefined}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "zani-dialog-surface flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden sm:max-h-[90vh]",
          dialogSizeClass[size],
          className,
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-5">
          <h2 id={titleId} className="min-w-0 truncate text-lg font-semibold text-midnight">
            {title}
          </h2>
          <CloseButton onClose={onClose} />
        </header>
        <div className={cn("min-h-0 flex-1 overflow-auto bg-slate-50 p-4 sm:p-5", bodyClassName)}>{children}</div>
      </section>
    </div>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  children,
  titleId,
  className,
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  titleId?: string;
  className?: string;
  closeOnBackdrop?: boolean;
}) {
  useBodyScrollLock(open);
  useEscapeClose(open, onClose);

  if (!open) return null;

  return createPortal(
    <div
      className="zani-overlay-backdrop fixed inset-0"
      style={{ zIndex: "var(--zani-z-drawer)" }}
      onMouseDown={closeOnBackdrop ? onClose : undefined}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn("zani-drawer-surface ml-auto flex h-full w-full max-w-3xl flex-col overflow-hidden sm:rounded-l-[16px]", className)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </aside>
    </div>,
    document.body,
  );
}

export function PopoverSurface({ children, className, ...props }: HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  return (
    <div className={cn("zani-popover-surface", className)} {...props}>
      {children}
    </div>
  );
}

export function ToastSurface({
  children,
  className,
  onMouseEnter,
  onMouseLeave,
}: {
  children: React.ReactNode;
  className?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return createPortal(
    <div
      className={cn("zani-toast-surface fixed bottom-5 right-5 flex max-w-sm items-center gap-3 px-4 py-3", className)}
      style={{ zIndex: "var(--zani-z-toast)" }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>,
    document.body,
  );
}
