import { Globe2, Inbox, Plug } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import type { Translate } from "../types";

/**
 * Enhanced empty state для страницы заявок
 * Соответствует дизайн-референсам:
 * - Объясняет "почему нет данных"
 * - Предлагает подключить источники
 * - Показывает примеры что будет после подключения
 */
export function LeadsEmptyState({
  hasFilters,
  onClearFilters,
  onConnectIntegration,
  t,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
  onConnectIntegration: (source: string) => void;
  t: Translate;
}) {
  if (hasFilters) {
    // Пользователь применил фильтры, но ничего не найдено
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 px-4 py-12">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-gray-100">
          <Inbox size={32} className="text-gray-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-900">{t("leads.noLeadsFound")}</h3>
          <p className="mt-1 text-sm text-gray-500">{t("leads.noLeadsFoundDescription")}</p>
        </div>
        <Button variant="secondary" onClick={onClearFilters}>
          {t("leads.clearFilters")}
        </Button>
      </div>
    );
  }

  // Нет данных вообще - объясняем почему и предлагаем решения
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 ring-1 ring-blue-100">
        <Inbox size={40} className="text-blue-600" />
      </div>
      <div className="max-w-md text-center">
        <h3 className="text-xl font-bold text-gray-900">{t("leads.noLeadsYet")}</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{t("leads.noLeadsYetDescription")}</p>
      </div>

      {/* Карточки с источниками лидов */}
      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EmptyStateCard
          icon={Globe2}
          title={t("leads.sourceWebsite")}
          description={t("leads.sourceWebsiteDesc")}
          color="bg-slate-50 text-slate-700 ring-slate-200"
          onConnect={() => onConnectIntegration("website")}
          t={t}
        />
        <EmptyStateCard
          icon={Globe2}
          title="WhatsApp"
          description={t("leads.sourceWhatsappDesc")}
          color="bg-emerald-50 text-emerald-700 ring-emerald-200"
          onConnect={() => onConnectIntegration("whatsapp")}
          t={t}
        />
        <EmptyStateCard
          icon={Globe2}
          title="Telegram"
          description={t("leads.sourceTelegramDesc")}
          color="bg-sky-50 text-sky-700 ring-sky-200"
          onConnect={() => onConnectIntegration("telegram")}
          t={t}
        />
        <EmptyStateCard
          icon={Globe2}
          title="Instagram"
          description={t("leads.sourceInstagramDesc")}
          color="bg-pink-50 text-pink-700 ring-pink-200"
          onConnect={() => onConnectIntegration("instagram")}
          t={t}
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Plug size={14} />
        <span>{t("leads.connectIntegrationsHint")}</span>
      </div>
    </div>
  );
}

function EmptyStateCard({
  icon: Icon,
  title,
  description,
  color,
  onConnect,
  t,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  onConnect: () => void;
  t: Translate;
}) {
  return (
    <div className={`flex flex-col items-center gap-3 rounded-xl border p-4 text-center ${color} ring-1`}>
      <Icon size={24} className="opacity-80" />
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-xs opacity-80">{description}</p>
      </div>
      <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={onConnect}>
        {t("leads.connect")}
      </Button>
    </div>
  );
}
