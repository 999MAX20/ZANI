import { UserRound, X } from "lucide-react";

import type { CrmCardPayload } from "../../../types";
import { cn } from "../../../lib/cn";
import { useI18n } from "../../../lib/i18n";
import { Button } from "../../ui/Button";
import { StatusBadge } from "../../ui/StatusBadge";
import { crmDrawerTabs } from "./config";
import { getDrawerSubtitle, getDrawerTitle } from "./shared";
import type { CrmCardTab, CrmDrawerEntity } from "./types";

export function CrmEntityHeader({ data, entity, titleId, onClose }: { data?: CrmCardPayload; entity: CrmDrawerEntity; titleId: string; onClose: () => void }) {
  const { t } = useI18n();
  const activeStatus = entity.type === "client" ? undefined : data?.deal?.status || data?.appointment?.status || data?.lead?.status;

  return (
    <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/88 px-5 py-4 backdrop-blur-xl sm:px-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-ai-gradient text-white shadow-glow">
              <UserRound size={18} />
            </span>
            {activeStatus ? <StatusBadge status={activeStatus} /> : null}
          </div>
          <h2 id={titleId} className="truncate text-2xl font-black tracking-tight text-midnight">{getDrawerTitle(data, t, entity)}</h2>
          <p className="mt-1 text-sm text-slate-500">{getDrawerSubtitle(data, t)}</p>
        </div>
        <Button type="button" variant="ghost" className="h-12 w-12 shrink-0 rounded-full px-0" onClick={onClose} aria-label={t("crmCard.close")}>
          <X size={28} strokeWidth={2.4} />
        </Button>
      </div>
    </div>
  );
}

export function CrmEntityTabs({ active, onChange, data }: { active: CrmCardTab; onChange: (tab: CrmCardTab) => void; data?: CrmCardPayload }) {
  const { t } = useI18n();
  const tabCounts: Partial<Record<CrmCardTab, number>> = {
    timeline: data?.meta?.related_counts.timeline ?? data?.timeline.length,
    tasks: data?.meta?.related_counts.tasks ?? data?.tasks.length,
    appointments: data?.meta?.related_counts.appointments ?? data?.appointments.length,
    messages: data?.meta?.related_counts.conversations ?? data?.conversations.length,
    notes: data?.meta?.related_counts.notes ?? data?.notes.length,
    deals: data?.meta?.related_counts.deals ?? data?.deals.length,
    files: data?.attachments.length,
  };
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-4 sm:px-7">
      {crmDrawerTabs.map((tab) => {
        const count = tabCounts[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition",
              active === tab.id ? "bg-midnight text-white shadow-premium" : "bg-white/70 text-slate-500 hover:bg-white hover:text-midnight",
            )}
            onClick={() => onChange(tab.id)}
          >
            <span>{t(tab.labelKey)}</span>
            {typeof count === "number" ? (
              <span className={cn("min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-black", active === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
