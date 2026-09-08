import { Plus, Search } from "lucide-react";

import { CrmPagination } from "../../../components/crm";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { cn } from "../../../lib/cn";
import { useI18n } from "../../../lib/i18n";
import type { Resource } from "../../../types";

const resourceTypes: Resource["resource_type"][] = ["staff", "room", "hall", "box", "equipment", "other"];

const resourceTypeLabelKeys: Record<Resource["resource_type"], string> = {
  staff: "resources.typeStaff",
  room: "resources.typeRoom",
  hall: "resources.typeHall",
  box: "resources.typeBox",
  equipment: "resources.typeEquipment",
  other: "resources.typeOther",
};

export function ResourcesToolbar({
  searchDraft,
  resourceType,
  status,
  template,
  canManage,
  permissionMessage,
  isSplitWorkspace,
  shown,
  total,
  page,
  pageSize,
  rangeLabel,
  onSearchChange,
  onResourceTypeChange,
  onStatusChange,
  onTemplateChange,
  onUseTemplate,
  onPageChange,
  onPageSizeChange,
}: {
  searchDraft: string;
  resourceType: Resource["resource_type"] | "";
  status: "active" | "inactive" | "";
  template: string;
  canManage: boolean;
  permissionMessage: string;
  isSplitWorkspace: boolean;
  shown: number;
  total: number;
  page: number;
  pageSize: number;
  rangeLabel: string;
  onSearchChange: (value: string) => void;
  onResourceTypeChange: (value: Resource["resource_type"] | "") => void;
  onStatusChange: (value: "active" | "inactive" | "") => void;
  onTemplateChange: (value: string) => void;
  onUseTemplate: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div data-testid="resources-table-toolbar" className="flex flex-col gap-3">
      <div className={cn("flex min-w-0 flex-col gap-2", !isSplitWorkspace && "xl:flex-row xl:items-center")}>
        <div className={cn("w-full min-w-0", !isSplitWorkspace && "xl:w-[22rem]")}>
          <Input
            data-testid="resources-search"
            value={searchDraft}
            leftIcon={<Search aria-hidden="true" size={17} />}
            aria-label={t("resources.searchPlaceholder")}
            placeholder={t("resources.searchPlaceholder")}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <Select
            aria-label={t("resources.typeFilter")}
            value={resourceType}
            options={[
              { value: "", label: t("resources.allTypes") },
              ...resourceTypes.map((value) => ({ value, label: t(resourceTypeLabelKeys[value]) })),
            ]}
            onChange={(event) => onResourceTypeChange(event.target.value as Resource["resource_type"] | "")}
          />
          <Select
            aria-label={t("resources.statusFilter")}
            value={status}
            options={[
              { value: "", label: t("resources.allStatuses") },
              { value: "active", label: t("resources.activeOnly") },
              { value: "inactive", label: t("resources.inactiveOnly") },
            ]}
            onChange={(event) => onStatusChange(event.target.value as "active" | "inactive" | "")}
          />
        </div>
      </div>

      <div className={cn("flex min-w-0 flex-col gap-3 border-t border-zani-border pt-3", !isSplitWorkspace && "xl:flex-row xl:items-center xl:justify-between")}>
        <div className="flex min-w-0 items-center gap-2">
          <Select
            aria-label={t("resources.quickCreate")}
            value={template}
            disabled={!canManage}
            title={!canManage ? permissionMessage : undefined}
            className="min-w-0 flex-1 sm:w-52 sm:flex-none"
            options={[
              { value: "staff", label: t("resources.templateMaster") },
              { value: "equipment", label: t("resources.templateChair") },
              { value: "room", label: t("resources.templateRoom") },
              { value: "box", label: t("resources.templateBox") },
            ]}
            onChange={(event) => onTemplateChange(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canManage}
            title={!canManage ? permissionMessage : undefined}
            onClick={onUseTemplate}
          >
            <Plus aria-hidden="true" size={16} />
            {t("resources.useTemplate")}
          </Button>
        </div>
        <CrmPagination
          variant="toolbar"
          shown={shown}
          total={total}
          page={page}
          pageSize={pageSize}
          rangeLabel={rangeLabel}
          previousLabel={t("pagination.previous")}
          nextLabel={t("pagination.next")}
          pageSizeLabel={(size) => t("pagination.pageSize", { size })}
          pageSizeAriaLabel={t("pagination.pageSizeAriaLabel")}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
}

export { resourceTypeLabelKeys };
