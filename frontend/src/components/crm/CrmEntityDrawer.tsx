import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { crmCardsApi } from "../../api/crmCards";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { AppointmentDrawerContent } from "./drawers/appointment";
import { ClientDrawerContent } from "./drawers/client";
import { DealDrawerContent } from "./drawers/deal";
import { GenericDrawerContent } from "./drawers/fallback";
import { LeadDrawerContent } from "./drawers/lead";
import {
  EntityAttachmentsPanel,
  EntityAppointmentsPanel,
  EntityConversationsPanel,
  EntityDealsPanel,
  EntityNotesPanel,
  EntityTasksPanel,
  EntityTimeline,
} from "./drawers/panels";
import { CrmEntityHeader, CrmEntityTabs } from "./drawers/shell";
import type { CrmCardTab, CrmDrawerEntity } from "./drawers/types";
import { Drawer } from "../ui/Overlay";
import { ErrorState, LoadingState } from "../ui/StateViews";
import type { Client } from "../../types";

export type { CrmCardTab, CrmDrawerEntity } from "./drawers/types";

type TabId = CrmCardTab;
export type ClientDrawerActions = {
  onEdit?: (client: Client) => void;
  onAddTag?: (client: Client) => void;
  onArchive?: (client: Client) => void;
};

export function CrmEntityDrawer({
  entity,
  onClose,
  clientActions,
}: {
  entity: CrmDrawerEntity | null;
  onClose: () => void;
  clientActions?: ClientDrawerActions;
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabId>(entity?.initialTab || "overview");
  const [isOpen, setIsOpen] = useState(false);
  const titleId = "crm-entity-drawer-title";
  const query = useQuery({
    queryKey: ["crm-card", entity?.type, entity?.id],
    queryFn: () => crmCardsApi.get({ type: entity!.type, id: entity!.id }),
    enabled: Boolean(entity),
  });
  const data = query.data;
  useEffect(() => {
    setActiveTab(entity?.initialTab || "overview");
  }, [entity?.id, entity?.initialTab, entity?.type]);
  useEffect(() => {
    if (!entity) {
      setIsOpen(false);
      return;
    }
    setIsOpen(false);
    const frame = requestAnimationFrame(() => setIsOpen(true));
    return () => {
      cancelAnimationFrame(frame);
      setIsOpen(false);
    };
  }, [entity?.id, entity?.type]);
  const tabContent = useMemo(() => {
    if (!data) return null;
    if (activeTab === "timeline") return <EntityTimeline data={data} />;
    if (activeTab === "tasks") return <EntityTasksPanel data={data} />;
    if (activeTab === "appointments") return <EntityAppointmentsPanel data={data} />;
    if (activeTab === "deals") return <EntityDealsPanel data={data} />;
    if (activeTab === "files") return <EntityAttachmentsPanel data={data} entity={entity!} />;
    if (activeTab === "messages") return <EntityConversationsPanel data={data} />;
    if (activeTab === "notes") return <EntityNotesPanel data={data} entity={entity!} />;
    if (entity?.type === "appointment") return <AppointmentDrawerContent data={data} entity={entity} />;
    if (entity?.type === "lead") return <LeadDrawerContent data={data} entity={entity} />;
    if (entity?.type === "deal") return <DealDrawerContent data={data} entity={entity} onTabChange={setActiveTab} />;
    if (entity?.type === "client") return <ClientDrawerContent data={data} entity={entity} actions={clientActions} />;
    return <GenericDrawerContent data={data} entity={entity!} />;
  }, [activeTab, clientActions, data, entity]);

  if (!entity) return null;

  return (
    <Drawer
      open={Boolean(entity)}
      onClose={onClose}
      titleId={titleId}
      className={cn(
        "transition-transform duration-[620ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform",
        isOpen ? "translate-x-0" : "translate-x-full",
      )}
    >
      <CrmEntityHeader data={data} entity={entity} titleId={titleId} onClose={onClose} />
      <CrmEntityTabs active={activeTab} onChange={setActiveTab} data={data} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 sm:px-7">
        {query.isLoading ? <LoadingState /> : null}
        {query.error ? <ErrorState message={t("crmCard.loadError")} /> : null}
        {tabContent}
      </div>
    </Drawer>
  );
}
