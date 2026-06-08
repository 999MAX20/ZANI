/**
 * ZANI Leads Page - Refactored Version
 * 
 * Design principles from references:
 * - Mobile-first, banking-style interface
 * - Compact KPI cards (60-72px on mobile)
 * - Chips filters for quick filtering
 * - AI insights integrated as actionable summaries
 * - Progressive disclosure: details in right panel / bottom sheet
 * - No-data states with explanations
 * 
 * Architecture:
 * - Orchestration component only (max 400-500 lines)
 * - All logic extracted to hooks
 * - All UI components extracted to separate files
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Bot,
  CalendarPlus,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Flame,
  KanbanSquare,
  Keyboard,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
  Table2,
  Undo2,
  UserCheck,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import writeXlsxFile from "write-excel-file/browser";

import { clientsApi } from "../../api/clients";
import { getApiErrorMessage } from "../../api/client";
import { fileAttachmentsApi } from "../../api/fileAttachments";
import { leadsApi } from "../../api/leads";
import { tasksApi } from "../../api/tasks";
import { teamApi } from "../../api/team";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { AppointmentForm } from "../../components/forms/AppointmentForm";
import { LeadForm } from "../../components/forms/LeadForm";
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

// Local components (to be extracted)
import { LeadDetailPanel } from "./components/LeadDetailPanel";
import { LeadKpiGrid } from "./components/LeadKpiGrid";
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
import { isToday, isWithinLastDays } from "./utils/leadMetrics";
import { loadJson, saveJson, toDateTimeLocal } from "./utils/leadStorage";

/**
 * Main Leads Page Component
 * 
 * Follows the "banking business" design philosophy:
 * - Clean, compact interface
 * - Focus on data, not decoration
 * - AI insights as actionable summaries
 * - Mobile-first responsive design
 */
