import type React from "react";
import { CheckCheck, Plus, SlidersHorizontal } from "lucide-react";

import {
  CrmDataTable,
  CrmTableSurface,
  CRM_TABLE_ACTIONS_COLUMN,
  CRM_TABLE_CHECKBOX_COLUMN,
  CRM_TABLE_HEADER_GRID_CLASS,
  CRM_TABLE_MIN_WIDTH,
  CRM_TABLE_WIDE_MIN_WIDTH,
} from "../../../components/crm";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/cn";
import type { Client, Id, Lead, Service, TeamMember } from "../../../types";
import {
  leadColumnWidths,
  type FilterPreset,
  type LeadAiInsight,
  type LeadColumnKey,
  type LeadFilter,
  type Translate,
} from "../types";
import { getClient, getService, getSourceLabel } from "../utils/leadFormat";
import { LeadQueueItem } from "./LeadQueueItem";
import { LeadsPagination } from "./LeadsPagination";
import { VirtualizedLeadTableRows } from "./LeadsTable";
import { LeadsToolbar } from "./LeadsToolbar";

type LeadFilterTab = {
  value: LeadFilter;
  label: string;
  count: number;
};

export function LeadsWorkspaceTable({
  filters,
  filter,
  search,
  source,
  savedFiltersOpen,
  filterPresets,
  presetName,
  moreMenuOpen,
  columnOrder,
  visibleColumns,
  rows,
  pageRows,
  selected,
  selectedLeadIds,
  clientList,
  serviceList,
  teamList,
  aiInsights,
  allLeads,
  safePage,
  pageCount,
  pageSize,
  visiblePages,
  pageStart,
  pageEnd,
  totalLeadCount,
  t,
  onFilterChange,
  onSearchChange,
  onSourceChange,
  onToggleSavedFilters,
  onApplyPreset,
  onPresetNameChange,
  onSavePreset,
  onToggleMoreMenu,
  onToggleColumn,
  onToggleSortByAi,
  onExportCsv,
  onExportExcel,
  onShareView,
  onOpenImport,
  onOpenCreate,
  onOpenLead,
  onToggleBulkLead,
  onToggleAllPageRows,
  onAssignLead,
  onCallLead,
  onWhatsAppLead,
  onOpenContextMenu,
  onArchiveLead,
  onTakeLead,
  onPageChange,
  onPageSizeChange,
}: {
  filters: LeadFilterTab[];
  filter: LeadFilter;
  search: string;
  source: string;
  savedFiltersOpen: boolean;
  filterPresets: FilterPreset[];
  presetName: string;
  moreMenuOpen: boolean;
  columnOrder: LeadColumnKey[];
  visibleColumns: Record<LeadColumnKey, boolean>;
  rows: Lead[];
  pageRows: Lead[];
  selected: Lead | null;
  selectedLeadIds: Id[];
  clientList: Client[];
  serviceList: Service[];
  teamList: TeamMember[];
  aiInsights: Map<Id, LeadAiInsight>;
  allLeads: Lead[];
  safePage: number;
  pageCount: number;
  pageSize: number;
  visiblePages: number[];
  pageStart: number;
  pageEnd: number;
  totalLeadCount: number;
  t: Translate;
  onFilterChange: (filter: LeadFilter) => void;
  onSearchChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onToggleSavedFilters: () => void;
  onApplyPreset: (preset: FilterPreset) => void;
  onPresetNameChange: (value: string) => void;
  onSavePreset: () => void;
  onToggleMoreMenu: () => void;
  onToggleColumn: (column: LeadColumnKey) => void;
  onToggleSortByAi: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onShareView: () => void;
  onOpenImport: () => void;
  onOpenCreate: () => void;
  onOpenLead: (lead: Lead) => void;
  onToggleBulkLead: (id: Id) => void;
  onToggleAllPageRows: () => void;
  onAssignLead: (lead: Lead, userId?: Id) => void;
  onCallLead: (lead: Lead) => void;
  onWhatsAppLead: (lead: Lead, template?: string) => void;
  onOpenContextMenu: (event: React.MouseEvent, lead: Lead) => void;
  onArchiveLead: (lead: Lead) => void;
  onTakeLead: (lead: Lead) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const activeTableColumns = columnOrder.filter((column) => visibleColumns[column]);
  const tableGridTemplateColumns = `${CRM_TABLE_CHECKBOX_COLUMN} ${activeTableColumns.map((column) => leadColumnWidths[column]).join(" ")} ${CRM_TABLE_ACTIONS_COLUMN}`;
  const tableGridMinWidth = activeTableColumns.length > 5 ? CRM_TABLE_WIDE_MIN_WIDTH : CRM_TABLE_MIN_WIDTH;
  const sourceOptions = ["", "whatsapp", "telegram", "instagram", "website", "manual", "parser", "other"];
  const allPageRowsSelected = pageRows.length > 0 && pageRows.every((lead) => selectedLeadIds.includes(lead.id));

  return (
    <CrmTableSurface
      className="flex-none overflow-visible rounded-card border border-slate-200 bg-white shadow-card"
      filtersClassName="border-b border-slate-100 bg-white px-4 py-3"
      filters={
        <LeadsToolbar
          filters={filters}
          filter={filter}
          search={search}
          source={source}
          sourceOptions={sourceOptions.map((item) => ({ value: item, label: item ? getSourceLabel(item, t) : t("leads.allSources") }))}
          savedFiltersOpen={savedFiltersOpen}
          filterPresets={filterPresets}
          presetName={presetName}
          moreMenuOpen={moreMenuOpen}
          columnOrder={columnOrder}
          visibleColumns={visibleColumns}
          labels={{
            search: t("leads.search"),
            source: t("leads.source"),
            filters: t("leads.filters"),
            columns: t("leads.columns"),
            exportCsv: t("leads.exportCsv"),
            exportExcel: t("leads.exportExcel"),
            import: t("leads.import"),
            noSavedFilters: t("leads.noSavedFilters"),
            filterPresetName: t("leads.filterPresetName"),
            saveFilter: t("leads.saveFilter"),
            sortByHeat: t("leads.sortByHeat"),
            shareView: t("leads.shareView"),
            column: (column) => t(`leads.column.${column}`),
          }}
          onFilterChange={onFilterChange}
          onSearchChange={onSearchChange}
          onSourceChange={onSourceChange}
          onToggleSavedFilters={onToggleSavedFilters}
          onApplyPreset={onApplyPreset}
          onPresetNameChange={onPresetNameChange}
          onSavePreset={onSavePreset}
          onToggleMoreMenu={onToggleMoreMenu}
          onToggleColumn={onToggleColumn}
          onToggleSortByAi={onToggleSortByAi}
          onExportCsv={onExportCsv}
          onExportExcel={onExportExcel}
          onShareView={onShareView}
          onOpenImport={onOpenImport}
        />
      }
    >
      <CrmDataTable className="rounded-none border-0 bg-transparent shadow-none" contentClassName="min-h-0">
        <div className="hidden shrink-0 overflow-x-auto lg:block">
          <div className={cn(CRM_TABLE_HEADER_GRID_CLASS, "bg-slate-50")} style={{ gridTemplateColumns: tableGridTemplateColumns, minWidth: tableGridMinWidth }}>
            <label className="flex h-5 w-5 items-center justify-center">
              <input className="sr-only" type="checkbox" checked={allPageRowsSelected} onChange={onToggleAllPageRows} aria-label={t("leads.selectAll")} />
              <span className={cn("grid h-5 w-5 place-items-center rounded border", allPageRowsSelected ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white")}>
                {allPageRowsSelected ? <CheckCheck size={13} /> : null}
              </span>
            </label>
            {activeTableColumns.map((column) => (
              <span key={column}>{t(`leads.column.${column}`)}</span>
            ))}
            <span>{t("leads.actions")}</span>
          </div>
        </div>
        <div className="min-h-0 overflow-visible">
          {!rows.length ? (
            <div className="grid h-full min-h-[320px] place-items-center p-5">
              <div className="max-w-sm text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Plus size={22} />
                </div>
                <h3 className="mt-4 text-lg font-black text-midnight">{t("leads.emptyTitle")}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{t("leads.emptyText")}</p>
                <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                  <Button onClick={onOpenCreate}>
                    <Plus size={16} /> {t("leads.createFirstLead")}
                  </Button>
                  <Button variant="secondary" onClick={onOpenImport}>
                    <SlidersHorizontal size={16} /> {t("leads.setupIntegrations")}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <VirtualizedLeadTableRows
                rows={pageRows}
                selected={selected}
                selectedLeadIds={selectedLeadIds}
                clientList={clientList}
                serviceList={serviceList}
                teamList={teamList}
                aiInsights={aiInsights}
                allLeads={allLeads}
                visibleColumns={visibleColumns}
                columnOrder={columnOrder}
                openLead={onOpenLead}
                toggleBulkLead={onToggleBulkLead}
                assignLead={onAssignLead}
                callLead={onCallLead}
                whatsAppLead={onWhatsAppLead}
                openContextMenu={onOpenContextMenu}
                t={t}
              />
              <div className="divide-y divide-slate-100 lg:hidden">
                {pageRows.map((lead) => (
                  <LeadQueueItem
                    key={lead.id}
                    lead={lead}
                    client={getClient(lead, clientList)}
                    service={getService(lead, serviceList)}
                    selected={lead.id === selected?.id}
                    onClick={() => onOpenLead(lead)}
                    onSwipeLeft={() => onArchiveLead(lead)}
                    onSwipeRight={() => onTakeLead(lead)}
                    onLongPress={(event) => {
                      const touch = "touches" in event ? event.touches[0] || event.changedTouches[0] : event;
                      onOpenContextMenu({ ...event, clientX: touch?.clientX || window.innerWidth / 2, clientY: touch?.clientY || window.innerHeight / 2 } as React.MouseEvent, lead);
                    }}
                    t={t}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <LeadsPagination
          page={safePage}
          pageCount={pageCount}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50]}
          visiblePages={visiblePages}
          label={t("leads.tableShowingRange", { start: pageStart, end: pageEnd, total: totalLeadCount })}
          pageSizeLabel={t("leads.pageSize")}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </CrmDataTable>
    </CrmTableSurface>
  );
}
