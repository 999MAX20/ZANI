import { Bot, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { Badge } from "../../../components/ui/Badge";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { cn } from "../../../lib/cn";
import { useI18n } from "../../../lib/i18n";
import type { AgentProfile, Bot as BotType, Id } from "../../../types";
import type { AgentSection } from "../aiAgentsTypes";

type AgentStatusFilter = "all" | BotType["status"];

function statusVariant(status: BotType["status"]) {
  if (status === "active") return "success" as const;
  if (status === "paused") return "warning" as const;
  return "neutral" as const;
}

export function AIAgentsListPane({
  bots,
  profiles,
  selectedBotId,
  activeSection,
}: {
  bots: BotType[];
  profiles: AgentProfile[];
  selectedBotId?: Id | null;
  activeSection: AgentSection;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AgentStatusFilter>("all");
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const profileByBot = useMemo(
    () => new Map(profiles.filter((profile) => profile.bot).map((profile) => [profile.bot, profile])),
    [profiles],
  );
  const filteredBots = useMemo(
    () => bots.filter((bot) => {
      const profile = profileByBot.get(bot.id);
      const matchesStatus = status === "all" || bot.status === status;
      const matchesQuery = !normalizedQuery
        || bot.name.toLocaleLowerCase().includes(normalizedQuery)
        || profile?.role_description.toLocaleLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    }),
    [bots, normalizedQuery, profileByBot, status],
  );

  return (
    <aside className="flex min-h-[240px] max-h-[340px] flex-col overflow-hidden rounded-card border border-zani-border bg-surface-card shadow-card lg:min-h-0 lg:max-h-none">
      <div className="grid shrink-0 gap-2 border-b border-zani-border p-3 sm:grid-cols-[minmax(0,1fr)_180px] lg:grid-cols-1">
        <Input
          aria-label={t("aiAgents.searchPlaceholder")}
          leftIcon={<Search size={17} />}
          placeholder={t("aiAgents.searchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          aria-label={t("aiAgents.filterStatus")}
          value={status}
          onChange={(event) => setStatus(event.target.value as AgentStatusFilter)}
          options={[
            { value: "all", label: t("aiAgents.allStatuses") },
            { value: "active", label: t("aiAgents.status.active") },
            { value: "paused", label: t("aiAgents.status.paused") },
            { value: "draft", label: t("aiAgents.status.draft") },
          ]}
        />
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label={t("aiAgents.agentListAria")}>
        <div className="space-y-1.5">
          {filteredBots.map((bot) => {
            const profile = profileByBot.get(bot.id);
            const selected = bot.id === selectedBotId;
            return (
              <Link
                key={bot.id}
                to={`/app/ai-agents/${bot.id}/${activeSection}`}
                aria-current={selected ? "page" : undefined}
                data-focus-return-id={`ai-agent-${bot.id}`}
                className={cn(
                  "zani-focus-ring group flex min-h-[76px] items-start gap-3 rounded-control border px-3 py-3 transition",
                  selected
                    ? "border-ai-200 bg-ai-50 shadow-sm"
                    : "border-transparent bg-surface-card hover:border-zani-border hover:bg-surface-warm",
                )}
              >
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-control ring-1",
                    selected ? "bg-white text-ai-700 ring-ai-100" : "bg-surface-muted text-zani-faint ring-zani-border",
                  )}
                >
                  <Bot aria-hidden="true" size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold text-zani-ink">{bot.name}</span>
                    <Badge size="sm" variant={statusVariant(bot.status)} className="shrink-0">
                      {t(`aiAgents.status.${bot.status}`)}
                    </Badge>
                  </span>
                  <span className="mt-1 line-clamp-2 block text-xs font-medium leading-4 text-zani-subtle">
                    {profile?.role_description || t("aiAgents.purposeMissing")}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        {!filteredBots.length ? (
          <div className="rounded-control border border-dashed border-zani-border bg-surface-warm p-4 text-center text-sm font-medium text-zani-subtle">
            {bots.length ? t("aiAgents.noMatches") : t("aiAgents.sidebarEmpty")}
          </div>
        ) : null}
      </nav>

      <footer className="shrink-0 border-t border-zani-border px-3 py-2.5 text-xs font-medium text-zani-faint">
        {t("aiAgents.totalCount", { count: bots.length })}
      </footer>
    </aside>
  );
}
