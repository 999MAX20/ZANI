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

export function CrmEntityTabs({ active, onChange }: { active: CrmCardTab; onChange: (tab: CrmCardTab) => void }) {
  const { t } = useI18n();
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-4 sm:px-7">
      {crmDrawerTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={cn(
            "shrink-0 rounded-2xl px-4 py-2 text-sm font-bold transition",
            active === tab.id ? "bg-midnight text-white shadow-premium" : "bg-white/70 text-slate-500 hover:bg-white hover:text-midnight",
          )}
          onClick={() => onChange(tab.id)}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  );
}

