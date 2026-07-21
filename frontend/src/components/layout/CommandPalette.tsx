import { Plus, Search, Settings, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useEntityData } from "../../hooks/useEntityData";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

function commandScore(source: string, query: string) {
  const normalizedSource = source.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedQuery = query.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalizedQuery) return 1;
  if (!normalizedSource) return 0;
  if (normalizedSource === normalizedQuery) return 1000;
  if (normalizedSource.startsWith(normalizedQuery)) return 800 - normalizedSource.length / 100;
  const index = normalizedSource.indexOf(normalizedQuery);
  if (index >= 0) return 600 - index - normalizedSource.length / 100;
  let cursor = 0;
  let score = 300;
  for (const char of normalizedQuery) {
    cursor = normalizedSource.indexOf(char, cursor);
    if (cursor === -1) return 0;
    cursor += 1;
    score -= 1;
  }
  return Math.max(1, score - normalizedSource.length / 100);
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { clients, leads, services } = useEntityData({ clients: true, leads: true, services: true });
  const commands = useMemo(() => {
    const staticCommands = [
      { id: "create-lead", label: t("command.createLead"), hint: t("nav.leads"), to: "/app/leads?create=1", icon: Plus, priority: 20 },
      { id: "open-leads", label: t("command.openLeads"), hint: t("nav.leads"), to: "/app/leads", icon: Search, priority: 10 },
      { id: "open-clients", label: t("command.openClients"), hint: t("nav.clients"), to: "/app/clients", icon: Search, priority: 10 },
      { id: "open-deals", label: t("command.openDeals"), hint: t("nav.deals"), to: "/app/deals", icon: Search, priority: 10 },
      { id: "open-messages", label: t("command.openMessages"), hint: t("nav.conversations"), to: "/app/conversations", icon: Search, priority: 10 },
      { id: "open-settings", label: t("command.openSettings"), hint: t("nav.settings"), to: "/app/settings", icon: Settings, priority: 10 },
      { id: "open-ai-agents", label: t("command.openAiAgents"), hint: t("nav.aiAgents"), to: "/app/ai-agents", icon: Search, priority: 10 },
    ];
    const leadCommands = (leads.data || []).map((lead) => {
      const client = (clients.data || []).find((item) => item.id === lead.client);
      const service = (services.data || []).find((item) => item.id === lead.service);
      return {
        id: `lead-${lead.id}`,
        label: client?.full_name || t("leads.leadFallback", { id: lead.id }),
        hint: [t("command.typeLead"), client?.phone, service?.name].filter(Boolean).join(" · "),
        to: `/app/leads/${lead.id}`,
        icon: Search,
        priority: 5,
      };
    });
    const clientCommands = (clients.data || []).map((client) => ({
      id: `client-${client.id}`,
      label: client.full_name,
      hint: [t("command.typeClient"), client.phone || client.email].filter(Boolean).join(" · "),
      to: `/app/clients?client=${client.id}`,
      icon: Search,
      priority: 3,
    }));
    const serviceCommands = (services.data || []).map((service) => ({
      id: `service-${service.id}`,
      label: service.name,
      hint: t("command.typeService"),
      to: `/app/services?service=${service.id}`,
      icon: Search,
      priority: 2,
    }));
    return [...staticCommands, ...leadCommands, ...clientCommands, ...serviceCommands];
  }, [clients.data, leads.data, services.data, t]);
  const filtered = commands
    .map((command) => ({ command, score: commandScore(`${command.label} ${command.hint}`, query) + command.priority }))
    .filter((item) => !query.trim() || item.score > item.command.priority)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((item) => item.command);

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/35 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto mt-20 max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <Search size={18} className="text-slate-400" />
          <input
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-midnight outline-none placeholder:text-slate-400"
            placeholder={t("command.placeholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-midnight" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {filtered.length ? filtered.map((command, index) => {
            const Icon = command.icon;
            return (
              <button
                key={command.id}
                type="button"
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition", index === 0 ? "bg-brand-50" : "hover:bg-slate-50")}
                onClick={() => {
                  navigate(command.to);
                  onClose();
                  setQuery("");
                }}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-700 shadow-sm">
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-midnight">{command.label}</span>
                  <span className="block truncate text-xs font-semibold text-slate-500">{command.hint}</span>
                </span>
                <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-400">Cmd K</span>
              </button>
            );
          }) : (
            <p className="px-3 py-8 text-center text-sm font-semibold text-slate-500">{t("command.empty")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
