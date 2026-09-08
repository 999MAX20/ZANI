import { ChevronRight, Search } from "lucide-react";

import { CrmPagination } from "../../../components/crm";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { useI18n } from "../../../lib/i18n";
import type { Resource } from "../../../types";

export type ResourceScheduleSummary = {
  resource: Resource;
  individual: boolean;
  workingDays: number;
};

export function WorkingHoursResourcesView({
  rows,
  total,
  page,
  pageSize,
  search,
  scheduleMode,
  hasResources,
  onSearchChange,
  onScheduleModeChange,
  onPageChange,
  onPageSizeChange,
  onOpen,
}: {
  rows: ResourceScheduleSummary[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  scheduleMode: "" | "business" | "individual";
  hasResources: boolean;
  onSearchChange: (value: string) => void;
  onScheduleModeChange: (value: "" | "business" | "individual") => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpen: (resource: Resource) => void;
}) {
  const { t } = useI18n();
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-zani-border bg-surface-card shadow-card">
      <div className="grid gap-3 border-b border-zani-border px-4 py-3 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,320px)_190px_auto] xl:items-center">
        <div>
          <h2 className="text-sm font-semibold text-zani-ink">{t("workingHours.staffOverview")}</h2>
          <p className="mt-0.5 text-xs font-medium text-zani-subtle">{t("workingHours.resourceListHint")}</p>
        </div>
        <Input
          aria-label={t("workingHours.searchResources")}
          placeholder={t("workingHours.searchResources")}
          leftIcon={<Search aria-hidden="true" size={17} />}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <Select
          aria-label={t("workingHours.scheduleFilter")}
          value={scheduleMode}
          onChange={(event) => onScheduleModeChange(event.target.value as "" | "business" | "individual")}
          options={[
            { value: "", label: t("workingHours.allSchedules") },
            { value: "business", label: t("workingHours.businessSchedule") },
            { value: "individual", label: t("workingHours.individualSchedule") },
          ]}
        />
        <CrmPagination
          variant="toolbar"
          shown={rows.length}
          total={total}
          page={page}
          pageSize={pageSize}
          rangeLabel={t("pagination.range", { from, to, total })}
          previousLabel={t("pagination.previous")}
          nextLabel={t("pagination.next")}
          pageSizeLabel={(size) => t("pagination.pageSize", { size })}
          pageSizeAriaLabel={t("pagination.pageSizeAriaLabel")}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>

      {rows.length ? (
        <>
          <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto p-3 md:hidden">
            {rows.map((item) => (
              <button
                key={item.resource.id}
                type="button"
                data-focus-return-id={`working-hours-resource-${item.resource.id}`}
                className="zani-focus-ring flex w-full items-center gap-3 rounded-control border border-zani-border bg-surface-card px-3 py-3 text-left hover:bg-surface-warm"
                onClick={() => onOpen(item.resource)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zani-ink">{item.resource.name}</p>
                  <p className="mt-1 text-xs font-medium text-zani-subtle">{t("workingHours.configuredDays").replace("{count}", String(item.workingDays))}</p>
                </div>
                <Badge variant={item.individual ? "info" : "neutral"} size="sm">{t(item.individual ? "workingHours.individualSchedule" : "workingHours.businessSchedule")}</Badge>
                <ChevronRight aria-hidden="true" className="shrink-0 text-zani-faint" size={17} />
              </button>
            ))}
          </div>
          <div className="hidden min-h-0 flex-1 overflow-auto md:block">
            <table className="w-full min-w-[680px] text-left text-sm" aria-label={t("workingHours.resourceScheduleTableLabel")}>
              <thead className="sticky top-0 border-b border-zani-border bg-surface-muted text-xs font-semibold text-zani-subtle">
                <tr>
                  <th className="px-4 py-2.5">{t("workingHours.resource")}</th>
                  <th className="px-4 py-2.5">{t("workingHours.scheduleMode")}</th>
                  <th className="px-4 py-2.5">{t("workingHours.workingDays")}</th>
                  <th className="w-16 px-4 py-2.5 text-right">{t("appointments.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zani-border">
                {rows.map((item) => (
                  <tr
                    key={item.resource.id}
                    tabIndex={0}
                    aria-label={t("workingHours.openResourceSchedule").replace("{name}", item.resource.name)}
                    data-focus-return-id={`working-hours-resource-${item.resource.id}`}
                    className="zani-focus-ring cursor-pointer outline-none transition hover:bg-surface-warm"
                    onClick={() => onOpen(item.resource)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      onOpen(item.resource);
                    }}
                  >
                    <td className="px-4 py-3 font-semibold text-zani-ink">{item.resource.name}</td>
                    <td className="px-4 py-3"><Badge variant={item.individual ? "info" : "neutral"} size="sm">{t(item.individual ? "workingHours.individualSchedule" : "workingHours.businessSchedule")}</Badge></td>
                    <td className="px-4 py-3 font-medium text-zani-subtle">{t("workingHours.configuredDays").replace("{count}", String(item.workingDays))}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={t("workingHours.openResourceSchedule").replace("{name}", item.resource.name)}
                        onClick={(event) => { event.stopPropagation(); onOpen(item.resource); }}
                      >
                        <ChevronRight aria-hidden="true" size={17} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="p-4">
          <p className="rounded-control bg-surface-muted p-4 text-sm font-medium text-zani-subtle">
            {hasResources ? t("workingHours.noResourcesFound") : t("workingHours.noResourcesText")}
          </p>
        </div>
      )}
    </section>
  );
}
