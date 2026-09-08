import { X } from "lucide-react";
import { useCallback, useEffect, useId, type ReactNode } from "react";

import { useMediaQuery } from "../../hooks/useMediaQuery";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { Drawer } from "../ui/Overlay";

type InspectorRenderer = (options: {
  isDesktop: boolean;
  onClose: () => void;
}) => ReactNode;

function focusVisibleReturnTarget(focusReturnId?: string) {
  if (!focusReturnId) return;
  window.requestAnimationFrame(() => {
    const target = Array.from(
      document.querySelectorAll<HTMLElement>(
        `[data-focus-return-id="${CSS.escape(focusReturnId)}"]`,
      ),
    ).find((element) => element.getClientRects().length > 0);
    target?.focus({ preventScroll: true });
  });
}

export function OperationalWorkspace({
  main,
  inspector,
  inspectorOpen,
  inspectorTitleId,
  inspectorAriaLabel,
  focusReturnId,
  focusInspectorRequestKey,
  onInspectorClose,
  className,
  inspectorColumnClassName = "2xl:grid-cols-[minmax(0,1fr)_420px]",
  testId,
}: {
  main: ReactNode;
  inspector: InspectorRenderer;
  inspectorOpen: boolean;
  inspectorTitleId?: string;
  inspectorAriaLabel?: string;
  focusReturnId?: string;
  focusInspectorRequestKey?: number;
  onInspectorClose: () => boolean | void | Promise<boolean | void>;
  className?: string;
  inspectorColumnClassName?: string;
  testId?: string;
}) {
  const isDesktop = useMediaQuery("(min-width: 1536px)");

  useEffect(() => {
    if (!isDesktop || !inspectorOpen || !inspectorTitleId || focusInspectorRequestKey === undefined) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      document.getElementById(inspectorTitleId)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [focusInspectorRequestKey, inspectorOpen, inspectorTitleId, isDesktop]);

  const closeInspector = useCallback(async () => {
    if (await onInspectorClose() === false) return;
    focusVisibleReturnTarget(focusReturnId);
  }, [focusReturnId, onInspectorClose]);

  return (
    <div
      className={cn(
        "grid min-h-0 w-full flex-1 grid-cols-1 gap-4",
        inspectorOpen && inspectorColumnClassName,
        className,
      )}
      data-testid={testId}
    >
      <div className="min-h-0 min-w-0">{main}</div>

      {isDesktop && inspectorOpen ? (
        <aside className="min-h-0" aria-labelledby={inspectorTitleId} aria-label={inspectorTitleId ? undefined : inspectorAriaLabel}>
          {inspector({ isDesktop: true, onClose: closeInspector })}
        </aside>
      ) : null}

      {!isDesktop ? (
        <Drawer
          open={inspectorOpen}
          onClose={closeInspector}
          titleId={inspectorTitleId}
          ariaLabel={inspectorTitleId ? undefined : inspectorAriaLabel}
          size="detail"
          testId="operational-inspector-drawer"
        >
          {inspector({ isDesktop: false, onClose: closeInspector })}
        </Drawer>
      ) : null}
    </div>
  );
}

export function OperationalInspector({
  title,
  titleId,
  badge,
  subtitle,
  onClose,
  children,
  footer,
  className,
  testId,
}: {
  title: string;
  titleId?: string;
  badge?: ReactNode;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  testId?: string;
}) {
  const { t } = useI18n();
  const generatedTitleId = useId();
  const resolvedTitleId = titleId || generatedTitleId;

  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-zani-border bg-surface-card shadow-card",
        className,
      )}
      data-testid={testId}
      aria-labelledby={resolvedTitleId}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-zani-border px-4 py-4">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 id={resolvedTitleId} tabIndex={-1} className="min-w-0 truncate text-lg font-semibold text-zani-ink">{title}</h2>
            {badge}
          </div>
          {subtitle ? <p className="mt-1 text-sm font-medium leading-5 text-zani-subtle">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          className="zani-focus-ring zani-touch-target inline-grid shrink-0 place-items-center rounded-control text-zani-faint transition hover:bg-surface-muted hover:text-zani-text"
          aria-label={t("common.close")}
          onClick={onClose}
        >
          <X aria-hidden="true" size={19} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-warm p-4">{children}</div>
      {footer ? <footer className="shrink-0 border-t border-zani-border bg-surface-card px-4 py-3">{footer}</footer> : null}
    </section>
  );
}
