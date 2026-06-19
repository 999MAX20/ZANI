import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CalendarPlus,
  ClipboardList,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CircleDot,
  Columns3,
  Download,
  Flame,
  KanbanSquare,
  Keyboard,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Mic,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  Share2,
  Table2,
  Undo2,
  UserCheck,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import writeXlsxFile from "write-excel-file/browser";

import { clientsApi } from "../../api/clients";
import { getApiErrorMessage } from "../../api/client";
import { fileAttachmentsApi } from "../../api/fileAttachments";
import { leadsApi, type LeadCreatePayload } from "../../api/leads";
import { tasksApi, type TaskCreatePayload } from "../../api/tasks";
import type { AppointmentCreatePayload } from "../../api/appointments";
import { teamApi } from "../../api/team";
import { CrmWorkspacePage } from "../../components/crm";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { AppointmentForm } from "../../components/forms/AppointmentForm";
import { LeadForm } from "../../components/forms/LeadForm";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { ErrorState, PageSkeleton } from "../../components/ui/StateViews";
import { cn } from "../../lib/cn";
import { formatDateTime } from "../../lib/format";
import { captureFrontendError, trackFrontendEvent } from "../../lib/monitoring";
import { realtimeIntervals } from "../../lib/realtime";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import type { Appointment, Client, Id, Lead, Service, Task } from "../../types";
import { useAuth } from "../auth/AuthProvider";
import { LeadQueueItem } from "./components/LeadQueueItem";
import { VirtualizedLeadTableRows } from "./components/LeadsTable";
import { SourceBadge } from "./components/common/SourceBadge";
import {
  defaultVisibleColumns,
  kanbanStatuses,
  LEAD_CACHE_KEY,
  LEAD_COLUMNS_KEY,
  LEAD_COLUMN_ORDER_KEY,
  leadColumnOrder,
  leadColumnWidths,
  leadFilters,
  LEAD_OFFLINE_QUEUE_KEY,
  LEAD_PRESETS_KEY,
  LEADS_PAGE_SIZE,
  leadViewModes,
  statusClass,
  type ActionHistoryItem,
  type FilterPreset,
  type LeadAction,
  type LeadAiInsight,
  type LeadColumnKey,
  type LeadFilter,
  type LeadViewMode,
  type OfflineLeadAction,
  type Translate,
  type UndoToast,
} from "./types";
import { fuzzyIncludes, fuzzyScore, normalizePhoneSearchInput } from "./utils/leadFilters";
import { formatRelativeTime, getClient, getService, getSourceLabel, getStatusLabel, leadAiInsight, leadTitle, nextAction } from "./utils/leadFormat";
import { downloadText, toCsvValue } from "./utils/leadExport";
import { loadJson, saveJson, toDateTimeLocal } from "./utils/leadStorage";

