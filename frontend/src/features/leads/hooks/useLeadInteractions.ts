import { useEffect, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";

import type { CrmDrawerEntity } from "../../../components/crm/CrmEntityDrawer";
import type { Client, Id, Lead, Service, TeamMember } from "../../../types";
import type { Translate } from "../types";
import { exportLeadRows } from "../utils/leadExport";
import { getClient, getService } from "../utils/leadFormat";
import { useLeadKeyboardShortcuts } from "./useLeadKeyboardShortcuts";

export function useLeadInteractions({
  searchParams,
  setSearchParams,
  rows,
  pageRows,
  selected,
  selectedLeadIds,
  clientList,
  serviceList,
  teamList,
  t,
  openCreateLead,
  setCreateOpen,
  setSelectedId,
  setDrawerEntity,
  setContextMenu,
  setShortcutsOpen,
  setSelectedLeadIds,
}: {
  searchParams: URLSearchParams;
  setSearchParams: (nextInit: URLSearchParams, navigateOpts?: { replace?: boolean }) => void;
  rows: Lead[];
  pageRows: Lead[];
  selected: Lead | null;
  selectedLeadIds: Id[];
  clientList: Client[];
  serviceList: Service[];
  teamList: TeamMember[];
  t: Translate;
  openCreateLead: () => void;
  setCreateOpen: (open: boolean) => void;
  setSelectedId: (id: Id | null) => void;
  setDrawerEntity: (entity: CrmDrawerEntity | null) => void;
  setContextMenu: (menu: { x: number; y: number; lead: Lead } | null) => void;
  setShortcutsOpen: (open: boolean) => void;
  setSelectedLeadIds: Dispatch<SetStateAction<Id[]>>;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    setCreateOpen(searchParams.get("create") === "1");
  }, [searchParams, setCreateOpen]);

  useEffect(() => {
    const leadId = Number(searchParams.get("lead"));
    if (Number.isFinite(leadId) && leadId > 0) setSelectedId(leadId);
  }, [searchParams, setSelectedId]);

  useEffect(() => {
    const leadId = Number(searchParams.get("lead"));
    if (!Number.isFinite(leadId) || leadId <= 0) return;
    setDrawerEntity(null);
    navigate(`/app/leads/${leadId}`, { replace: true });
  }, [navigate, searchParams, setDrawerEntity]);

  function openLead(lead: Lead) {
    setSelectedId(lead.id);
    setDrawerEntity(null);
    setContextMenu(null);
    navigate(`/app/leads/${lead.id}`);
  }

  function closeDrawer() {
    setDrawerEntity(null);
    const next = new URLSearchParams(searchParams);
    next.delete("lead");
    next.delete("deal");
    next.delete("client");
    setSearchParams(next, { replace: true });
  }

  function callLead(lead: Lead) {
    const client = getClient(lead, clientList);
    if (client?.phone) window.location.href = `tel:${client.phone}`;
  }

  function whatsAppLead(lead: Lead, template?: string) {
    const client = getClient(lead, clientList);
    const phone = client?.phone?.replace(/\D/g, "");
    if (!phone) return;
    const service = getService(lead, serviceList);
    const text = template
      ?.replace(/\{\{РёРјСЏ\}\}/g, client?.full_name || "")
      .replace(/\{\{name\}\}/g, client?.full_name || "")
      .replace(/\{\{СѓСЃР»СѓРіР°\}\}/g, service?.name || "")
      .replace(/\{\{service\}\}/g, service?.name || "");
    window.open(`https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`, "_blank", "noopener,noreferrer");
  }

  function toggleBulkLead(id: Id) {
    setSelectedLeadIds((value) => (value.includes(id) ? value.filter((item) => item !== id) : [...value, id]));
  }

  function toggleAllPageRows() {
    const pageIds = pageRows.map((lead) => lead.id);
    const allSelected = pageIds.every((id) => selectedLeadIds.includes(id));
    setSelectedLeadIds((value) => (allSelected ? value.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...value, ...pageIds]))));
  }

  async function exportRows(kind: "csv" | "excel") {
    await exportLeadRows({ kind, rows, clients: clientList, services: serviceList, teamMembers: teamList, t });
  }

  function closeCreateModal() {
    setCreateOpen(false);
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
  }

  useLeadKeyboardShortcuts({
    rows,
    selected,
    onOpenLead: openLead,
    onCallLead: callLead,
    onWhatsAppLead: whatsAppLead,
    onCreateLead: openCreateLead,
    onCloseOverlays: () => {
      setContextMenu(null);
      setShortcutsOpen(false);
    },
    onOpenShortcuts: () => setShortcutsOpen(true),
  });

  return {
    openLead,
    closeDrawer,
    callLead,
    whatsAppLead,
    toggleBulkLead,
    toggleAllPageRows,
    exportRows,
    closeCreateModal,
  };
}