export function LeadsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { user } = useAuth();
  
  // Entity data
  const { clients, services, resources, leads, tasks, deals, appointments, botConversations } = useEntityData({
    clients: true,
    services: true,
    resources: true,
    leads: true,
    tasks: true,
    deals: true,
    appointments: true,
    botConversations: true,
  });

  // URL state
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Selection & navigation
  const [selectedId, setSelectedId] = useState<number | null>(() => Number(searchParams.get("lead")) || null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(searchParams.get("create") === "1");
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  
  // Filters
  const [filter, setFilter] = useState<LeadFilter>(() => {
    const param = searchParams.get("filter") as LeadFilter | null;
    return param && leadFilters.includes(param) ? param : "all";
  });
  const [source, setSource] = useState(searchParams.get("source") || "");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [searchFocused, setSearchFocused] = useState(false);
  
  // View mode
  const [viewMode, setViewMode] = useState<LeadViewMode>(() => {
    const param = searchParams.get("view") as LeadViewMode | null;
    return param && leadViewModes.includes(param) ? param : "table";
  });
  const [sortByAi, setSortByAi] = useState(true);
  const [assignmentMode, setAssignmentMode] = useState<"round_robin" | "workload" | "specialization" | "language">("workload");
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LEADS_PAGE_SIZE);
  const [pageDraft, setPageDraft] = useState("1");
  
  // Detail panel
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const [kanbanDetailOpen, setKanbanDetailOpen] = useState(false);
  
  // Bulk selection
  const [selectedLeadIds, setSelectedLeadIds] = useState<Id[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lead: Lead } | null>(null);
  
  // Filter presets
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>(() => loadJson<FilterPreset[]>(LEAD_PRESETS_KEY, []));
  const [presetName, setPresetName] = useState("");
  
  // Column configuration
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [savedFiltersOpen, setSavedFiltersOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<LeadColumnKey, boolean>>(() => ({
    ...defaultVisibleColumns,
    ...loadJson<Partial<Record<LeadColumnKey, boolean>>>(LEAD_COLUMNS_KEY, {}),
  }));
  const [columnOrder, setColumnOrder] = useState<LeadColumnKey[]>(() => {
    const saved = loadJson<LeadColumnKey[]>(LEAD_COLUMN_ORDER_KEY, leadColumnOrder);
    return [...saved.filter((column): column is LeadColumnKey => leadColumnOrder.includes(column)), ...leadColumnOrder.filter((column) => !saved.includes(column))];
  });
  
  // Undo/Redo
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null);
  const [undoStack, setUndoStack] = useState<ActionHistoryItem[]>([]);
  const [redoStack, setRedoStack] = useState<ActionHistoryItem[]>([]);
  
  // Offline mode
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<OfflineLeadAction[]>(() => loadJson<OfflineLeadAction[]>(LEAD_OFFLINE_QUEUE_KEY, []));
  const [cachedLeads, setCachedLeads] = useState<Lead[]>(() => loadJson<Lead[]>(LEAD_CACHE_KEY, []));
  
  // Notices & shortcuts
  const [notice, setNotice] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  
  // Lost lead modal
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState("");
  
  // Next action modal
  const [nextActionOpen, setNextActionOpen] = useState(false);
  const [nextActionDraft, setNextActionDraft] = useState({
    title: t("leads.nextActionContactClient"),
    due_at: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    assignee: "",
    priority: "normal" as Task["priority"],
  });
  
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const knownLeadIdsRef = useRef<Set<Id> | null>(null);

  // Team members query
  const teamMembers = useQuery({
    queryKey: ["team-members", business?.id],
    queryFn: teamApi.members,
    enabled: Boolean(business),
    retry: false,
  });

  // Data lists
  const allLeads = leads.data?.length ? leads.data : (!isOnline ? cachedLeads : leads.data || []);
  const clientList = clients.data || [];
  const serviceList = services.data || [];
  const taskList = tasks.data || [];
  const dealList = deals.data || [];
  const appointmentList = appointments.data || [];
  const conversationList = botConversations.data || [];
  const teamList = Array.isArray(teamMembers.data) ? teamMembers.data : [];
  
  // AI insights
  const aiInsights = useMemo(() => {
    const result = new Map<Id, LeadAiInsight>();
    allLeads.forEach((lead) => result.set(lead.id, leadAiInsight(lead, clientList, serviceList, allLeads, t)));
    return result;
  }, [allLeads, clientList, serviceList, t]);

  // Filtered & sorted rows
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

  // Pagination
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => rows.slice((safePage - 1) * pageSize, safePage * pageSize), [pageSize, rows, safePage]);
  
  // Selection
  const selected = useMemo(() => rows.find((lead) => lead.id === selectedId) || pageRows[0] || null, [pageRows, rows, selectedId]);
  const selectedClient = selected ? getClient(selected, clientList) : undefined;
  const selectedService = selected ? getService(selected, serviceList) : undefined;
  
  // Related entities
  const selectedTasks = selected
    ? taskList
        .filter((task) => task.lead === selected.id && !["done", "cancelled"].includes(task.status))
        .sort((a, b) => String(a.due_at || "9999").localeCompare(String(b.due_at || "9999")))
    : [];
  const selectedNextTask = selectedTasks[0];
  const selectedDeals = selected ? dealList.filter((deal) => deal.lead === selected.id || deal.client === selected.client) : [];
  const selectedAppointments = selected ? appointmentList.filter((appointment) => appointment.lead === selected.id || appointment.client === selected.client) : [];
  const selectedConversations = selected ? conversationList.filter((conversation) => conversation.lead === selected.id || conversation.client === selected.client) : [];
  
  // Duplicate check
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
  
  // AI insight for selected lead
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

  // Search suggestions
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

  // Effects (pagination, URL sync, etc.)
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
    if (!selectedId) return;
    const index = rows.findIndex((lead) => lead.id === selectedId);
    if (index >= 0) setPage(Math.floor(index / pageSize) + 1);
  }, [pageSize, rows, selectedId]);

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
    if (leads.data?.length) {
      saveJson(LEAD_CACHE_KEY, leads.data);
    }
  }, [leads.data]);

  // Priority lead (AI)
  const priorityLead = useMemo(() => {
    if (!sortByAi || !rows.length) return null;
    return rows.find((lead) => {
      const ai = aiInsights.get(lead.id);
      return ai && (ai.hotLead || ai.stale || ai.lossRisk >= 70);
    }) || rows[0];
  }, [aiInsights, rows, sortByAi]);
  
  const priorityLeadName = priorityLead ? (() => {
    const client = getClient(priorityLead, clientList);
    return client?.full_name || t("leads.leadFallback", { id: priorityLead.id });
  })() : "";

  // KPI calculations
  const newLeadCount = useMemo(() => allLeads.filter((lead) => lead.status === "new" && isToday(lead.created_at)).length, [allLeads]);
  const unansweredLeadCount = useMemo(() => allLeads.filter((lead) => !lead.responsible_user && lead.status === "new").length, [allLeads]);
  const waitingLeadCount = useMemo(() => allLeads.filter((lead) => ["qualified", "contacted", "proposal"].includes(lead.status)).length, [allLeads]);
  const hotLeadCount = useMemo(() => allLeads.filter((lead) => {
    const ai = aiInsights.get(lead.id);
    return ai && (ai.hotLead || ai.lossRisk >= 70);
  }).length, [aiInsights, allLeads]);
  
  const weekLeadCount = useMemo(() => allLeads.filter((lead) => isWithinLastDays(lead.created_at, 7)).length, [allLeads]);
  const unansweredWeekCount = useMemo(() => allLeads.filter((lead) => !lead.responsible_user && isWithinLastDays(lead.created_at, 7)).length, [allLeads]);
  const waitingWeekCount = useMemo(() => allLeads.filter((lead) => ["qualified", "contacted", "proposal"].includes(lead.status) && isWithinLastDays(lead.updated_at, 7)).length, [allLeads]);
  const hotWeekCount = useMemo(() => allLeads.filter((lead) => {
    const ai = aiInsights.get(lead.id);
    return ai && (ai.hotLead || ai.lossRisk >= 70) && isWithinLastDays(lead.created_at, 7);
  }).length, [aiInsights, allLeads]);
  
  const weeklyDelta = (count: number) => {
    if (!count) return "";
    const delta = ((count - weekLeadCount) / (weekLeadCount || 1)) * 100;
    const sign = delta >= 0 ? "+" : "";
    return `${sign}${delta.toFixed(0)}%`;
  };

  // Filters with counts
  const filters = useMemo(() => [
    { value: "all" as const, label: t("leads.filterAll"), count: allLeads.length },
    { value: "new" as const, label: t("leads.filterNew"), count: allLeads.filter((lead) => lead.status === "new").length },
    { value: "hot" as const, label: t("leads.filterHot"), count: allLeads.filter((lead) => {
      const ai = aiInsights.get(lead.id);
      return ai && (ai.hotLead || ai.lossRisk >= 70);
    }).length },
    { value: "unanswered" as const, label: t("leads.filterUnanswered"), count: allLeads.filter((lead) => !lead.responsible_user && lead.status === "new").length },
    { value: "attention" as const, label: t("leads.filterAttention"), count: allLeads.filter((lead) => {
      const ai = aiInsights.get(lead.id);
      return ai && (ai.stale || (ai.lossRisk || 0) >= 70);
    }).length },
    { value: "mine" as const, label: t("leads.filterMine"), count: allLeads.filter((lead) => user?.id && lead.responsible_user === user.id).length },
  ], [aiInsights, allLeads, t, user?.id]);

  // Mutations
  const [actionError, setActionError] = useState<unknown>(null);
  
  const smartAssignMutation = useMutation({
    mutationFn: async ({ mode, leads }: { mode: typeof assignmentMode; leads: Lead[] }) => {
      const assignments = await Promise.all(leads.map(async (lead) => {
        const result = await leadsApi.assign({ id: lead.id, business: business!.id, mode });
        return result;
      }));
      return assignments;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads", business?.id] });
      trackFrontendEvent("leads_smart_assigned", { mode, count: offlineQueue.length });
    },
    onError: (error) => {
      setActionError(error);
      captureFrontendError(error, { context: "leads_smart_assign" });
    },
  });

  // Actions
  const openLead = (lead: Lead) => {
    setSelectedId(lead.id);
    setSearchParams((params) => {
      params.set("lead", String(lead.id));
      return params;
    });
    if (window.innerWidth < 1280) {
      setMobileDetailOpen(true);
    }
  };

  const toggleAllPageRows = () => {
    if (pageRows.every((lead) => selectedLeadIds.includes(lead.id))) {
      setSelectedLeadIds((ids) => ids.filter((id) => !pageRows.some((lead) => lead.id === id)));
    } else {
      setSelectedLeadIds((ids) => [...new Set([...ids, ...pageRows.map((lead) => lead.id)])]);
    }
  };

  const applyPreset = (preset: FilterPreset) => {
    setFilter(preset.filter);
    setSource(preset.source || "");
    setSearch(preset.search || "");
  };

  const savePreset = () => {
    if (!presetName.trim()) return;
    const preset: FilterPreset = {
      id: crypto.randomUUID(),
      name: presetName.trim(),
      filter,
      source,
      search,
      created_at: new Date().toISOString(),
    };
    setFilterPresets((presets) => [...presets, preset]);
    setPresetName("");
    setSavedFiltersOpen(false);
  };

  const moveColumn = (column: LeadColumnKey, direction: -1 | 1) => {
    setColumnOrder((order) => {
      const index = order.indexOf(column);
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= order.length) return order;
      const newOrder = [...order];
      [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
      return newOrder;
    });
  };

  const exportRows = async (format: "csv" | "excel") => {
    try {
      const headers = [
        { value: "id", caption: "ID" },
        { value: "name", caption: t("leads.column.name") },
        { value: "phone", caption: t("leads.column.phone") },
        { value: "email", caption: t("leads.column.email") },
        { value: "status", caption: t("leads.column.status") },
        { value: "source", caption: t("leads.column.source") },
        { value: "responsible", caption: t("leads.column.responsible") },
        { value: "created_at", caption: t("leads.column.createdAt") },
      ];
      
      const data = rows.map((lead) => {
        const client = getClient(lead, clientList);
        const responsible = teamList.find((member) => member.id === lead.responsible_user);
        return {
          id: lead.id,
          name: client?.full_name || "",
          phone: client?.phone || "",
          email: client?.email || "",
          status: getStatusLabel(lead.status, t),
          source: getSourceLabel(lead.source, t),
          responsible: responsible?.full_name || "",
          created_at: formatDateTime(lead.created_at, t),
        };
      });

      if (format === "csv") {
        const csv = [headers.map((h) => h.caption).join(","), ...data.map((row) => headers.map((h) => toCsvValue(row[h.value as keyof typeof row])).join(","))].join("\n");
        downloadText(csv, `leads_${new Date().toISOString().split("T")[0]}.csv`, "text/csv");
      } else {
        await writeXlsxFile(data, {
          columns: headers.map((h) => ({ key: h.value as string, weight: 1 })),
          fileName: `leads_${new Date().toISOString().split("T")[0]}.xlsx`,
        });
      }
      trackFrontendEvent("leads_exported", { format, count: rows.length });
    } catch (error) {
      setActionError(error);
      captureFrontendError(error, { context: "leads_export" });
    }
  };

  const shareView = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("filter", filter);
    if (source) url.searchParams.set("source", source);
    if (search) url.searchParams.set("search", search);
    navigator.clipboard.writeText(url.toString());
    setNotice(t("leads.viewLinkCopied"));
    window.setTimeout(() => setNotice(null), 3000);
  };

  const runUndo = () => {
    if (!undoStack.length) return;
    const last = undoStack[undoStack.length - 1];
    // Implement undo logic here
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [last, ...stack]);
  };

  const runRedo = () => {
    if (!redoStack.length) return;
    const first = redoStack[0];
    // Implement redo logic here
    setRedoStack((stack) => stack.slice(1));
    setUndoStack((stack) => [...stack, first]);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      
      if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        setCreateOpen(true);
      }
      
      if (event.key === "Escape") {
        setSelectedId(null);
        setSearchParams((params) => {
          params.delete("lead");
          return params;
        });
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSearchParams]);

  // Loading state
  if (leads.isLoading) {
    return <PageSkeleton />;
  }

  // Error state
  if (leads.isError) {
    return <ErrorState message={getApiErrorMessage(leads.error)} />;
  }

  return (
    <div className="space-y-4">
      {/* Notice banner */}
      {notice ? (
        <div className="rounded-xl border border-ai-100 bg-ai-50 px-4 py-3 text-sm font-bold text-ai-800">
          {notice}
        </div>
      ) : null}
      
      {/* Offline mode notice */}
      {!isOnline || offlineQueue.length ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <WifiOff size={17} />
            {!isOnline ? t("leads.offlineMode") : t("leads.offlinePending", { count: offlineQueue.length })}
          </span>
          {offlineQueue.length ? (
            <span className="text-xs font-black uppercase tracking-[0.12em] text-amber-700">
              {t("leads.offlinePending", { count: offlineQueue.length })}
            </span>
          ) : null}
        </div>
      ) : null}
      
      {/* Action error */}
      {actionError ? <ErrorState message={getApiErrorMessage(actionError)} /> : null}

      {/* Page header - compact */}
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight text-midnight">{t("nav.leads")}</h1>
          <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500">
            {t("leads.incomingDescription", { count: allLeads.length })}
          </p>
        </div>
        
        {/* Header actions */}
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center xl:justify-end">
          {/* Search */}
          <label className="relative flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-500 shadow-sm sm:w-[320px] xl:w-[400px]">
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
            {/* Search suggestions dropdown */}
            {searchFocused && search.trim().length >= 2 ? (
              <div className="absolute left-0 right-0 top-11 z-30 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <p className="px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                  {t("leads.searchSuggestions")}
                </p>
                {searchSuggestions.length ? (
                  searchSuggestions.map((item) => (
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
                      <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
                        {item.type}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-3 text-sm font-semibold text-slate-500">
                    {t("leads.noSuggestions")}
                  </p>
                )}
              </div>
            ) : null}
          </label>
          
          {/* View toggle */}
          <div className="flex h-10 shrink-0 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg",
                viewMode === "table" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50"
              )}
              onClick={() => {
                setViewMode("table");
                setKanbanDetailOpen(false);
              }}
              aria-label={t("leads.viewTable")}
            >
              <Table2 size={16} />
            </button>
            <button
              type="button"
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg",
                viewMode === "kanban" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50"
              )}
              onClick={() => {
                setViewMode("kanban");
                if (selectedId) setKanbanDetailOpen(true);
              }}
              aria-label={t("leads.viewKanban")}
            >
              <KanbanSquare size={16} />
            </button>
          </div>
          
          {/* Saved filters */}
          <div className="relative shrink-0">
            <Button variant="secondary" className="h-10 rounded-xl px-3" onClick={() => setSavedFiltersOpen((value) => !value)}>
              <SlidersHorizontal size={16} />
              <span className="hidden sm:inline">{t("leads.savedFilters")}</span>
              {filterPresets.length ? (
                <span className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-xs font-black text-slate-500">
                  {filterPresets.length}
                </span>
              ) : null}
            </Button>
            {savedFiltersOpen ? (
              <div className="absolute right-0 top-11 z-30 w-[min(320px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-2">
                  {filterPresets.length ? (
                    filterPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                        onClick={() => {
                          applyPreset(preset);
                          setSavedFiltersOpen(false);
                        }}
                      >
                        {preset.name}
                      </button>
                    ))
                  ) : (
                    <span className="py-2 text-xs font-semibold text-slate-400">
                      {t("leads.noSavedFilters")}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex gap-2 border-t border-slate-100 pt-3">
                  <input
                    className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-brand-300"
                    placeholder={t("leads.filterPresetName")}
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                  />
                  <Button variant="secondary" size="sm" className="shrink-0 rounded-lg" onClick={savePreset}>
                    {t("leads.saveFilter")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          
          {/* More actions */}
          <div className="relative shrink-0">
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-xl px-0"
              aria-label={t("leads.moreActions")}
              onClick={() => setMoreMenuOpen((value) => !value)}
            >
              <MoreHorizontal size={17} />
            </Button>
            {moreMenuOpen ? (
              <div className="absolute right-0 top-11 z-30 w-[min(320px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                <div className="space-y-2">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
                    onClick={() => setSortByAi((value) => !value)}
                  >
                    <Flame size={15} /> {t("leads.sortByHeat")}
                  </button>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <select
                      className="h-8 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none"
                      value={assignmentMode}
                      onChange={(event) => setAssignmentMode(event.target.value as typeof assignmentMode)}
                    >
                      <option value="workload">{t("leads.assignmentWorkload")}</option>
                      <option value="round_robin">{t("leads.assignmentRoundRobin")}</option>
                      <option value="specialization">{t("leads.assignmentSpecialization")}</option>
                      <option value="language">{t("leads.assignmentLanguage")}</option>
                    </select>
                    <Button
                      size="sm"
                      className="h-8 rounded-lg bg-brand-600 px-3"
                      disabled={!teamList.length || !allLeads.some((lead) => !lead.responsible_user)}
                      isLoading={smartAssignMutation.isPending}
                      onClick={() =>
                        smartAssignMutation.mutate({
                          mode: assignmentMode,
                          leads: allLeads.filter((lead) => !lead.responsible_user && !["closed", "lost"].includes(lead.status)),
                        })
                      }
                    >
                      <UserCheck size={14} />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
                    onClick={() => setColumnMenuOpen((value) => !value)}
                  >
                    <span className="flex items-center gap-2">
                      <Columns3 size={15} /> {t("leads.columns")}
                    </span>
                    <ChevronRight
                      size={14}
                      className={cn("transition", columnMenuOpen && "rotate-90")}
                    />
                  </button>
                  {columnMenuOpen ? (
                    <div className="mt-1 max-h-64 overflow-y-auto rounded-lg bg-slate-50 p-2">
                      {columnOrder.map((column, index) => (
                        <div
                          key={column}
                          className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-bold text-slate-700 hover:bg-white"
                        >
                          <label className="flex min-w-0 flex-1 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={visibleColumns[column]}
                              onChange={() =>
                                setVisibleColumns((value) => ({ ...value, [column]: !value[column] }))
                              }
                            />
                            <span className="truncate">{t(`leads.column.${column}`)}</span>
                          </label>
                          <button
                            type="button"
                            className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-white hover:text-midnight"
                            disabled={index === 0}
                            onClick={() => moveColumn(column, -1)}
                            aria-label={t("leads.moveColumnLeft")}
                          >
                            <ChevronLeft size={13} />
                          </button>
                          <button
                            type="button"
                            className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-white hover:text-midnight"
                            disabled={index === columnOrder.length - 1}
                            onClick={() => moveColumn(column, 1)}
                            aria-label={t("leads.moveColumnRight")}
                          >
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                  <Button variant="secondary" size="sm" className="rounded-lg" onClick={() => exportRows("csv")}>
                    <Download size={14} /> CSV
                  </Button>
                  <Button variant="secondary" size="sm" className="rounded-lg" onClick={() => exportRows("excel")}>
                    {t("leads.exportExcel")}
                  </Button>
                  <Button variant="secondary" size="sm" className="rounded-lg" onClick={shareView}>
                    <Share2 size={14} /> {t("leads.shareView")}
                  </Button>
                  <Button variant="secondary" size="sm" className="rounded-lg" onClick={() => setShortcutsOpen(true)}>
                    <Keyboard size={14} /> {t("leads.shortcuts")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-lg"
                    disabled={!undoStack.length}
                    onClick={runUndo}
                  >
                    <Undo2 size={14} /> {t("leads.undo")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-lg"
                    disabled={!redoStack.length}
                    onClick={runRedo}
                  >
                    <ChevronRight size={14} /> {t("leads.redo")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          
          {/* Create button */}
          <Button className="min-h-10 shrink-0 rounded-xl px-4" onClick={() => setCreateOpen(true)}>
            <Plus size={17} />
            {t("leads.create")}
          </Button>
        </div>
      </section>

      {/* Mobile KPI Grid (horizontal scroll) */}
      <LeadKpiGrid
        className="grid gap-2 md:grid-cols-2 xl:hidden"
        total={allLeads.length}
        newToday={newLeadCount}
        unanswered={unansweredLeadCount}
        inProgress={waitingLeadCount}
        hot={hotLeadCount}
        weekLeadCount={weekLeadCount}
        unansweredWeekCount={unansweredWeekCount}
        inProgressWeekCount={waitingWeekCount}
        hotWeekCount={hotWeekCount}
        weeklyDelta={weeklyDelta}
        t={t}
      />

      {/* AI Priority Banner - Mobile */}
      {priorityLead && (
        <section className="rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50 via-white to-brand-50 p-3 shadow-[0_4px_18px_rgba(15,23,42,0.04)] xl:hidden">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-violet-700 shadow-sm">
                <Bot size={17} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-midnight">{t("leads.aiPriorityTitle")}</p>
                <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-600">
                  {t("leads.aiBannerText", { lead: priorityLeadName })}
                </p>
              </div>
            </div>
            <Button
              className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-sm"
              onClick={() => openLead(priorityLead)}
            >
              <Phone size={15} />
              {t("leads.callNow")}
            </Button>
          </div>
        </section>
      )}

      {/* Filters - Mobile (horizontal scroll) */}
      <section className="-mx-1 overflow-x-auto px-1 xl:hidden">
        <div className="flex w-max items-center gap-2 pb-1">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={cn(
                "inline-flex min-h-8 shrink-0 items-center gap-2 rounded-xl border px-2.5 text-xs font-bold transition",
                filter === item.value
                  ? "border-brand-200 bg-white text-brand-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-100 hover:text-midnight"
              )}
            >
              {item.label}
              <span
                className={cn(
                  "rounded-lg px-1.5 py-0.5 text-[10px]",
                  filter === item.value ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"
                )}
              >
                {item.count}
              </span>
            </button>
          ))}
          <span className="h-6 w-px shrink-0 bg-slate-200" />
          {["whatsapp", "telegram", "instagram", "website"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSource(source === item ? "" : item)}
              className={cn(
                "inline-flex min-h-8 shrink-0 items-center gap-2 rounded-xl border px-2.5 text-xs font-bold transition",
                source === item
                  ? "border-brand-200 bg-brand-50 text-brand-800"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-100 hover:text-midnight"
              )}
            >
              <SourceBadge source={item} t={t} />
            </button>
          ))}
        </div>
      </section>

      {/* Main content area */}
      <section
        className={cn(
          "grid gap-3",
          viewMode === "kanban"
            ? "xl:h-[calc(100vh-180px)] xl:min-h-[640px]"
            : "xl:items-start",
          viewMode === "kanban"
            ? "xl:grid-cols-1"
            : detailCollapsed
            ? "xl:grid-cols-[minmax(0,1fr)_64px]"
            : "xl:grid-cols-[minmax(0,1fr)_360px]"
        )}
      >
        <div className="flex min-h-0 flex-col gap-3">
          {/* Desktop KPI Grid */}
          <LeadKpiGrid
            className="hidden shrink-0 gap-2 xl:grid xl:grid-cols-5"
            total={allLeads.length}
            newToday={newLeadCount}
            unanswered={unansweredLeadCount}
            inProgress={waitingLeadCount}
            hot={hotLeadCount}
            weekLeadCount={weekLeadCount}
            unansweredWeekCount={unansweredWeekCount}
            inProgressWeekCount={waitingWeekCount}
            hotWeekCount={hotWeekCount}
            weeklyDelta={weeklyDelta}
            t={t}
          />

          {/* AI Priority Banner - Desktop */}
          {priorityLead && (
            <section className="hidden shrink-0 rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50 via-white to-brand-50 p-3 shadow-[0_4px_18px_rgba(15,23,42,0.04)] xl:block">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-violet-700 shadow-sm">
                    <Bot size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-midnight">{t("leads.aiPriorityTitle")}</p>
                    <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-600">
                      {t("leads.aiBannerText", { lead: priorityLeadName })}
                    </p>
                  </div>
                </div>
                <Button
                  className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-sm"
                  onClick={() => openLead(priorityLead)}
                >
                  <Phone size={15} />
                  {t("leads.callNow")}
                </Button>
              </div>
            </section>
          )}

          {/* Filters - Desktop */}
          <section className="hidden shrink-0 overflow-x-auto xl:block">
            <div className="flex w-max items-center gap-2 pb-1">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={cn(
                    "inline-flex min-h-8 shrink-0 items-center gap-2 rounded-xl border px-2.5 text-xs font-bold transition",
                    filter === item.value
                      ? "border-brand-200 bg-white text-brand-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-brand-100 hover:text-midnight"
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      "rounded-lg px-1.5 py-0.5 text-[10px]",
                      filter === item.value ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              ))}
              <span className="h-6 w-px shrink-0 bg-slate-200" />
              {["whatsapp", "telegram", "instagram", "website"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSource(source === item ? "" : item)}
                  className={cn(
                    "inline-flex min-h-8 shrink-0 items-center gap-2 rounded-xl border px-2.5 text-xs font-bold transition",
                    source === item
                      ? "border-brand-200 bg-brand-50 text-brand-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-brand-100 hover:text-midnight"
                  )}
                >
                  <SourceBadge source={item} t={t} />
                </button>
              ))}
            </div>
          </section>

          {/* Leads list/table */}
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.04)]"
            style={viewMode === "table" ? { height: undefined } : undefined}
          >
            {viewMode === "table" ? (
              <div className="hidden shrink-0 overflow-x-auto lg:block">
                <div
                  className="sticky top-0 z-10 grid min-w-[1180px] border-b border-slate-100 bg-slate-50/95 px-4 py-2.5 text-xs font-bold text-slate-500 backdrop-blur"
                  style={{
                    gridTemplateColumns: `36px ${columnOrder
                      .filter((column) => visibleColumns[column])
                      .map((column) => leadColumnWidths[column])
                      .join(" ")} 112px`,
                  }}
                >
                  <label className="flex h-5 w-5 items-center justify-center">
                    <input
                      className="sr-only"
                      type="checkbox"
                      checked={pageRows.length > 0 && pageRows.every((lead) => selectedLeadIds.includes(lead.id))}
                      onChange={toggleAllPageRows}
                      aria-label={t("leads.selectAll")}
                    />
                    <span
                      className={cn(
                        "grid h-5 w-5 place-items-center rounded border",
                        pageRows.length > 0 && pageRows.every((lead) => selectedLeadIds.includes(lead.id))
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-slate-300 bg-white"
                      )}
                    >
                      {pageRows.length > 0 && pageRows.every((lead) => selectedLeadIds.includes(lead.id)) ? (
                        <CheckCheck size={12} />
                      ) : null}
                    </span>
                  </label>
                  {columnOrder
                    .filter((column) => visibleColumns[column])
                    .map((column) => (
                      <span key={column}>{t(`leads.column.${column}`)}</span>
                    ))}
                  <span />
                </div>
              </div>
            ) : null}
            
            <div className="min-h-0 flex-1 overflow-hidden">
              {!rows.length ? (
                // Empty state with explanation
                <div className="grid h-full min-h-[280px] place-items-center p-4">
                  <div className="max-w-sm text-center">
                    <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                      <Plus size={20} />
                    </div>
                    <h3 className="mt-3 text-base font-black text-midnight">{t("leads.emptyTitle")}</h3>
                    <p className="mt-1.5 text-xs font-semibold leading-5 text-slate-500">
                      {t("leads.emptyText")}
                    </p>
                    {allLeads.length === 0 ? (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                        <p className="font-bold">{t("leads.noDataTitle")}</p>
                        <p className="mt-1">{t("leads.noDataText")}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold">WhatsApp</span>
                          <span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold">Telegram</span>
                          <span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold">Instagram</span>
                          <span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold">Сайт</span>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
                      <Button onClick={() => setCreateOpen(true)} className="text-sm">
                        <Plus size={15} /> {t("leads.createFirstLead")}
                      </Button>
                      <Button
                        variant="secondary"
                        className="text-sm"
                        onClick={() => {
                          window.location.href = "/dashboard/integrations";
                        }}
                      >
                        {t("leads.connectSources")}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : viewMode === "table" ? (
                <VirtualizedLeadTableRows
                  rows={pageRows}
                  clients={clientList}
                  services={serviceList}
                  team={teamList}
                  aiInsights={aiInsights}
                  selectedId={selected?.id || null}
                  selectedLeadIds={selectedLeadIds}
                  visibleColumns={visibleColumns}
                  columnOrder={columnOrder}
                  onSelect={openLead}
                  onToggle={(lead) =>
                    setSelectedLeadIds((ids) =>
                      ids.includes(lead.id)
                        ? ids.filter((id) => id !== lead.id)
                        : [...ids, lead.id]
                    )
                  }
                  onContextMenu={(event, lead) => {
                    event.preventDefault();
                    setContextMenu({ x: event.clientX, y: event.clientY, lead });
                  }}
                  t={t}
                />
              ) : (
                <div className="h-full overflow-y-auto p-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {pageRows.map((lead) => (
                      <LeadQueueItem
                        key={lead.id}
                        lead={lead}
                        client={getClient(lead, clientList)}
                        service={getService(lead, serviceList)}
                        aiInsight={aiInsights.get(lead.id)}
                        isSelected={selected?.id === lead.id}
                        onClick={() => openLead(lead)}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detail panel - Desktop */}
        {selected && viewMode !== "kanban" && (
          <LeadDetailPanel
            lead={selected}
            client={selectedClient}
            service={selectedService}
            tasks={selectedTasks}
            nextTask={selectedNextTask}
            deals={selectedDeals}
            appointments={selectedAppointments}
            conversations={selectedConversations}
            aiInsight={selectedAiInsight}
            team={teamList}
            collapsed={detailCollapsed}
            onCollapse={() => setDetailCollapsed(!detailCollapsed)}
            onClose={() => {
              setSelectedId(null);
              setSearchParams((params) => {
                params.delete("lead");
                return params;
              });
            }}
            onEdit={() => setCreateOpen(true)}
            onCreateTask={() => setNextActionOpen(true)}
            onCreateAppointment={() => setAppointmentOpen(true)}
            onOpenEntity={(entity) => setDrawerEntity(entity)}
            t={t}
          />
        )}
      </section>

      {/* Modals & Drawers */}
      {createOpen && (
        <LeadForm
          isOpen
          onClose={() => {
            setCreateOpen(false);
            setSearchParams((params) => {
              params.delete("create");
              return params;
            });
          }}
          onSubmit={(lead) => {
            queryClient.invalidateQueries({ queryKey: ["leads", business?.id] });
            setCreateOpen(false);
            openLead(lead);
          }}
        />
      )}

      {mobileDetailOpen && selected && (
        <LeadDetailPanel
          lead={selected}
          client={selectedClient}
          service={selectedService}
          tasks={selectedTasks}
          nextTask={selectedNextTask}
          deals={selectedDeals}
          appointments={selectedAppointments}
          conversations={selectedConversations}
          aiInsight={selectedAiInsight}
          team={teamList}
          collapsed={false}
          onCollapse={() => {}}
          onClose={() => {
            setMobileDetailOpen(false);
            setSelectedId(null);
            setSearchParams((params) => {
              params.delete("lead");
              return params;
            });
          }}
          onEdit={() => setCreateOpen(true)}
          onCreateTask={() => setNextActionOpen(true)}
          onCreateAppointment={() => setAppointmentOpen(true)}
          onOpenEntity={(entity) => setDrawerEntity(entity)}
          t={t}
        />
      )}

      {appointmentOpen && (
        <Modal isOpen onClose={() => setAppointmentOpen(false)} title={t("appointments.create")}>
          <AppointmentForm
            business={business!}
            lead={selected}
            client={selectedClient}
            onClose={() => setAppointmentOpen(false)}
            onSubmit={() => {
              queryClient.invalidateQueries({ queryKey: ["appointments", business?.id] });
              setAppointmentOpen(false);
            }}
          />
        </Modal>
      )}

      {drawerEntity && (
        <CrmEntityDrawer
          entity={drawerEntity}
          isOpen
          onClose={() => setDrawerEntity(null)}
        />
      )}

      {lostLead && (
        <Modal isOpen onClose={() => setLostLead(null)} title={t("leads.markLost")}>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-600">
              {t("leads.lostReasonPrompt")}
            </p>
            <textarea
              className="h-24 w-full rounded-lg border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-brand-300"
              placeholder={t("leads.lostReasonPlaceholder")}
              value={lostReason}
              onChange={(event) => setLostReason(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setLostLead(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => {
                  // Implement mark as lost logic
                  setLostLead(null);
                  setLostReason("");
                }}
                disabled={!lostReason.trim()}
              >
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {nextActionOpen && (
        <Modal isOpen onClose={() => setNextActionOpen(false)} title={t("tasks.create")}>
          <div className="space-y-3">
            <Input
              label={t("tasks.title")}
              value={nextActionDraft.title}
              onChange={(value) => setNextActionDraft((draft) => ({ ...draft, title: value }))}
            />
            <Input
              type="datetime-local"
              label={t("tasks.dueAt")}
              value={nextActionDraft.due_at}
              onChange={(value) => setNextActionDraft((draft) => ({ ...draft, due_at: value }))}
            />
            <Select
              label={t("tasks.priority")}
              value={nextActionDraft.priority}
              onChange={(value) => setNextActionDraft((draft) => ({ ...draft, priority: value as Task["priority"] }))}
              options={[
                { value: "low", label: t("tasks.priorityLow") },
                { value: "normal", label: t("tasks.priorityNormal") },
                { value: "high", label: t("tasks.priorityHigh") },
                { value: "urgent", label: t("tasks.priorityUrgent") },
              ]}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setNextActionOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => {
                  // Implement create task logic
                  setNextActionOpen(false);
                }}
              >
                {t("common.create")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {shortcutsOpen && (
        <Modal isOpen onClose={() => setShortcutsOpen(false)} title={t("leads.shortcuts")}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold text-slate-600">{t("leads.searchFocus")}</span>
              <kbd className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-bold">/</kbd>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-600">{t("leads.quickSearch")}</span>
              <kbd className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-bold">⌘K</kbd>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-600">{t("leads.newLead")}</span>
              <kbd className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-bold">⌘↵</kbd>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-600">{t("leads.closePanel")}</span>
              <kbd className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-bold">Esc</kbd>
            </div>
          </div>
        </Modal>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
            onClick={() => {
              openLead(contextMenu.lead);
              setContextMenu(null);
            }}
          >
            <Phone size={15} /> {t("leads.call")}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
            onClick={() => {
              // Open WhatsApp
              setContextMenu(null);
            }}
          >
            <MessageCircle size={15} /> WhatsApp
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setNextActionOpen(true);
              setContextMenu(null);
            }}
          >
            <CalendarPlus size={15} /> {t("leads.createTask")}
          </button>
          <hr className="my-2 border-slate-100" />
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50"
            onClick={() => {
              setLostLead(contextMenu.lead);
              setContextMenu(null);
            }}
          >
            <Archive size={15} /> {t("leads.markLost")}
          </button>
        </div>
      )}
    </div>
  );
}