export function LeadsPage() {
  const { t } = useI18n();
  const { setPageHeader } = usePageHeader();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { user } = useAuth();
  const { clients, services, resources, tasks, deals, appointments, botConversations } = useEntityData({
    clients: true,
    services: true,
    resources: true,
    tasks: true,
    deals: true,
    appointments: true,
    botConversations: true,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<number | null>(() => Number(searchParams.get("lead")) || null);
  const [createOpen, setCreateOpen] = useState(searchParams.get("create") === "1");
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [filter, setFilter] = useState<LeadFilter>(() => {
    const param = searchParams.get("filter") as LeadFilter | null;
    return param && leadFilters.includes(param) ? param : "all";
  });
  const [source, setSource] = useState(searchParams.get("source") || "");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [searchFocused, setSearchFocused] = useState(false);
  const [viewMode, setViewMode] = useState<LeadViewMode>(() => {
    const param = searchParams.get("view") as LeadViewMode | null;
    return param && leadViewModes.includes(param) ? param : "table";
  });
  const [sortByAi, setSortByAi] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LEADS_PAGE_SIZE);
  const [pageDraft, setPageDraft] = useState("1");
  const [kanbanVisibleCounts, setKanbanVisibleCounts] = useState<Record<Lead["status"], number>>(() => ({
    new: 10,
    contacted: 10,
    in_progress: 10,
    appointment_created: 10,
    closed: 10,
    lost: 10,
  }));
  const [selectedLeadIds, setSelectedLeadIds] = useState<Id[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lead: Lead } | null>(null);
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>(() => loadJson<FilterPreset[]>(LEAD_PRESETS_KEY, []));
  const [presetName, setPresetName] = useState("");
  const [savedFiltersOpen, setSavedFiltersOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<LeadColumnKey, boolean>>(() => {
    const saved = loadJson<Partial<Record<LeadColumnKey, boolean>>>(LEAD_COLUMNS_KEY, {});
    const next = { ...defaultVisibleColumns, ...saved };
    const visibleCount = leadColumnOrder.filter((column) => next[column]).length;
    return visibleCount > 5 ? defaultVisibleColumns : next;
  });
  const [columnOrder, setColumnOrder] = useState<LeadColumnKey[]>(() => {
    const saved = loadJson<LeadColumnKey[]>(LEAD_COLUMN_ORDER_KEY, leadColumnOrder);
    return [...saved.filter((column): column is LeadColumnKey => leadColumnOrder.includes(column)), ...leadColumnOrder.filter((column) => !saved.includes(column))];
  });
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null);
  const [undoStack, setUndoStack] = useState<ActionHistoryItem[]>([]);
  const [redoStack, setRedoStack] = useState<ActionHistoryItem[]>([]);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<OfflineLeadAction[]>(() => loadJson<OfflineLeadAction[]>(LEAD_OFFLINE_QUEUE_KEY, []));
  const [cachedLeads, setCachedLeads] = useState<Lead[]>(() => loadJson<Lead[]>(LEAD_CACHE_KEY, []));
  const [notice, setNotice] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [nextActionOpen, setNextActionOpen] = useState(false);
  const [nextActionDraft, setNextActionDraft] = useState({
    title: t("leads.nextActionContactClient"),
    due_at: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    assignee: "",
    priority: "normal" as Task["priority"],
  });
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const knownLeadIdsRef = useRef<Set<Id> | null>(null);

  const teamMembers = useQuery({
    queryKey: ["team-members", business?.id],
    queryFn: teamApi.members,
    enabled: Boolean(business),
    retry: false,
  });
  const leadListParams = useMemo(() => {
    const params: NonNullable<Parameters<typeof leadsApi.listPaginated>[0]> = {
      page,
      page_size: pageSize,
      ordering: sortByAi ? "-updated_at" : "-created_at",
    };
    const trimmedSearch = search.trim();
    if (trimmedSearch) params.search = trimmedSearch;
    if (source) params.source = source;
    if (filter === "new") params.status = "new";
    if (filter === "hot") {
      params.status = "new";
      params.unassigned = true;
    }
    if (filter === "unanswered") params.unassigned = true;
    if (filter === "attention") params.attention = true;
    if (filter === "mine") params.mine = true;
    return params;
  }, [filter, page, pageSize, search, sortByAi, source]);
  const leads = useQuery({
    queryKey: ["leads", "paginated", business?.id, leadListParams],
    queryFn: () => leadsApi.listPaginated(leadListParams),
    enabled: Boolean(business),
    retry: false,
  });
  const leadSummary = useQuery({
    queryKey: ["leads", "summary", business?.id],
    queryFn: leadsApi.summary,
    enabled: Boolean(business),
    retry: false,
  });

  const allLeads = leads.data?.results?.length ? leads.data.results : (!isOnline ? cachedLeads : leads.data?.results || []);
  const clientList = clients.data || [];
  const serviceList = services.data || [];
  const taskList = tasks.data || [];
  const dealList = deals.data || [];
  const appointmentList = appointments.data || [];
  const conversationList = botConversations.data || [];
  const teamList = Array.isArray(teamMembers.data) ? teamMembers.data : [];
  const aiInsights = useMemo(() => {
    const result = new Map<Id, LeadAiInsight>();
    allLeads.forEach((lead) => {
      const insight = leadAiInsight(lead, clientList, serviceList, allLeads, t);
      result.set(lead.id, {
        ...insight,
        score: typeof lead.ai_score === "number" ? lead.ai_score : insight.score,
        lossRisk: typeof lead.loss_risk === "number" ? lead.loss_risk : insight.lossRisk,
        recommendation: lead.recommended_action || insight.recommendation,
      });
    });
    return result;
  }, [allLeads, clientList, serviceList, t]);

  useEffect(() => {
    setPageHeader({
      title: t("nav.leads"),
      secondaryActions: [
        {
          label: t("leads.filters"),
          icon: SlidersHorizontal,
          onClick: () => setSavedFiltersOpen((value) => !value),
        },
      ],
      primaryAction: {
        label: t("leads.create"),
        icon: Plus,
        onClick: () => setCreateOpen(true),
      },
    });
    return () => setPageHeader(null);
  }, [setPageHeader, t]);

  const rows = useMemo(() => {
    const value = search.trim().toLowerCase();
    return allLeads
      .map((lead) => {
        const client = getClient(lead, clientList);
        const service = getService(lead, serviceList);
        const ai = aiInsights.get(lead.id);
        const searchable = [client?.full_name, client?.phone, client?.email, lead.message, service?.name].join(" ");
        return { lead, score: value ? fuzzyScore(searchable, value) : sortByAi ? ai?.score || 1 : 1 };
      })
      .filter(({ lead, score }) => {
        const matchesSearch = !value || score > 0;
        const matchesSource = !source || (source === "website" ? ["website", "landing"].includes(lead.source) : lead.source === source);
        const matchesFilter =
          filter === "all" ||
          (filter === "new" && lead.status === "new") ||
          (filter === "hot" && lead.status === "new" && !lead.responsible_user) ||
          (filter === "unanswered" && !lead.responsible_user) ||
          (filter === "attention" && Boolean(aiInsights.get(lead.id)?.stale || (aiInsights.get(lead.id)?.lossRisk || 0) >= 70)) ||
          (filter === "mine" && Boolean(user?.id && lead.responsible_user === user.id));
        return matchesSearch && matchesSource && matchesFilter;
      })
      .sort((a, b) => b.score - a.score || (sortByAi ? (aiInsights.get(b.lead.id)?.score || 0) - (aiInsights.get(a.lead.id)?.score || 0) : 0) || new Date(b.lead.updated_at).getTime() - new Date(a.lead.updated_at).getTime())
      .map(({ lead }) => lead);
  }, [aiInsights, allLeads, clientList, filter, search, serviceList, sortByAi, source, user?.id]);

  const totalLeadCount = leads.data?.count ?? rows.length;
  const pageCount = Math.max(1, Math.ceil(totalLeadCount / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows;
  const selected = useMemo(() => rows.find((lead) => lead.id === selectedId) || pageRows[0] || null, [pageRows, rows, selectedId]);
  const selectedClient = selected ? getClient(selected, clientList) : undefined;
  const selectedService = selected ? getService(selected, serviceList) : undefined;
  const selectedTasks = selected
    ? taskList
        .filter((task) => task.lead === selected.id && !["done", "cancelled"].includes(task.status))
        .sort((a, b) => String(a.due_at || "9999").localeCompare(String(b.due_at || "9999")))
    : [];
  const selectedNextTask = selectedTasks[0];
  const selectedDeals = selected ? dealList.filter((deal) => deal.lead === selected.id || deal.client === selected.client) : [];
  const selectedAppointments = selected ? appointmentList.filter((appointment) => appointment.lead === selected.id || appointment.client === selected.client) : [];
  const selectedConversations = selected ? conversationList.filter((conversation) => conversation.lead === selected.id || conversation.client === selected.client) : [];
  const duplicateCheck = useQuery({
    queryKey: ["lead-duplicates", business?.id, selected?.id, selectedClient?.phone, selectedClient?.email],
    queryFn: () =>
      leadsApi.checkDuplicates({
        business: business!.id,
        client: selectedClient?.id,
        phone: selectedClient?.phone,
        email: selectedClient?.email,
      }),
    enabled: Boolean(business && selectedClient && (selectedClient.phone || selectedClient.email)),
    retry: false,
  });
  const selectedAiInsight = useMemo(() => {
    if (!selected) return null;
    const base = aiInsights.get(selected.id) || leadAiInsight(selected, clientList, serviceList, allLeads, t);
    const serverDuplicates = (duplicateCheck.data?.duplicates || []).map((duplicate) => {
      const existing = clientList.find((client) => client.id === duplicate.id);
      if (existing) return existing;
      return {
        id: duplicate.id,
        business: business?.id || selected.business,
        full_name: duplicate.full_name,
        phone: duplicate.phone,
        email: duplicate.email,
        whatsapp_id: "",
        telegram_id: "",
        instagram_id: "",
        source: "manual" as const,
        notes: "",
        created_at: "",
        updated_at: "",
      };
    });
    const duplicateMap = new Map<Id, Client>();
    [...base.duplicateClients, ...serverDuplicates].forEach((client) => duplicateMap.set(client.id, client));
    return {
      ...base,
      duplicateClients: Array.from(duplicateMap.values()).filter((client) => client.id !== selected.client),
    };
  }, [aiInsights, allLeads, business?.id, clientList, duplicateCheck.data?.duplicates, selected, serviceList, t]);

  const searchSuggestions = useMemo(() => {
    const value = search.trim();
    if (value.length < 2) return [];
    const leadSuggestions = allLeads
      .map((lead) => {
        const client = getClient(lead, clientList);
        const service = getService(lead, serviceList);
        const label = client?.full_name || t("leads.leadFallback", { id: lead.id });
        const meta = service?.name || getSourceLabel(lead.source, t);
        return { id: `lead-${lead.id}`, type: t("leads.suggestionLead"), label, meta, lead, score: fuzzyScore(`${label} ${meta}`, value) };
      })
      .filter((item) => item.score > 0);
    const clientSuggestions = clientList
      .map((client) => {
        const meta = client.phone || client.email || "";
        return { id: `client-${client.id}`, type: t("leads.suggestionClient"), label: client.full_name, meta, lead: undefined, score: fuzzyScore(`${client.full_name} ${meta}`, value) };
      })
      .filter((item) => item.score > 0);
    const serviceSuggestions = serviceList
      .map((service) => ({ id: `service-${service.id}`, type: t("leads.suggestionService"), label: service.name, meta: "", lead: undefined, score: fuzzyScore(service.name, value) }))
      .filter((item) => item.score > 0);
    return [...leadSuggestions, ...clientSuggestions, ...serviceSuggestions].sort((a, b) => b.score - a.score).slice(0, 7);
  }, [allLeads, clientList, search, serviceList, t]);

  useEffect(() => {
    setPage(1);
  }, [filter, search, source]);

  useEffect(() => {
    setCreateOpen(searchParams.get("create") === "1");
  }, [searchParams]);

  useEffect(() => {
    const leadId = Number(searchParams.get("lead"));
    if (Number.isFinite(leadId) && leadId > 0) setSelectedId(leadId);
  }, [searchParams]);

  useEffect(() => {
    const leadId = Number(searchParams.get("lead"));
    if (!Number.isFinite(leadId) || leadId <= 0) return;
    setDrawerEntity({ type: "lead", id: leadId });
  }, [searchParams]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    setPageDraft(String(safePage));
  }, [safePage]);

  useEffect(() => {
    saveJson(LEAD_PRESETS_KEY, filterPresets);
  }, [filterPresets]);

  useEffect(() => {
    saveJson(LEAD_COLUMNS_KEY, visibleColumns);
  }, [visibleColumns]);

  useEffect(() => {
    saveJson(LEAD_COLUMN_ORDER_KEY, columnOrder);
  }, [columnOrder]);

  useEffect(() => {
    if (!undoToast) return;
    const timer = window.setTimeout(() => setUndoToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [undoToast]);

  useEffect(() => {
    function updateOnlineState() {
      setIsOnline(navigator.onLine);
    }
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (leads.data?.results?.length) {
      setCachedLeads(leads.data.results);
      saveJson(LEAD_CACHE_KEY, leads.data.results.slice(0, 50));
    }
  }, [leads.data]);

  useEffect(() => {
    saveJson(LEAD_OFFLINE_QUEUE_KEY, offlineQueue);
  }, [offlineQueue]);

  useEffect(() => {
    if (!isOnline || !business || !offlineQueue.length) return;
    let cancelled = false;
    async function syncOfflineQueue() {
      const synced: string[] = [];
      for (const item of offlineQueue) {
        if (cancelled) return;
        try {
          if (item.type === "note") await leadsApi.addNote({ id: item.leadId, text: item.text });
          if (item.type === "task") {
            const lead = allLeads.find((row) => row.id === item.leadId);
            if (!lead) continue;
            await tasksApi.create({
              business: business.id,
              title: item.title,
              description: "",
              client: lead.client,
              lead: lead.id,
              deal: null,
              appointment: null,
              parent_task: null,
              assignee: item.assignee ? Number(item.assignee) : lead.responsible_user || null,
              due_at: new Date(item.due_at).toISOString(),
              reminder_at: null,
              priority: item.priority,
              recurrence_rule: "",
            });
          }
          synced.push(item.id);
        } catch {
          break;
        }
      }
      if (!synced.length) return;
      setOfflineQueue((value) => value.filter((item) => !synced.includes(item.id)));
      setNotice(t("leads.offlineSynced", { count: synced.length }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-events"] }),
      ]);
    }
    syncOfflineQueue();
    return () => {
      cancelled = true;
    };
  }, [allLeads, business, isOnline, offlineQueue, queryClient, t]);

  useEffect(() => {
    if (!business || !isOnline) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void leads.refetch().catch((error) => captureFrontendError(error, { feature: "leads", action: "poll" }));
      }
    }, realtimeIntervals.leadsPollingMs);
    return () => window.clearInterval(timer);
  }, [business, isOnline, leads]);

  useEffect(() => {
    if (!leads.data?.results) return;
    const currentIds = new Set(leads.data.results.map((lead) => lead.id));
    const knownIds = knownLeadIdsRef.current;
    if (knownIds) {
      const added = leads.data.results.filter((lead) => !knownIds.has(lead.id));
      if (added.length) {
        setNotice(t("leads.realtimeNewLeads", { count: added.length }));
        trackFrontendEvent("leads_realtime_added", { count: added.length });
      }
    }
    knownLeadIdsRef.current = currentIds;
  }, [leads.data, t]);

  const leadMutation = useMutation({
    mutationFn: (payload: LeadCreatePayload) => leadsApi.create(payload),
    onSuccess: async (lead) => {
      setCreateOpen(false);
      setNotice(t("leads.noticeCreated"));
      setSelectedId(lead.id);
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, lead, user_id, lost_reason }: { action: LeadAction; lead: Lead; user_id?: Id; lost_reason?: string }) => {
      if (action === "take") return leadsApi.takeInWork({ id: lead.id });
      if (action === "contacted") return leadsApi.markContacted({ id: lead.id });
      if (action === "deal") return leadsApi.createDeal({ id: lead.id });
      if (action === "closed") return leadsApi.markClosed({ id: lead.id });
      if (action === "reopen") return leadsApi.reopen({ id: lead.id });
      if (action === "assign") return leadsApi.assign({ id: lead.id, user_id });
      if (!lost_reason) throw new Error(t("leads.lostReasonRequired"));
      return leadsApi.markLost({ id: lead.id, lost_reason });
    },
    onSuccess: async (_, variables) => {
      const labels = {
        take: t("leads.noticeTaken"),
        contacted: t("leads.noticeContacted"),
        deal: t("leads.noticeDealCreated"),
        closed: t("leads.noticeClosed"),
        lost: t("leads.noticeLost"),
        reopen: t("leads.noticeReopened"),
        assign: t("leads.noticeAssigned"),
      };
      setNotice(labels[variables.action]);
      if (variables.action === "assign") {
        pushHistory({
          message: t("leads.noticeAssigned"),
          undo: async () => {
            await leadsApi.assign({ id: variables.lead.id, user_id: variables.lead.responsible_user || undefined });
            await queryClient.invalidateQueries({ queryKey: ["leads"] });
          },
          redo: async () => {
            await leadsApi.assign({ id: variables.lead.id, user_id: variables.user_id });
            await queryClient.invalidateQueries({ queryKey: ["leads"] });
          },
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["deals"] }),
      ]);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ leads, reason }: { leads: Lead[]; reason: string }) => Promise.all(leads.map((lead) => leadsApi.archive({ id: lead.id, reason }))),
    onSuccess: async (_, variables) => {
      setSelectedLeadIds([]);
      setContextMenu(null);
      setNotice(t("leads.noticeArchived", { count: variables.leads.length }));
      pushHistory({
        message: t("leads.noticeArchived", { count: variables.leads.length }),
        undo: async () => {
          await Promise.all(variables.leads.map((lead) => leadsApi.restore(lead.id)));
          await queryClient.invalidateQueries({ queryKey: ["leads"] });
        },
        redo: async () => {
          await Promise.all(variables.leads.map((lead) => leadsApi.archive({ id: lead.id, reason: variables.reason })));
          await queryClient.invalidateQueries({ queryKey: ["leads"] });
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const bulkContactMutation = useMutation({
    mutationFn: (selectedLeads: Lead[]) => Promise.all(selectedLeads.map((lead) => leadsApi.markContacted({ id: lead.id }))),
    onSuccess: async (_, selectedLeads) => {
      setSelectedLeadIds([]);
      setNotice(t("leads.bulkDone"));
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const mergeClientMutation = useMutation({
    mutationFn: async ({ targetId, duplicateId }: { targetId: Id; duplicateId: Id }) => {
      const preview = await clientsApi.mergeDryRun({ id: targetId, duplicate_client_id: duplicateId });
      const transferredCount = Object.values(preview.transferred).reduce((sum, value) => sum + value, 0);
      const confirmed = window.confirm(t("clients.mergePreviewConfirm", { count: transferredCount }));
      if (!confirmed) return null;
      return clientsApi.merge({ id: targetId, duplicate_client_id: duplicateId });
    },
    onSuccess: async (result) => {
      if (!result) return;
      setNotice(t("leads.duplicatesMerged"));
      await queryClient.invalidateQueries();
    },
  });

  const noteMutation = useMutation({
    mutationFn: async ({ lead, text, files }: { lead: Lead; text: string; files: File[] }) => {
      if (!navigator.onLine) {
        enqueueOfflineAction({
          id: `note-${lead.id}-${Date.now()}`,
          type: "note",
          leadId: lead.id,
          text: `${text.trim() || t("leads.filesAttachedNote")}${files.length ? `\n\n${t("leads.offlineFilesSkipped")}` : ""}`,
          createdAt: new Date().toISOString(),
        });
        return { offline: true };
      }
      const uploaded = await Promise.all(
        files.map((file) =>
          fileAttachmentsApi.upload({
            business: business!.id,
            entityType: "lead",
            entityId: lead.id,
            file,
          }),
        ),
      );
      const attachmentText = uploaded.length
        ? `\n\n${t("leads.attachments")}:\n${uploaded.map((attachment) => `- ${attachment.original_name}: ${attachment.download_url}`).join("\n")}`
        : "";
      const noteText = `${text.trim() || t("leads.filesAttachedNote")}${attachmentText}`;
      return leadsApi.addNote({ id: lead.id, text: noteText });
    },
    onSuccess: async (result, variables) => {
      if (result && "offline" in result) {
        setNotice(t("leads.offlineQueued"));
        return;
      }
      setNotice(t("leads.noteAdded"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crm-card", "lead", variables.lead.id] }),
        queryClient.invalidateQueries({ queryKey: ["file-attachments"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-events"] }),
      ]);
    },
  });

  const nextActionMutation = useMutation<Task | { offline: true }, Error, Lead>({
    mutationFn: (lead: Lead) => {
      if (!navigator.onLine) {
        enqueueOfflineAction({
          id: `task-${lead.id}-${Date.now()}`,
          type: "task",
          leadId: lead.id,
          title: nextActionDraft.title,
          due_at: nextActionDraft.due_at,
          assignee: nextActionDraft.assignee,
          priority: nextActionDraft.priority,
          createdAt: new Date().toISOString(),
        });
        return Promise.resolve({ offline: true });
      }
      const payload: TaskCreatePayload = {
        business: business!.id,
        title: nextActionDraft.title,
        description: "",
        client: lead.client,
        lead: lead.id,
        deal: null,
        appointment: null,
        parent_task: null,
        assignee: nextActionDraft.assignee ? Number(nextActionDraft.assignee) : lead.responsible_user || null,
        due_at: new Date(nextActionDraft.due_at).toISOString(),
        reminder_at: null,
        priority: nextActionDraft.priority,
        recurrence_rule: "",
      };
      return tasksApi.create(payload);
    },
    onSuccess: async (result) => {
      setNextActionOpen(false);
      if (result && "offline" in result) {
        setNotice(t("leads.offlineQueued"));
        return;
      }
      setNotice(t("leads.noticeNextActionCreated"));
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const appointmentMutation = useMutation({
    mutationFn: (payload: AppointmentCreatePayload) => {
      if (!selected?.id || !payload.service || !payload.start_at) throw new Error(t("leads.appointmentSelectionRequired"));
      return leadsApi.createAppointment({
        leadId: selected.id,
        payload: { service: payload.service, resource: payload.resource || null, start_at: payload.start_at },
      });
    },
    onSuccess: async () => {
      setAppointmentOpen(false);
      setNotice(t("leads.appointmentCreated"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
      ]);
    },
  });

  function pushHistory(item: UndoToast) {
    const nextItem = { ...item, id: String(Date.now()) };
    setUndoStack((value) => [nextItem, ...value].slice(0, 20));
    setRedoStack([]);
    setUndoToast(item);
  }

  function enqueueOfflineAction(action: OfflineLeadAction) {
    setOfflineQueue((value) => [...value, action].slice(-40));
    setNotice(t("leads.offlineQueued"));
  }

  async function runUndo() {
    const [item, ...rest] = undoStack;
    if (!item) return;
    await item.undo();
    setUndoStack(rest);
    setRedoStack((value) => [item, ...value].slice(0, 20));
    setUndoToast(null);
    setNotice(t("leads.actionUndone"));
  }

  async function runRedo() {
    const [item, ...rest] = redoStack;
    if (!item) return;
    await item.redo();
    setRedoStack(rest);
    setUndoStack((value) => [item, ...value].slice(0, 20));
    setNotice(t("leads.actionRedone"));
  }

  function openLead(lead: Lead) {
    setSelectedId(lead.id);
    setDrawerEntity({ type: "lead", id: lead.id });
    setContextMenu(null);
    const next = new URLSearchParams(searchParams);
    next.set("lead", String(lead.id));
    next.delete("create");
    setSearchParams(next, { replace: true });
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
      ?.replace(/\{\{имя\}\}/g, client?.full_name || "")
      .replace(/\{\{name\}\}/g, client?.full_name || "")
      .replace(/\{\{услуга\}\}/g, service?.name || "")
      .replace(/\{\{service\}\}/g, service?.name || "");
    window.open(`https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`, "_blank", "noopener,noreferrer");
  }

  function createTaskForLead(lead: Lead) {
    setSelectedId(lead.id);
    setNextActionDraft((value) => ({ ...value, title: nextAction(lead, t) }));
    setNextActionOpen(true);
  }

  function changeLeadStatus(lead: Lead, status: Lead["status"]) {
    if (status === lead.status) return;
    if (status === "contacted") {
      actionMutation.mutate({ action: "contacted", lead });
      return;
    }
    if (status === "in_progress") {
      actionMutation.mutate({ action: "take", lead });
      return;
    }
    if (status === "closed") {
      actionMutation.mutate({ action: "closed", lead });
      return;
    }
    if (status === "lost") {
      setLostLead(lead);
      setLostReason(lead.lost_reason || "");
      return;
    }
    if (status === "new" && ["closed", "lost"].includes(lead.status)) {
      actionMutation.mutate({ action: "reopen", lead });
      return;
    }
    setNotice(t("leads.useActionForStatus"));
  }

  function toggleBulkLead(id: Id) {
    setSelectedLeadIds((value) => (value.includes(id) ? value.filter((item) => item !== id) : [...value, id]));
  }

  function toggleAllPageRows() {
    const pageIds = pageRows.map((lead) => lead.id);
    const allSelected = pageIds.every((id) => selectedLeadIds.includes(id));
    setSelectedLeadIds((value) => (allSelected ? value.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...value, ...pageIds]))));
  }

  function showMoreKanban(status: Lead["status"]) {
    setKanbanVisibleCounts((value) => ({ ...value, [status]: (value[status] || 10) + 10 }));
  }

  function savePreset() {
    const name = presetName.trim() || t("leads.defaultPresetName");
    setFilterPresets((value) => [{ id: String(Date.now()), name, filter, source, search }, ...value].slice(0, 8));
    setPresetName("");
    setNotice(t("leads.filterSaved"));
  }

  function applyPreset(preset: FilterPreset) {
    setFilter(preset.filter);
    setSource(preset.source);
    setSearch(preset.search);
  }

  function getExportRows() {
    const headers = [t("leads.tableLead"), t("leads.tablePhone"), t("leads.source"), t("leads.tableStatus"), t("leads.priority"), t("leads.responsible"), t("leads.lastActivity"), t("leads.nextStep")];
    const data = rows.map((lead) => {
      const client = getClient(lead, clientList);
      const service = getService(lead, serviceList);
      const responsible = teamList.find((member) => member.user.id === lead.responsible_user);
      return {
        [headers[0]]: client?.full_name || t("leads.leadFallback", { id: lead.id }),
        [headers[1]]: client?.phone || "",
        [headers[2]]: getSourceLabel(lead.source, t),
        [headers[3]]: getStatusLabel(lead.status, t),
        [headers[4]]: lead.status === "new" && !lead.responsible_user ? t("leads.priorityHot") : t("leads.priorityNormal"),
        [headers[5]]: responsible?.user.full_name || responsible?.user.email || t("leads.withoutManager"),
        [headers[6]]: formatDateTime(lead.updated_at),
        [headers[7]]: nextAction(lead, t),
      };
    });
    return { headers, data };
  }

  async function exportRows(kind: "csv" | "excel") {
    const { headers, data } = getExportRows();
    if (kind === "excel") {
      await writeXlsxFile(
        [
          headers.map((header) => ({ value: header, fontWeight: "bold" as const })),
          ...data.map((row) => headers.map((header) => ({ value: String(row[header] ?? "") }))),
        ],
        { sheet: t("nav.leads").slice(0, 31), columns: headers.map(() => ({ width: 24 })) },
      ).toFile("zani-leads.xlsx");
      return;
    }
    const lines = data.map((row) => headers.map((header) => toCsvValue(row[header])).join(","));
    downloadText("zani-leads.csv", [headers.map(toCsvValue).join(","), ...lines].join("\n"), "text/csv;charset=utf-8");
  }

  async function shareView() {
    const params = new URLSearchParams(searchParams);
    params.set("filter", filter);
    if (source) params.set("source", source);
    else params.delete("source");
    if (search) params.set("search", search);
    else params.delete("search");
    params.set("view", viewMode);
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    await navigator.clipboard?.writeText(url);
    setNotice(t("leads.viewCopied"));
  }

  function closeCreateModal() {
    setCreateOpen(false);
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
    }

    function handleKeyDown(event: KeyboardEvent) {
      const editable = isEditableTarget(event.target);
      if (editable && event.key !== "Escape") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      if (event.key === "Escape") {
        setContextMenu(null);
        setShortcutsOpen(false);
        return;
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setCreateOpen(true);
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (!selected && !rows.length) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const currentIndex = selected ? rows.findIndex((lead) => lead.id === selected.id) : -1;
        const nextIndex = event.key === "ArrowDown" ? Math.min(rows.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
        const nextLead = rows[nextIndex] || rows[0];
        if (nextLead) openLead(nextLead);
        return;
      }

      if (event.key === "Enter" && selected) {
        event.preventDefault();
        openLead(selected);
        return;
      }

      if (event.key.toLowerCase() === "c" && selected) {
        event.preventDefault();
        callLead(selected);
        return;
      }

      if (event.key.toLowerCase() === "w" && selected) {
        event.preventDefault();
        whatsAppLead(selected);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, selected, searchParams, setSearchParams]);

  if (!business) return <ErrorState message={t("leads.noBusiness")} />;
  if (leads.isLoading || clients.isLoading || services.isLoading || tasks.isLoading) return <PageSkeleton />;

  const actionError =
    leadMutation.error ||
    actionMutation.error ||
    archiveMutation.error ||
    bulkContactMutation.error ||
    mergeClientMutation.error ||
    noteMutation.error ||
    appointmentMutation.error ||
    nextActionMutation.error ||
    clients.error ||
    services.error ||
    leads.error;
  const filters = [
    { value: "all" as const, label: t("leads.filterAll"), count: leadSummary.data?.total ?? totalLeadCount },
    { value: "new" as const, label: t("leads.filterNew"), count: leadSummary.data?.new ?? allLeads.filter((lead) => lead.status === "new").length },
    { value: "hot" as const, label: t("leads.filterHot"), count: leadSummary.data?.hot ?? allLeads.filter((lead) => lead.status === "new" && !lead.responsible_user).length },
    { value: "unanswered" as const, label: t("leads.filterUnanswered"), count: leadSummary.data?.unanswered ?? allLeads.filter((lead) => !lead.responsible_user).length },
    { value: "attention" as const, label: t("leads.filterAttention"), count: leadSummary.data?.attention ?? allLeads.filter((lead) => {
      const insight = aiInsights.get(lead.id);
      return insight?.stale || (insight?.lossRisk || 0) >= 70;
    }).length },
    { value: "mine" as const, label: t("leads.filterMine"), count: leadSummary.data?.mine ?? allLeads.filter((lead) => user?.id && lead.responsible_user === user.id).length },
  ];
  const priorityLead = allLeads.find((lead) => !lead.responsible_user && lead.status === "new") || allLeads[0] || null;
  const pageStart = pageRows.length ? (safePage - 1) * pageSize + 1 : 0;
  const pageEnd = pageRows.length ? pageStart + pageRows.length - 1 : 0;
  const tableVisibleRowCount = Math.max(1, pageRows.length || Math.min(pageSize, rows.length || pageSize));
  const tablePanelHeight = Math.max(700, tableVisibleRowCount * 66 + 250);
  const activeTableColumns = columnOrder.filter((column) => visibleColumns[column]);
  const tableGridTemplateColumns = `32px ${activeTableColumns.map((column) => leadColumnWidths[column]).join(" ")}`;
  const tableGridMinWidth = activeTableColumns.length > 5 ? 1120 : undefined;
  const visiblePages = Array.from({ length: pageCount })
    .map((_, index) => index + 1)
    .filter((itemPage) => pageCount <= 5 || itemPage === 1 || itemPage === pageCount || Math.abs(itemPage - safePage) <= 1)
    .slice(0, 7);
  function jumpToPage(value: string) {
    const nextPage = Number(value);
    if (!Number.isFinite(nextPage)) return;
    setPage(Math.min(pageCount, Math.max(1, Math.trunc(nextPage))));
  }

  return (
    <CrmWorkspacePage className="h-auto min-h-[calc(100vh-5.5rem)]" contentClassName="gap-4 pb-4">
      {notice ? <div className="rounded-xl border border-ai-100 bg-ai-50 px-4 py-3 text-sm font-bold text-ai-800">{notice}</div> : null}
      {!isOnline || offlineQueue.length ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <WifiOff size={17} />
            {!isOnline ? t("leads.offlineMode") : t("leads.offlinePending", { count: offlineQueue.length })}
          </span>
          {offlineQueue.length ? <span className="text-xs font-black uppercase tracking-[0.12em] text-amber-700">{t("leads.offlinePending", { count: offlineQueue.length })}</span> : null}
        </div>
      ) : null}
      {actionError ? <ErrorState message={getApiErrorMessage(actionError)} /> : null}

      <section className={cn(
        "grid gap-4",
        viewMode === "kanban" ? "xl:min-h-[1320px]" : "xl:items-start",
        "xl:grid-cols-1",
      )}>
        <div className="flex min-h-0 flex-col gap-4">
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.04)]"
            style={viewMode === "table" ? { height: tablePanelHeight } : { minHeight: 1280 }}
          >
          <div className="shrink-0 border-b border-slate-100 px-4 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <label className="relative flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500 shadow-sm">
                <Search size={17} />
                <input
                  ref={searchInputRef}
                  className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:text-slate-400"
                  placeholder={t("leads.search")}
                  value={search}
                  onChange={(event) => setSearch(normalizePhoneSearchInput(event.target.value))}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setSearchFocused(false), 140)}
                />
                {searchFocused && search.trim().length >= 2 ? (
                  <div className="absolute left-0 right-0 top-11 z-30 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    <p className="px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">{t("leads.searchSuggestions")}</p>
                    {searchSuggestions.length ? searchSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setSearch(item.label);
                          if (item.lead) openLead(item.lead);
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-midnight">{item.label}</span>
                          <span className="block truncate text-xs font-semibold text-slate-500">{item.meta}</span>
                        </span>
                        <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">{item.type}</span>
                      </button>
                    )) : (
                      <p className="px-2 py-3 text-sm font-semibold text-slate-500">{t("leads.noSuggestions")}</p>
                    )}
                  </div>
                ) : null}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-10 shrink-0 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                  <button
                    type="button"
                    className={cn("grid h-8 w-8 place-items-center rounded-md", viewMode === "table" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50")}
                    onClick={() => {
                      setViewMode("table");
                    }}
                    aria-label={t("leads.viewTable")}
                  >
                    <Table2 size={16} />
                  </button>
                  <button
                    type="button"
                    className={cn("grid h-8 w-8 place-items-center rounded-md", viewMode === "kanban" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50")}
                    onClick={() => {
                      setViewMode("kanban");
                    }}
                    aria-label={t("leads.viewKanban")}
                  >
                    <KanbanSquare size={16} />
                  </button>
                </div>
                <Button variant="secondary" className="h-10 rounded-lg px-3" onClick={() => setSavedFiltersOpen((value) => !value)}>
                  <SlidersHorizontal size={16} />
                  {t("leads.filters")}
                  {filterPresets.length ? <span className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-xs font-black text-slate-500">{filterPresets.length}</span> : null}
                </Button>
                <Button variant="secondary" size="icon" className="h-10 w-10 rounded-lg px-0" aria-label={t("leads.moreActions")} onClick={() => setMoreMenuOpen((value) => !value)}>
                  <MoreHorizontal size={17} />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={cn(
                    "inline-flex min-h-8 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-bold transition",
                    filter === item.value ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-brand-100 hover:text-midnight",
                  )}
                >
                  {item.label}
                  <span className={cn("rounded-md px-1.5 py-0.5 text-xs", filter === item.value ? "bg-white text-brand-700" : "bg-slate-100 text-slate-500")}>{item.count}</span>
                </button>
              ))}
              <span className="h-7 w-px shrink-0 bg-slate-200" />
              {["whatsapp", "telegram", "instagram", "website"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSource(source === item ? "" : item)}
                  className={cn(
                    "inline-flex min-h-8 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-bold transition",
                    source === item ? "border-brand-200 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:border-brand-100 hover:text-midnight",
                  )}
                >
                  <SourceBadge source={item} t={t} />
                </button>
              ))}
            </div>
            {savedFiltersOpen ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-2">
                  {filterPresets.length ? filterPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                      onClick={() => {
                        applyPreset(preset);
                        setSavedFiltersOpen(false);
                      }}
                    >
                      {preset.name}
                    </button>
                  )) : (
                    <span className="py-2 text-xs font-semibold text-slate-400">{t("leads.noSavedFilters")}</span>
                  )}
                </div>
                <div className="mt-2 flex gap-2 border-t border-slate-200 pt-3">
                  <input
                    className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-brand-300"
                    placeholder={t("leads.filterPresetName")}
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                  />
                  <Button variant="secondary" size="sm" className="shrink-0 rounded-lg" onClick={savePreset}>{t("leads.saveFilter")}</Button>
                </div>
              </div>
            ) : null}
            {moreMenuOpen ? (
              <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Columns3 size={16} /> {t("leads.columns")}
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    {columnOrder.map((column) => (
                      <label key={column} className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:border-brand-200">
                        <input
                          type="checkbox"
                          checked={visibleColumns[column]}
                          onChange={() => setVisibleColumns((value) => ({ ...value, [column]: !value[column] }))}
                        />
                        <span className="truncate">{t(`leads.column.${column}`)}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <Button variant="secondary" size="sm" className="rounded-lg" onClick={() => setSortByAi((value) => !value)}><Flame size={15} /> {t("leads.sortByHeat")}</Button>
                  <Button variant="secondary" size="sm" className="rounded-lg" onClick={() => exportRows("csv")}><Download size={15} /> CSV</Button>
                  <Button variant="secondary" size="sm" className="rounded-lg" onClick={() => exportRows("excel")}>{t("leads.exportExcel")}</Button>
                  <Button variant="secondary" size="sm" className="rounded-lg" onClick={shareView}><Share2 size={15} /> {t("leads.shareView")}</Button>
                </div>
              </div>
            ) : null}
          </div>
          {viewMode === "table" ? (
            <div className="hidden shrink-0 overflow-x-auto lg:block">
              <div
                className="sticky top-0 z-10 grid min-w-0 border-b border-slate-100 bg-slate-50/95 px-4 py-3 text-xs font-bold text-slate-500 backdrop-blur"
                style={{ gridTemplateColumns: tableGridTemplateColumns, minWidth: tableGridMinWidth }}
              >
                <label className="flex h-5 w-5 items-center justify-center">
                  <input className="sr-only" type="checkbox" checked={pageRows.length > 0 && pageRows.every((lead) => selectedLeadIds.includes(lead.id))} onChange={toggleAllPageRows} aria-label={t("leads.selectAll")} />
                  <span className={cn("grid h-5 w-5 place-items-center rounded border", pageRows.length > 0 && pageRows.every((lead) => selectedLeadIds.includes(lead.id)) ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white")}>
                    {pageRows.length > 0 && pageRows.every((lead) => selectedLeadIds.includes(lead.id)) ? <CheckCheck size={13} /> : null}
                  </span>
                </label>
                {activeTableColumns.map((column) => (
                  <span key={column}>{t(`leads.column.${column}`)}</span>
                ))}
              </div>
            </div>
          ) : null}
          <div className={cn("min-h-0 flex-1", viewMode === "table" ? "overflow-hidden lg:min-h-[430px]" : "overflow-visible")}>
            {!rows.length ? (
              <div className="grid h-full min-h-[320px] place-items-center p-5">
                <div className="max-w-sm text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    <Plus size={22} />
                  </div>
                  <h3 className="mt-4 text-lg font-black text-midnight">{t("leads.emptyTitle")}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{t("leads.emptyText")}</p>
                  <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus size={16} /> {t("leads.createFirstLead")}
                    </Button>
                    <Button variant="secondary" onClick={() => { window.location.href = "/app/integrations"; }}>
                      <SlidersHorizontal size={16} /> {t("leads.setupIntegrations")}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              viewMode === "kanban" ? (
                <div className="flex min-h-[1060px] gap-3 overflow-x-auto overflow-y-visible p-4">
                  {kanbanStatuses.map((status) => {
                    const columnRows = rows.filter((lead) => lead.status === status);
                    const visibleCount = kanbanVisibleCounts[status] || 10;
                    const visibleColumnRows = columnRows.slice(0, visibleCount);
                    const hiddenCount = Math.max(0, columnRows.length - visibleColumnRows.length);
                    return (
                      <section
                        key={status}
                        className="flex min-h-[1020px] w-[320px] shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-3"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          const leadId = Number(event.dataTransfer.getData("text/plain"));
                          const lead = rows.find((item) => item.id === leadId);
                          if (lead && lead.status !== status) changeLeadStatus(lead, status);
                        }}
                      >
                        <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-black text-midnight">{getStatusLabel(status, t)}</p>
                            <p className="truncate text-xs font-semibold text-slate-500">{columnRows.length ? t("leads.dropHere") : t("leads.noLeadsInColumn")}</p>
                          </div>
                          <span className="rounded-lg bg-white px-2 py-1 text-xs font-black text-slate-500">{columnRows.length}</span>
                        </div>
                        <div className="space-y-2 pr-1">
                          {visibleColumnRows.map((lead) => {
                            const client = getClient(lead, clientList);
                            const service = getService(lead, serviceList);
                            const insight = aiInsights.get(lead.id) || leadAiInsight(lead, clientList, serviceList, allLeads, t);
                            const title = client?.full_name || t("leads.leadFallback", { id: lead.id });
                            return (
                              <button
                                key={lead.id}
                                type="button"
                                draggable
                                onDragStart={(event) => event.dataTransfer.setData("text/plain", String(lead.id))}
                                onClick={() => openLead(lead)}
                                className={cn(
                                  "w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-brand-200 hover:shadow-md",
                                  selected?.id === lead.id && "border-brand-300 bg-brand-50 ring-2 ring-brand-100 shadow-[inset_3px_0_0_#2563eb]",
                                  insight.stale && selected?.id !== lead.id && "bg-amber-50/50",
                                )}
                              >
                                <p className="truncate text-sm font-black text-midnight">{title}</p>
                                <p className="mt-1 truncate text-xs font-semibold text-slate-500">{client?.phone || service?.name || getSourceLabel(lead.source, t)}</p>
                                <div className="mt-2 flex items-center justify-between gap-2">
                                  <SourceBadge source={lead.source} t={t} />
                                  <span className="text-xs font-bold text-slate-400">{formatRelativeTime(lead.updated_at, t)}</span>
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                    <span className={cn("block h-full rounded-full", insight.score >= 75 ? "bg-emerald-500" : insight.score >= 50 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${insight.score}%` }} />
                                  </span>
                                  <span className="text-[11px] font-black text-slate-500">{insight.score}</span>
                                </div>
                              </button>
                            );
                          })}
                          {!columnRows.length ? (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 p-4 text-center text-xs font-bold text-slate-400">
                              {t("leads.dropHere")}
                            </div>
                          ) : null}
                          {hiddenCount > 0 ? (
                            <button
                              type="button"
                              className="mt-1 flex w-full items-center justify-center rounded-xl border border-dashed border-brand-200 bg-white px-3 py-3 text-sm font-black text-brand-700 transition hover:border-brand-300 hover:bg-brand-50"
                              onClick={() => showMoreKanban(status)}
                            >
                              {t("leads.showMoreInColumn", { count: Math.min(10, hiddenCount) })}
                            </button>
                          ) : null}
                        </div>
                      </section>
                    );
                  })}
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
                  openLead={openLead}
                  toggleBulkLead={toggleBulkLead}
                  changeLeadStatus={changeLeadStatus}
                  assignLead={(lead, userId) => actionMutation.mutate({ action: "assign", lead, user_id: userId })}
                  openContextMenu={(event, lead) => {
                    event.preventDefault();
                    setContextMenu({ x: event.clientX, y: event.clientY, lead });
                  }}
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
                      onClick={() => openLead(lead)}
                      onSwipeLeft={() => archiveMutation.mutate({ leads: [lead], reason: t("leads.archiveReasonDefault") })}
                      onSwipeRight={() => actionMutation.mutate({ action: "take", lead })}
                      onLongPress={(event) => {
                        const touch = "touches" in event ? event.touches[0] || event.changedTouches[0] : event;
                        setContextMenu({ x: touch?.clientX || window.innerWidth / 2, y: touch?.clientY || window.innerHeight / 2, lead });
                      }}
                      t={t}
                    />
                  ))}
                </div>
                </>
              )
            )}
          </div>
          {viewMode === "table" ? (
          <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500 lg:flex-row lg:items-center lg:justify-between">
            <span>{t("leads.tableShowingRange", { start: pageStart, end: pageEnd, total: totalLeadCount })}</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-500">
                <span>{t("leads.pageSize")}</span>
                <select
                  className="bg-transparent text-xs font-black text-midnight outline-none"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                    setPageDraft("1");
                  }}
                  aria-label={t("leads.pageSize")}
                >
                  {[10, 30, 50, 100].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
              <Button variant="secondary" size="icon" className="h-8 w-8 rounded-lg px-0" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                <ChevronLeft size={16} />
              </Button>
              {visiblePages.map((itemPage, index) => (
                <button
                  key={`${itemPage}-${index}`}
                  type="button"
                  onClick={() => setPage(itemPage)}
                  className={cn("grid h-8 w-8 place-items-center rounded-lg border text-sm font-bold", itemPage === safePage ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500 hover:text-midnight")}
                >
                  {itemPage}
                </button>
              ))}
              <Button variant="secondary" size="icon" className="h-8 w-8 rounded-lg px-0" disabled={safePage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
                <ChevronRight size={16} />
              </Button>
              <form
                className="ml-2 flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  jumpToPage(pageDraft);
                }}
              >
                <input
                  className="h-8 w-14 rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-bold text-midnight outline-none focus:border-brand-300"
                  inputMode="numeric"
                  value={pageDraft}
                  onChange={(event) => setPageDraft(event.target.value)}
                  onBlur={() => jumpToPage(pageDraft)}
                  aria-label={t("leads.pageNumber")}
                />
                <span className="text-slate-400">/ {pageCount}</span>
              </form>
            </div>
          </div>
          ) : null}
          </div>
        </div>
      </section>

      {contextMenu ? (
        <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)}>
          <div
            className="absolute w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            {[
              { label: t("leads.open"), icon: CircleDot, onClick: () => openLead(contextMenu.lead) },
              { label: t("leads.call"), icon: Phone, onClick: () => callLead(contextMenu.lead) },
              { label: "WhatsApp", icon: MessageCircle, onClick: () => whatsAppLead(contextMenu.lead) },
              { label: t("leads.assignToMe"), icon: UserCheck, onClick: () => actionMutation.mutate({ action: "take", lead: contextMenu.lead }) },
              { label: t("leads.archive"), icon: XCircle, onClick: () => archiveMutation.mutate({ leads: [contextMenu.lead], reason: t("leads.archiveReasonDefault") }) },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-midnight"
                  onClick={() => {
                    item.onClick();
                    setContextMenu(null);
                  }}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {selectedLeadIds.length ? (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <div className="flex max-w-full flex-wrap items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-2xl">
            <span className="mr-2 text-sm font-black">{t("leads.bulkSelected", { count: selectedLeadIds.length })}</span>
            <select
              className="h-9 rounded-lg border border-white/10 bg-white/10 px-3 text-sm font-bold text-white outline-none"
              defaultValue=""
              onChange={(event) => {
                const userId = event.target.value ? Number(event.target.value) : undefined;
                const selectedLeads = allLeads.filter((lead) => selectedLeadIds.includes(lead.id));
                selectedLeads.forEach((lead) => actionMutation.mutate({ action: "assign", lead, user_id: userId }));
                setSelectedLeadIds([]);
              }}
            >
              <option className="text-slate-900" value="">{t("leads.bulkAssign")}</option>
              {teamList.map((member) => (
                <option className="text-slate-900" key={member.user.id} value={member.user.id}>{member.user.full_name || member.user.email}</option>
              ))}
            </select>
            <Button size="sm" variant="secondary" className="rounded-lg bg-white text-slate-950 hover:bg-slate-100" onClick={() => bulkContactMutation.mutate(allLeads.filter((lead) => selectedLeadIds.includes(lead.id)))}>
              <MessageCircle size={15} /> {t("leads.bulkContact")}
            </Button>
            <Button size="sm" variant="secondary" className="rounded-lg bg-white text-slate-950 hover:bg-slate-100" onClick={() => archiveMutation.mutate({ leads: allLeads.filter((lead) => selectedLeadIds.includes(lead.id)), reason: t("leads.archiveReasonDefault") })}>
              <XCircle size={15} /> {t("leads.bulkArchive")}
            </Button>
            <Button size="sm" variant="ghost" className="rounded-lg text-white hover:bg-white/10" onClick={() => setSelectedLeadIds([])}>
              {t("leads.bulkReset")}
            </Button>
          </div>
        </div>
      ) : null}

      {undoToast ? (
        <div className="fixed bottom-24 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-2xl">
          <Undo2 size={17} className="text-brand-700" />
          <span className="min-w-0 flex-1">{undoToast.message}</span>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-black text-brand-700"
            onClick={async () => {
              await runUndo();
            }}
          >
            {t("leads.undo")}
          </button>
        </div>
      ) : null}

      <Modal title={t("leads.shortcuts")} open={shortcutsOpen} onClose={() => setShortcutsOpen(false)}>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["N", t("leads.shortcutNew")],
            ["F", t("leads.shortcutSearch")],
            ["↑ / ↓", t("leads.shortcutNavigate")],
            ["Enter", t("leads.shortcutOpen")],
            ["C", t("leads.shortcutCall")],
            ["W", t("leads.shortcutWhatsApp")],
            ["Esc", t("leads.shortcutClose")],
            ["?", t("leads.shortcutHelp")],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm font-bold text-slate-600">{label}</span>
              <kbd className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-midnight shadow-sm">{key}</kbd>
            </div>
          ))}
        </div>
      </Modal>

      <Modal title={t("leads.new")} open={createOpen} onClose={closeCreateModal}>
        <LeadForm
          businessId={business.id}
          clients={clientList}
          services={serviceList}
          teamMembers={teamList}
          onSubmit={(payload) => leadMutation.mutateAsync(payload)}
          onOpenClient={(id) => {
            setCreateOpen(false);
            setDrawerEntity({ type: "client", id });
          }}
        />
      </Modal>

      <Modal title={t("leads.bookFromLead")} open={appointmentOpen} onClose={() => setAppointmentOpen(false)}>
        <AppointmentForm
          businessId={business.id}
          clients={clientList}
          services={serviceList}
          resources={resources.data || []}
          leads={allLeads}
          prefill={{
            client: selected?.client,
            service: selected?.service,
            lead: selected?.id,
            source: "manual",
          }}
          onSubmit={(payload) => appointmentMutation.mutateAsync({ ...payload, lead: selected?.id || payload.lead, client: selected?.client || payload.client, service: selected?.service || payload.service })}
        />
      </Modal>

      <Modal title={t("leads.nextActionModal")} open={nextActionOpen} onClose={() => setNextActionOpen(false)}>
        {selected ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              nextActionMutation.mutate(selected);
            }}
          >
            <Input label={t("leads.task")} value={nextActionDraft.title} onChange={(event) => setNextActionDraft({ ...nextActionDraft, title: event.target.value })} required />
            <Input label={t("leads.deadline")} type="datetime-local" value={nextActionDraft.due_at} onChange={(event) => setNextActionDraft({ ...nextActionDraft, due_at: event.target.value })} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label={t("leads.responsible")}
                value={nextActionDraft.assignee}
                onChange={(event) => setNextActionDraft({ ...nextActionDraft, assignee: event.target.value })}
                options={[
                  { value: "", label: t("leads.leadResponsible") },
                  ...teamList.map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email })),
                ]}
              />
              <Select
                label={t("leads.priority")}
                value={nextActionDraft.priority}
                onChange={(event) => setNextActionDraft({ ...nextActionDraft, priority: event.target.value as Task["priority"] })}
                options={[
                  { value: "low", label: t("leads.priorityLow") },
                  { value: "normal", label: t("leads.priorityNormalLabel") },
                  { value: "high", label: t("leads.priorityHigh") },
                  { value: "urgent", label: t("leads.priorityUrgent") },
                ]}
              />
            </div>
            <Button type="submit" isLoading={nextActionMutation.isPending}>{t("leads.createTask")}</Button>
          </form>
        ) : null}
      </Modal>

      <Modal title={t("leads.closeAsLost")} open={Boolean(lostLead)} onClose={() => setLostLead(null)}>
        {lostLead ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              actionMutation.mutate({ action: "lost", lead: lostLead, lost_reason: lostReason });
              setLostLead(null);
              setLostReason("");
            }}
          >
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="font-black text-midnight">{leadTitle(lostLead, clientList, t)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{lostLead.message || t("leads.noComment")}</p>
            </div>
            <Select
              label={t("leads.reasonType")}
              value={lostReason}
              onChange={(event) => setLostReason(event.target.value)}
              options={[
                { value: "", label: t("leads.selectReason") },
                { value: t("leads.reasonNoAnswer"), label: t("leads.reasonNoAnswer") },
                { value: t("leads.reasonExpensive"), label: t("leads.reasonExpensive") },
                { value: t("leads.reasonCompetitor"), label: t("leads.reasonCompetitor") },
                { value: t("leads.reasonNoBudget"), label: t("leads.reasonNoBudget") },
                { value: t("leads.reasonDuplicate"), label: t("leads.reasonDuplicate") },
                { value: t("leads.reasonIrrelevant"), label: t("leads.reasonIrrelevant") },
              ]}
            />
            <Input label={t("leads.comment")} value={lostReason} onChange={(event) => setLostReason(event.target.value)} required />
            <Button type="submit" variant="danger" isLoading={actionMutation.isPending} disabled={!lostReason}>{t("leads.closeAsLost")}</Button>
          </form>
        ) : null}
      </Modal>

      <CrmEntityDrawer entity={drawerEntity} onClose={closeDrawer} />
    </CrmWorkspacePage>
  );
}
