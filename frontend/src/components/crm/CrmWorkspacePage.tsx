import { Children, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

export function CrmWorkspacePage({
  children,
  className,
  contentClassName,
  maxWidthClassName = "max-w-[1480px]",
  testId,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidthClassName?: string;
  testId?: string;
}) {
  return (
    <section
      className={cn("flex h-[calc(100vh-5.5rem)] min-h-[620px] w-full flex-col bg-surface px-3 py-3 sm:px-4", className)}
      data-testid={testId}
    >
      <div className={cn("mx-auto flex min-h-0 w-full flex-1 flex-col", maxWidthClassName, contentClassName)}>
        {children}
      </div>
    </section>
  );
}

export function CrmWorkspaceGrid({
  children,
  inspectorOpen,
  className,
  inspectorColumnClassName = "clamp(320px,23vw,372px)",
}: {
  children: ReactNode;
  inspectorOpen?: boolean;
  className?: string;
  inspectorColumnClassName?: string;
}) {
  const { t } = useI18n();
  const [inspectorVisible, setInspectorVisible] = useState(Boolean(inspectorOpen));
  const items = Children.toArray(children);
  const primaryContent = items[0] || null;
  const inspectorContent = items[1] || null;
  const showInspector = Boolean(inspectorOpen && inspectorVisible && inspectorContent);
  const inspectorStyle = inspectorOpen ? ({ "--crm-inspector-column": inspectorColumnClassName } as CSSProperties & Record<string, string>) : undefined;

  useEffect(() => {
    if (inspectorOpen) setInspectorVisible(true);
    else setInspectorVisible(false);
  }, [inspectorOpen]);

  return (
    <div
      className={cn("relative grid min-h-0 w-full flex-1 grid-cols-1 gap-4", showInspector && "2xl:grid-cols-[minmax(0,1fr)_var(--crm-inspector-column)]", className)}
      style={inspectorStyle}
    >
      {primaryContent}
      {inspectorOpen && inspectorContent ? (
        showInspector ? (
          <>
            <button
              type="button"
              className="fixed inset-0 top-16 z-40 bg-black/20 2xl:hidden"
              aria-label={t("common.close")}
              onClick={() => setInspectorVisible(false)}
            />
            <div className="fixed bottom-4 right-4 top-20 z-50 min-h-0 w-[min(380px,calc(100vw-2rem))] 2xl:static 2xl:z-auto 2xl:w-auto">
              <button
                type="button"
                className="zani-focus-ring absolute right-2 top-2 z-20 grid h-9 w-9 place-items-center rounded-control bg-surface-card text-zani-subtle shadow-card hover:text-zani-text"
                aria-label={t("crmCard.closeInspector")}
                onClick={() => setInspectorVisible(false)}
              >
                <PanelRightClose size={18} />
              </button>
              {inspectorContent}
            </div>
          </>
        ) : (
          <button
            type="button"
            className="zani-focus-ring absolute right-3 top-3 z-20 inline-flex h-9 items-center gap-2 rounded-control border border-zani-border bg-surface-card px-3 text-xs font-bold text-zani-subtle shadow-card hover:text-zani-text"
            aria-label={t("crmCard.openInspector")}
            onClick={() => setInspectorVisible(true)}
          >
            <PanelRightOpen size={17} />
            <span className="hidden sm:inline">{t("crmCard.context")}</span>
          </button>
        )
      ) : null}
    </div>
  );
}
