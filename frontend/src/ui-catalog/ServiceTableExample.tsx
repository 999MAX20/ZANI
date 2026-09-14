import { useState } from "react";
import { Search } from "lucide-react";
import { DataTable } from "../components/tables/DataTable";
import { CrmPagination } from "../components/crm/CrmPagination";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { ServiceActionsMenu } from "../features/services/components/ServiceActionsMenu";
import { ServiceStatusBadge } from "../features/services/components/ServiceStatusBadge";
import { ServiceEditModal } from "../features/services/components/ServiceEditModal";
import { formatMoney } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { Service } from "../types";
import { serviceFixture } from "./serviceFixtures";

const noop = () => {};

export function ServiceTableExample({ state = "populated" }: { state?: "populated" | "empty" | "loading" }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Service | null>(null);
  const [overrides, setOverrides] = useState<Record<number, Partial<Service>>>({});
  const services = state === "empty" ? [] : Array.from({ length: 24 }, (_, index) => serviceFixture(
    `Synthetic ${String(index + 1).padStart(2, "0")} — ${t("services.name")} — ${t("services.inspectorSubtitle")}`,
    { id: index + 1, is_active: index % 3 !== 1, is_archived: index % 3 === 2, ...overrides[index + 1] },
  ));
  const filtered = services.filter((service) => service.name.toLowerCase().includes(search.toLowerCase()) && (
    status === "archived" ? service.is_archived : !service.is_archived && (
      status === "active" ? service.is_active : status === "inactive" ? !service.is_active : true
    )
  ));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  function updateFixture(service: Service, update: Partial<Service>) {
    setOverrides((current) => ({ ...current, [service.id]: { ...current[service.id], ...update } }));
    setPage(1);
  }
  return (
    <>
      <DataTable
        rows={rows} isLoading={state === "loading"} hideFooter
        emptyTitle={t("services.emptyTitle")} tableLabel={t("services.title")}
        rowKey={(row) => row.id} selectedRowKey={selected?.id} onRowSelect={setSelected}
        rowAriaLabel={(row) => row.name} rowTestId={(row) => `catalog-service-${row.id}`}
        toolbar={(
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between" data-testid="catalog-service-toolbar">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <div className="w-full min-w-0 sm:w-80 xl:w-[22rem]">
                <Input value={search} leftIcon={<Search aria-hidden="true" size={17} />}
                  aria-label={t("services.searchPlaceholder")} placeholder={t("services.searchPlaceholder")}
                  onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
              </div>
              <div className="w-full shrink-0 sm:w-48">
                <Select aria-label={t("services.statusFilter")} value={status}
                  options={[
                    { value: "", label: t("services.allStatuses") },
                    { value: "active", label: t("services.activeOnly") },
                    { value: "inactive", label: t("services.inactiveOnly") },
                    { value: "archived", label: t("services.archivedOnly") },
                  ]}
                  onChange={(event) => { setStatus(event.target.value); setPage(1); }} />
              </div>
            </div>
            <CrmPagination variant="toolbar" shown={rows.length} total={filtered.length} page={page} pageSize={pageSize}
              className="w-full border-t border-zani-border pt-3 xl:w-auto xl:border-t-0 xl:pt-0"
              rangeLabel={t("pagination.range", { from: filtered.length ? (page - 1) * pageSize + 1 : 0, to: Math.min(filtered.length, page * pageSize), total: filtered.length })}
              previousLabel={t("pagination.previous")} nextLabel={t("pagination.next")}
              pageSizeLabel={(size) => t("pagination.pageSize", { size })} pageSizeAriaLabel={t("pagination.pageSizeAriaLabel")}
              onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
          </div>
        )}
        columns={[
          { header: t("services.name"), className: "max-w-[320px]", cell: (row) => <span className="block truncate font-semibold text-zani-ink">{row.name}</span> },
          { header: t("services.duration"), cell: (row) => `${row.duration_minutes} ${t("appointment.minutes")}` },
          { header: t("services.priceFrom"), cell: (row) => formatMoney(row.price_from) },
          { header: t("appointment.status"), cell: (row) => <ServiceStatusBadge service={row} /> },
          { header: t("appointments.actions"), className: "w-16 text-right", cell: (row) => (
            <ServiceActionsMenu service={row} canManage isPending={false} onOpen={() => setSelected(row)}
              onActivate={() => updateFixture(row, { is_active: true })} onDeactivate={() => updateFixture(row, { is_active: false })}
              onArchive={() => updateFixture(row, { is_archived: true })} onRestore={() => updateFixture(row, { is_archived: false })} />
          ) },
        ]}
      />
      <ServiceEditModal service={selected} businessId={0} appointmentCount={0} canManage isSaving={false}
        onClose={() => setSelected(null)} onDirtyChange={noop}
        onSubmit={async (payload) => { if (selected) updateFixture(selected, payload); setSelected(null); }} />
    </>
  );
}
