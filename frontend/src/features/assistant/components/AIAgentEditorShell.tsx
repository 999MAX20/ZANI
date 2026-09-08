import { Bot, MessageSquareText } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Switch } from "../../../components/ui/Switch";
import { Tabs } from "../../../components/ui/Tabs";
import { useI18n } from "../../../lib/i18n";
import type { AgentProfile, Bot as BotType } from "../../../types";
import type { AgentSection } from "../aiAgentsTypes";
import { sections } from "../aiAgentsUtils";

type SaveState = "idle" | "saved";

function statusVariant(status: BotType["status"]) {
  if (status === "active") return "success" as const;
  if (status === "paused") return "warning" as const;
  return "neutral" as const;
}

export function AIAgentEditorShell({
  bot,
  profile,
  activeSection,
  canManage,
  dirty,
  saveDisabled,
  isSaving,
  saveState,
  onSectionChange,
  onToggleStatus,
  onOpenMessages,
  onReset,
  onSave,
  children,
}: {
  bot: BotType;
  profile: AgentProfile | null;
  activeSection: AgentSection;
  canManage: boolean;
  dirty: boolean;
  saveDisabled?: boolean;
  isSaving: boolean;
  saveState: SaveState;
  onSectionChange: (section: AgentSection) => void;
  onToggleStatus: (active: boolean) => void;
  onOpenMessages: () => void;
  onReset: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const statusLabel = t(`aiAgents.status.${bot.status}`);

  return (
    <section
      className="flex min-h-[680px] min-w-0 flex-col overflow-hidden rounded-card border border-zani-border bg-surface-card shadow-card lg:min-h-0"
      aria-label={t("aiAgents.editorAria", { name: bot.name })}
      data-testid="ai-agent-editor"
    >
      <header className="shrink-0 border-b border-zani-border bg-surface-card px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-control bg-ai-50 text-ai-700 ring-1 ring-ai-100">
              <Bot aria-hidden="true" size={23} />
            </span>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="min-w-0 truncate text-xl font-semibold text-zani-ink">{bot.name}</h2>
                <Badge size="sm" variant={statusVariant(bot.status)}>{statusLabel}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 max-w-3xl text-sm font-medium leading-5 text-zani-subtle">
                {profile?.role_description || t("aiAgents.purposeMissing")}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={onOpenMessages}>
              <MessageSquareText aria-hidden="true" size={16} />
              {t("aiAgents.openMessages")}
            </Button>
            <div className="flex min-h-9 items-center gap-2 rounded-control border border-zani-border bg-surface-warm px-3">
              <span className="text-xs font-semibold text-zani-subtle">{statusLabel}</span>
              <Switch
                checked={bot.status === "active"}
                disabled={!canManage}
                isLoading={isSaving}
                label={t("aiAgents.statusSwitch", { name: bot.name })}
                onChange={onToggleStatus}
                size="dense"
                tone="ai"
              />
            </div>
          </div>
        </div>

        <Tabs
          ariaLabel={t("aiAgents.editorTabsAria")}
          className="mt-4 bg-transparent p-0"
          tone="ai"
          value={activeSection}
          onChange={onSectionChange}
          options={sections.map((section) => ({
            value: section.id,
            label: t(section.labelKey),
          }))}
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-warm p-3 sm:p-4">
        <div className="mx-auto w-full max-w-[1080px]">{children}</div>
      </div>

      {canManage ? (
        <footer className="flex shrink-0 flex-col gap-3 border-t border-zani-border bg-surface-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="min-h-5 text-xs font-medium text-zani-subtle" aria-live="polite">
            {dirty
              ? t("aiAgents.unsavedIndicator")
              : saveState === "saved"
                ? t("aiAgents.savedIndicator")
                : ""}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button type="button" variant="secondary" disabled={!dirty || isSaving} onClick={onReset}>
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={!dirty || saveDisabled} isLoading={isSaving} onClick={onSave}>
              {t("aiAgents.saveChanges")}
            </Button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}
