import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  BellDot,
  CalendarCheck,
  CheckSquare,
  ExternalLink,
  Link2,
  PanelRightClose,
  PanelRightOpen,
  PauseCircle,
  PlayCircle,
  Sparkles,
  Tags,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { getApiErrorMessage } from "../../api/client";
import { botsApi } from "../../api/bots";
import { clientsApi } from "../../api/clients";
import { dealsApi } from "../../api/deals";
import { leadsApi } from "../../api/leads";
import { quickRepliesApi } from "../../api/quickReplies";
import {
  INBOX_MESSAGES_PAGE_SIZE,
  inboxApi,
  inboxQueryKeys,
  type InboxConversation,
  type InboxFilters,
  type InboxMessage,
  type PaginatedInboxMessageResponse,
} from "../../api/inbox";
import { useActionFeedback } from "../../components/actions/useActionFeedback";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { WorkQueueLayout } from "../../components/layout/WorkQueueLayout";
import { useNotification } from "../../components/notifications/NotificationProvider";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Overlay";
import { Select } from "../../components/ui/Select";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/ui/StateViews";
import { Textarea } from "../../components/ui/Textarea";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { hasPermission } from "../../lib/permissions";
import { realtimeIntervals, realtimeQueryOptions } from "../../lib/realtime";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useAuth } from "../auth/AuthProvider";
import { ConversationListPane } from "./components/ConversationListPane";
import { Pill } from "./components/ConversationPrimitives";
import { ConversationThreadPane } from "./components/ConversationThreadPane";
import {
  channelOptions,
  CONVERSATIONS_SHELL_OFFSET,
  priorityOptions,
} from "./conversationConstants";
import {
  channelLabel,
  conversationTitle,
  getAutoPipelineInsight,
  getConversationTimestamp,
} from "./conversationUtils";
import { useConversationFilters } from "./hooks/useConversationFilters";

function asNumericId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function searchWithoutLegacyConversation(searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);
  params.delete("conversation");
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function ConversationsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const showNotification = useNotification();
  const { notifyError } = useActionFeedback();
  const { setPageHeader } = usePageHeader();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeSelectedId = asNumericId(routeId);
  const legacySelectedId = routeSelectedId
    ? null
    : Number(searchParams.get("conversation")) || null;
  const [selectedId, setSelectedId] = useState<number | null>(
    () => routeSelectedId || legacySelectedId || null,
  );
  const { activePreset, applyFilters, filters, normalizedFilters, sortBy } =
    useConversationFilters({
      searchParams,
      setSearchParams,
    });
  const [bulkMode, setBulkMode] = useState(false);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(() =>
    Boolean(routeSelectedId || legacySelectedId),
  );
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [draft, setDraft] = useState("");
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [quickReplySearch, setQuickReplySearch] = useState("");
  const [crmLinkModal, setCrmLinkModal] = useState<
    "client" | "lead" | "deal" | null
  >(null);
  const [crmLinkSearch, setCrmLinkSearch] = useState("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState({
    title: "",
    description: "",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    due_at: "",
  });
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();
  const { business } = useActiveBusiness();
  const businessId = business?.id;
  const canSuggestAi = hasPermission(
    user,
    business?.id,
    "ai_assistant",
    "suggest",
  );
  const canSuggestAiPipeline = hasPermission(
    user,
    business?.id,
    "ai_pipeline",
    "suggest",
  );
  const canRunAiPipeline = hasPermission(
    user,
    business?.id,
    "ai_pipeline",
    "execute",
  );
  const canViewIntegrations = hasPermission(
    user,
    business?.id,
    "integrations",
    "view",
  );

  useEffect(() => {
    if (!routeSelectedId || routeSelectedId === selectedId) return;
    setSelectedId(routeSelectedId);
    setMobileThreadOpen(true);
  }, [routeSelectedId, selectedId]);

  function resizeComposer() {
    const composer = composerRef.current;
    if (!composer) return;
    const maxHeight = window.matchMedia("(max-width: 640px)").matches
      ? 120
      : 160;
    composer.style.height = "auto";
    composer.style.height = `${Math.min(composer.scrollHeight, maxHeight)}px`;
    composer.style.overflowY =
      composer.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  function setNotice(
    message: string | null,
    tone: "success" | "info" | "warning" | "danger" = "info",
  ) {
    if (!message) return;
    showNotification({ message, tone });
  }

  const summary = useQuery({
    queryKey: ["inbox-summary", businessId],
    queryFn: inboxApi.getSummary,
    refetchInterval: realtimeIntervals.inboxConversationsMs,
    ...realtimeQueryOptions,
  });

  const conversations = useQuery({
    queryKey: inboxQueryKeys.conversations(normalizedFilters),
    queryFn: () => inboxApi.listConversations(normalizedFilters),
    refetchInterval: realtimeIntervals.inboxConversationsMs,
    ...realtimeQueryOptions,
  });

  const bots = useQuery({
    queryKey: ["bots"],
    queryFn: botsApi.list,
  });

  const items = conversations.data?.results || [];

  const sortedItems = useMemo(() => {
    const source = [...items];
    if (sortBy === "unread") {
      source.sort((left, right) => {
        const unreadDiff = (right.unread_count || 0) - (left.unread_count || 0);
        if (unreadDiff !== 0) return unreadDiff;
        const leftDate = getConversationTimestamp(left.last_message_at);
        const rightDate = getConversationTimestamp(right.last_message_at);
        return rightDate - leftDate;
      });
      return source;
    }

    if (sortBy === "first_response") {
      source.sort((left, right) => {
        const leftDate = getConversationTimestamp(left.last_inbound_at);
        const rightDate = getConversationTimestamp(right.last_inbound_at);
        return leftDate - rightDate;
      });
      return source;
    }

    source.sort(
      (left, right) =>
        getConversationTimestamp(right.last_message_at) -
        getConversationTimestamp(left.last_message_at),
    );
    return source;
  }, [items, sortBy]);

  const selectedFromList = useMemo(
    () => sortedItems.find((item) => item.id === selectedId) || null,
    [sortedItems, selectedId],
  );

  const selectedConversation = useQuery({
    queryKey: ["inbox-conversation", selectedId],
    queryFn: () => inboxApi.getConversation(selectedId!),
    enabled: Boolean(selectedId && !selectedFromList),
    refetchInterval:
      selectedId && !selectedFromList
        ? realtimeIntervals.inboxConversationsMs
        : false,
    ...realtimeQueryOptions,
  });

  const selected = selectedFromList || selectedConversation.data || null;

  const quickReplies = useQuery({
    queryKey: ["quick-replies", businessId, selected?.channel],
    queryFn: () =>
      quickRepliesApi.list({
        channel: selected?.channel || "all",
        is_active: true,
      }),
    enabled: Boolean(businessId && selected?.channel),
  });

  const clientLinkCandidates = useQuery({
    queryKey: ["inbox-link-clients", businessId, crmLinkSearch],
    queryFn: async () => {
      const result = await clientsApi.listFiltered({
        q: crmLinkSearch,
        page_size: 8,
      });
      return result.clients;
    },
    enabled: Boolean(businessId && crmLinkModal === "client"),
  });

  const leadLinkCandidates = useQuery({
    queryKey: ["inbox-link-leads", businessId, crmLinkSearch],
    queryFn: async () => {
      const result = await leadsApi.listPaginated({
        search: crmLinkSearch,
        page_size: 8,
      });
      return result.results;
    },
    enabled: Boolean(businessId && crmLinkModal === "lead"),
  });

  const dealLinkCandidates = useQuery({
    queryKey: ["inbox-link-deals", businessId, crmLinkSearch],
    queryFn: async () => {
      const result = await dealsApi.listPaginated({
        search: crmLinkSearch,
        page_size: 8,
      });
      return result.results;
    },
    enabled: Boolean(businessId && crmLinkModal === "deal"),
  });

  useEffect(() => {
    setPageHeader({
      title: t("nav.conversations"),
      primaryAction: selected
        ? {
            label: t("conversations.context"),
            icon: inspectorOpen ? PanelRightClose : PanelRightOpen,
            onClick: () => setInspectorOpen((state) => !state),
          }
        : undefined,
    });
    return () => setPageHeader(null);
  }, [inspectorOpen, selected, setPageHeader, t]);

  useEffect(() => {
    if (selectedId || conversations.isLoading || !items.length) return;
    const slaOverdue = sortedItems.find(
      (item) => item.sla_overdue || (item.sla_overdue_minutes || 0) > 0,
    );
    const handoff = sortedItems.find((item) => item.handoff_required);
    const unread = sortedItems.find((item) => (item.unread_count || 0) > 0);
    const priority =
      slaOverdue ||
      handoff ||
      unread ||
      sortedItems[0];
    if (!priority) return;
    setSelectedId(priority.id);
    const params = new URLSearchParams(searchParams);
    params.delete("conversation");
    const query = params.toString();
    navigate(`/app/conversations/${priority.id}${query ? `?${query}` : ""}`, {
      replace: true,
    });
  }, [
    conversations.isLoading,
    navigate,
    sortedItems,
    searchParams,
    selectedId,
  ]);

  const messages = useInfiniteQuery<
    PaginatedInboxMessageResponse,
    Error,
    InfiniteData<PaginatedInboxMessageResponse>,
    ReturnType<typeof inboxQueryKeys.messages>,
    number | null
  >({
    queryKey: inboxQueryKeys.messages(selected?.id),
    queryFn: ({ pageParam }) =>
      inboxApi.listMessages(selected!.id, {
        limit: INBOX_MESSAGES_PAGE_SIZE,
        beforeId: pageParam ?? undefined,
      }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.next_before_id || undefined,
    enabled: Boolean(selected?.id),
    refetchInterval: selected?.id ? realtimeIntervals.inboxMessagesMs : false,
    ...realtimeQueryOptions,
  });

  const conversationCounts = useMemo(() => {
    const myTurn = items.filter((item) => item.assigned_to !== null).length;
    return {
      all: conversations.data?.count ?? summary.data?.total ?? items.length,
      unread: items.filter((item) => (item.unread_count || 0) > 0).length,
      attention: items.filter((item) => item.handoff_required).length,
      botDisabled: items.filter((item) => !item.bot_enabled).length,
      myTurn,
      unassigned: items.filter((item) => !item.assigned_to).length,
      closed: items.filter((item) => item.status === "closed").length,
      active: items.filter((item) => item.status !== "closed").length,
    };
  }, [items, conversations.data?.count, summary.data?.total]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.bot ||
        filters.channel ||
        filters.priority ||
        filters.assigned_to ||
        filters.status ||
        filters.unread ||
        filters.handoff_required ||
        filters.bot_enabled,
      ),
    [filters],
  );

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (filters.bot) parts.push(t("conversations.agent"));
    if (filters.channel) parts.push(channelLabel(filters.channel, t));
    if (filters.priority)
      parts.push(`${t("conversations.priority")}: ${filters.priority}`);
    if (filters.unread === "true")
      parts.push(t("conversations.unreadMessages"));
    if (filters.handoff_required === "true")
      parts.push(t("conversations.needsOperator"));
    if (filters.bot_enabled === "false")
      parts.push(t("conversations.botPaused"));
    if (filters.bot_enabled === "true")
      parts.push(t("conversations.botActive"));
    if (filters.assigned_to === "me")
      parts.push(t("conversations.assignedToMeFilter"));
    if (filters.assigned_to === "unassigned")
      parts.push(t("conversations.unassigned"));
    if (filters.status === "open") parts.push(t("conversations.active"));
    if (filters.status === "closed") parts.push(t("status.closed"));
    return parts;
  }, [filters, t]);

  const queueFilterOptions = useMemo(
    () => [
      {
        value: "all",
        label: `${t("conversations.queueAll")} (${conversationCounts.all})`,
      },
      {
        value: "new",
        label: `${t("conversations.unreadMessages")} (${summary.data?.unread ?? conversationCounts.unread})`,
      },
      {
        value: "attention",
        label: `${t("conversations.attention")} (${summary.data?.handoff_required ?? conversationCounts.attention})`,
      },
      {
        value: "paused",
        label: `${t("conversations.botPaused")} (${summary.data?.bot_paused ?? conversationCounts.botDisabled})`,
      },
      {
        value: "closed",
        label: `${t("status.closed")} (${conversationCounts.closed})`,
      },
    ],
    [
      conversationCounts.all,
      conversationCounts.attention,
      conversationCounts.botDisabled,
      conversationCounts.closed,
      conversationCounts.unread,
      summary.data?.bot_paused,
      summary.data?.handoff_required,
      summary.data?.unread,
      t,
    ],
  );

  const ownerFilterOptions = useMemo(
    () => [
      {
        value: "all",
        label: `${t("conversations.allManagers")} (${conversationCounts.all})`,
      },
      {
        value: "me",
        label: `${t("conversations.assignedToMeFilter")} (${summary.data?.assigned_to_me ?? 0})`,
      },
      {
        value: "unassigned",
        label: `${t("conversations.unassigned")} (${summary.data?.unassigned ?? conversationCounts.unassigned})`,
      },
    ],
    [
      conversationCounts.all,
      conversationCounts.unassigned,
      summary.data?.assigned_to_me,
      summary.data?.unassigned,
      t,
    ],
  );

  const agentFilterOptions = useMemo(
    () => [
      { value: "", label: t("conversations.allAgents") },
      ...(bots.data || []).map((bot) => ({ value: bot.id, label: bot.name })),
    ],
    [bots.data, t],
  );

  const localizedChannelOptions = useMemo(
    () =>
      channelOptions.map((option) => ({
        value: option.value,
        label: "labelKey" in option ? t(option.labelKey) : option.label,
      })),
    [t],
  );

  const localizedPriorityOptions = useMemo(
    () =>
      priorityOptions.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t],
  );

  const priorityActionOptions = useMemo(
    () => localizedPriorityOptions.filter((option) => option.value),
    [localizedPriorityOptions],
  );

  const quickReplyTemplates = useMemo(() => {
    const source = quickReplies.data || [];
    const search = quickReplySearch.trim().toLowerCase();
    if (!search) return source;
    return source.filter((template) =>
      `${template.title} ${template.text} ${template.category}`
        .toLowerCase()
        .includes(search),
    );
  }, [quickReplies.data, quickReplySearch]);

  const localizedSortOptions = useMemo(
    () => [
      { value: "latest", label: t("conversations.sortLatest") },
      { value: "unread", label: t("conversations.sortUnread") },
      { value: "first_response", label: t("conversations.sortFirstResponse") },
    ],
    [t],
  );

  const localizedStatusOptions = useMemo(
    () => [
      {
        value: "all",
        label: `${t("conversations.noFilter")} (${conversationCounts.all})`,
      },
      {
        value: "open",
        label: `${t("conversations.active")} (${conversationCounts.active})`,
      },
      {
        value: "closed",
        label: `${t("status.closed")} (${conversationCounts.closed})`,
      },
    ],
    [
      conversationCounts.active,
      conversationCounts.all,
      conversationCounts.closed,
      t,
    ],
  );

  function handleSortChange(sort: string) {
    const nextSort =
      sort === "latest"
        ? "latest"
        : sort === "unread"
          ? "unread"
          : "first_response";
    applyFilters(filters, activePreset, nextSort);
  }

  function handleQueueChange(value: string) {
    const next: InboxFilters = {
      ...filters,
      unread: undefined,
      handoff_required: undefined,
      bot_enabled: undefined,
      status: "",
    };
    if (value === "new") next.unread = "true";
    if (value === "attention") next.handoff_required = "true";
    if (value === "paused") next.bot_enabled = "false";
    if (value === "closed") next.status = "closed";
    applyFilters(
      next,
      value === "all" &&
        !next.assigned_to &&
        !next.bot &&
        !next.channel &&
        !next.priority
        ? "all"
        : "custom",
    );
    setSelectedIds([]);
    setBulkMode(false);
  }

  function handleOwnerChange(value: string) {
    const next: InboxFilters = {
      ...filters,
      assigned_to: value === "all" ? undefined : value,
    };
    applyFilters(
      next,
      value === "all" &&
        !next.unread &&
        !next.handoff_required &&
        !next.bot_enabled &&
        !next.status &&
        !next.bot &&
        !next.channel &&
        !next.priority
        ? "all"
        : "custom",
    );
    setSelectedIds([]);
    setBulkMode(false);
  }

  function updateFilters(next: InboxFilters) {
    applyFilters(next, "custom");
    setSelectedIds([]);
    setBulkMode(false);
  }

  function resetConversationFilters() {
    const next: InboxFilters = { search: filters.search };
    applyFilters(next, "all", "latest");
    setSelectedIds([]);
    setBulkMode(false);
  }

  function selectConversation(id: number) {
    setSelectedId(id);
    setMobileThreadOpen(true);
    const params = new URLSearchParams(searchParams);
    params.delete("conversation");
    const query = params.toString();
    navigate(`/app/conversations/${id}${query ? `?${query}` : ""}`);
    const conversation = items.find((item) => item.id === id);
    if ((conversation?.unread_count || 0) > 0) {
      markReadMutation.mutate(id);
    }
  }

  const invalidateInbox = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["inbox-summary"] }),
      queryClient.invalidateQueries({
        queryKey: ["inbox-summary"],
        exact: false,
      }),
      queryClient.invalidateQueries({ queryKey: ["inbox-conversations"] }),
      queryClient.invalidateQueries({
        queryKey: ["inbox-conversation", selected?.id],
      }),
      queryClient.invalidateQueries({
        queryKey: inboxQueryKeys.messages(selected?.id),
      }),
      queryClient.invalidateQueries({
        queryKey: ["inbox-summary", businessId],
      }),
      queryClient.invalidateQueries({ queryKey: ["notifications-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ]);
  };

  function toggleBulkId(id: number) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function selectVisibleConversations() {
    setBulkMode(true);
    setSelectedIds(sortedItems.map((item) => item.id));
  }

  function resetBulkSelection() {
    setBulkMode(false);
    setSelectedIds([]);
  }

  function appendSystemEvent(conversationId: number, text: string) {
    const now = new Date().toISOString();
    const eventMessage: InboxMessage = {
      id: -Date.now(),
      conversation: conversationId,
      direction: "outbound",
      sender_type: "system",
      text,
      payload_json: { source: "local_status_event" },
      status: "sent",
      sent_at: now,
      delivered_at: null,
      read_at: null,
      created_at: now,
      attachments: [],
    };

    queryClient.setQueryData<InfiniteData<PaginatedInboxMessageResponse>>(
      inboxQueryKeys.messages(conversationId),
      (current) => {
        if (!current || !current.pages.length) {
          return current;
        }

        const eventTime = new Date(now).getTime();
        const hasRecentDuplicate = current.pages.some((page) =>
          page.results.some((message) => {
            if (message.sender_type !== "system" || message.text !== text)
              return false;
            const messageTime = new Date(
              message.created_at || message.sent_at || 0,
            ).getTime();
            return (
              Number.isFinite(messageTime) &&
              Math.abs(eventTime - messageTime) < 10_000
            );
          }),
        );

        if (hasRecentDuplicate) {
          return current;
        }

        const nextPages = [...current.pages];
        const latestPage = nextPages[0];
        nextPages[0] = {
          ...latestPage,
          results: [...latestPage.results, eventMessage],
        };

        return {
          ...current,
          pages: nextPages,
        };
      },
    );
  }

  const assignMutation = useMutation({
    mutationFn: inboxApi.assignToMe,
    onSuccess: async (_data, conversationId) => {
      setNotice(null);
      await invalidateInbox();
      appendSystemEvent(
        Number(conversationId),
        t("conversations.systemAssignedToMe"),
      );
    },
    onError: (error) => notifyError(error),
  });

  const handoffMutation = useMutation({
    mutationFn: inboxApi.handoff,
    onSuccess: async (_data, variables) => {
      setNotice(null);
      await invalidateInbox();
      appendSystemEvent(
        Number(variables.conversationId),
        t("conversations.systemHandoff"),
      );
    },
    onError: (error) => notifyError(error),
  });

  const markReadMutation = useMutation({
    mutationFn: inboxApi.markRead,
    onSuccess: async () => {
      await invalidateInbox();
    },
    onError: (error) => notifyError(error),
  });

  const markUnreadMutation = useMutation({
    mutationFn: inboxApi.markUnread,
    onSuccess: async () => {
      setNotice(t("conversations.markedUnread"));
      await invalidateInbox();
    },
    onError: (error) => notifyError(error),
  });

  const setPriorityMutation = useMutation({
    mutationFn: inboxApi.setPriority,
    onSuccess: async () => {
      setNotice(t("conversations.priorityUpdated"));
      await invalidateInbox();
    },
    onError: (error) => notifyError(error),
  });

  const toggleBotMutation = useMutation({
    mutationFn: inboxApi.toggleBot,
    onSuccess: async (_data, variables) => {
      setNotice(null);
      await invalidateInbox();
      appendSystemEvent(
        Number(variables.conversationId),
        variables.botEnabled
          ? t("conversations.systemBotEnabled")
          : t("conversations.systemBotPaused"),
      );
    },
    onError: (error) => notifyError(error),
  });

  const closeMutation = useMutation({
    mutationFn: inboxApi.closeConversation,
    onSuccess: async (_data, variables) => {
      setNotice(null);
      await invalidateInbox();
      appendSystemEvent(
        Number(variables.conversationId),
        t("conversations.systemClosed"),
      );
    },
    onError: (error) => notifyError(error),
  });

  const reopenMutation = useMutation({
    mutationFn: inboxApi.reopenConversation,
    onSuccess: async (_data, conversationId) => {
      setNotice(null);
      await invalidateInbox();
      appendSystemEvent(
        Number(conversationId),
        t("conversations.systemReopened"),
      );
    },
    onError: (error) => notifyError(error),
  });

  const suggestMutation = useMutation({
    mutationFn: (conversationId: number) => {
      if (!canSuggestAi) throw new Error(t("conversations.aiReplyForbidden"));
      return inboxApi.suggestReply(conversationId);
    },
    onSuccess: (data) => {
      setDraft(data.suggested_reply);
      setNotice(t("conversations.aiDraftReady"));
    },
    onError: (error) =>
      notifyError(error, {
        fallbackMessage: t("conversations.aiReplyForbidden"),
      }),
  });

  const qualifyMutation = useMutation({
    mutationFn: (conversationId: number) => {
      if (!canSuggestAiPipeline)
        throw new Error(t("conversations.aiPipelinePreviewForbidden"));
      return inboxApi.qualifyConversation(conversationId);
    },
    onSuccess: async (result) => {
      setNotice(
        t("conversations.qualificationPreviewReady", {
          intent: result.qualification.intent,
          confidence: Math.round(result.qualification.confidence * 100),
        }),
      );
      await invalidateInbox();
    },
    onError: (error) =>
      notifyError(error, {
        fallbackMessage: t("conversations.aiPipelinePreviewForbidden"),
      }),
  });

  const sendMutation = useMutation({
    mutationFn: inboxApi.sendMessage,
    onSuccess: async () => {
      setDraft("");
      setNotice(t("conversations.replySent"), "success");
      await invalidateInbox();
    },
    onError: (error) =>
      notifyError(error, { focusTarget: composerRef }),
  });

  const retryMessageMutation = useMutation({
    mutationFn: inboxApi.retryMessage,
    onSuccess: async () => {
      setNotice(t("conversations.messageRetried"));
      await invalidateInbox();
    },
    onError: (error) => notifyError(error),
  });

  const createClientMutation = useMutation({
    mutationFn: inboxApi.createClient,
    onSuccess: async (result) => {
      if (result.requires_confirmation && result.duplicates.length) {
        setNotice(
          t("conversations.duplicateClientShort", {
            list: result.duplicates
              .map((item) => `#${item.id} ${item.full_name}`)
              .join(", "),
          }),
        );
        return;
      }
      setNotice(
        result.created
          ? t("conversations.clientCreatedShort")
          : t("conversations.clientAlreadyLinked"),
      );
      await Promise.all([
        invalidateInbox(),
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
      ]);
    },
    onError: (error) => notifyError(error),
  });

  const linkClientMutation = useMutation({
    mutationFn: inboxApi.linkClient,
    onSuccess: async () => {
      setNotice(t("conversations.clientLinkedShort"));
      setCrmLinkModal(null);
      await invalidateInbox();
    },
    onError: (error) => notifyError(error),
  });

  const createLeadMutation = useMutation({
    mutationFn: inboxApi.createLead,
    onSuccess: async () => {
      setNotice(t("conversations.leadCreatedShort"));
      await Promise.all([
        invalidateInbox(),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
      ]);
    },
    onError: (error) => notifyError(error),
  });

  const linkLeadMutation = useMutation({
    mutationFn: inboxApi.linkLead,
    onSuccess: async () => {
      setNotice(t("conversations.leadLinkedShort"));
      setCrmLinkModal(null);
      await invalidateInbox();
    },
    onError: (error) => notifyError(error),
  });

  const createDealMutation = useMutation({
    mutationFn: inboxApi.createDeal,
    onSuccess: async () => {
      setNotice(t("conversations.dealCreatedShort"));
      await Promise.all([
        invalidateInbox(),
        queryClient.invalidateQueries({ queryKey: ["deals"] }),
      ]);
    },
    onError: (error) => notifyError(error),
  });

  const linkDealMutation = useMutation({
    mutationFn: inboxApi.linkDeal,
    onSuccess: async () => {
      setNotice(t("conversations.dealLinkedShort"));
      setCrmLinkModal(null);
      await invalidateInbox();
    },
    onError: (error) => notifyError(error),
  });

  const createTaskMutation = useMutation({
    mutationFn: inboxApi.createTask,
    onSuccess: async () => {
      setNotice(t("conversations.taskCreatedShort"), "success");
      setTaskModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => notifyError(error),
  });

  const runPipelineMutation = useMutation({
    mutationFn: (payload: { conversationId: number; dealTitle?: string }) => {
      if (!canRunAiPipeline)
        throw new Error(t("conversations.aiPipelineRunForbidden"));
      return inboxApi.runPipeline(payload);
    },
    onSuccess: async (result) => {
      const created = Object.entries(result.created)
        .filter(([, value]) => value)
        .map(([key]) => key)
        .join(", ");
      const aiSuffix = result.qualification
        ? t("conversations.pipelineAiSuffix", {
            intent: result.qualification.intent,
            confidence: Math.round(result.qualification.confidence * 100),
          })
        : "";
      setNotice(
        created
          ? t("conversations.pipelineUpdated", { created, ai: aiSuffix })
          : t("conversations.pipelineAlreadyLinked", { ai: aiSuffix }),
      );
      await Promise.all([
        invalidateInbox(),
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["deals"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
    },
    onError: (error) =>
      notifyError(error, {
        fallbackMessage: t("conversations.aiPipelineRunForbidden"),
      }),
  });

  const bulkMutation = useMutation({
    mutationFn: async (
      action: "markRead" | "assign" | "handoff" | "pauseBot" | "close",
    ) => {
      const ids = [...selectedIds];
      if (action === "markRead") {
        await Promise.all(ids.map((id) => inboxApi.markRead(id)));
      }
      if (action === "assign") {
        await Promise.all(ids.map((id) => inboxApi.assignToMe(id)));
      }
      if (action === "handoff") {
        await Promise.all(
          ids.map((id) =>
            inboxApi.handoff({
              conversationId: id,
              reason: "bulk_handoff_from_inbox",
            }),
          ),
        );
      }
      if (action === "pauseBot") {
        await Promise.all(
          ids.map((id) =>
            inboxApi.toggleBot({ conversationId: id, botEnabled: false }),
          ),
        );
      }
      if (action === "close") {
        await Promise.all(
          ids.map((id) =>
            inboxApi.closeConversation({
              conversationId: id,
              reason: "bulk_closed_from_inbox",
            }),
          ),
        );
      }
      return { action, count: ids.length };
    },
    onSuccess: async ({ count }) => {
      setNotice(t("conversations.bulkDone", { count }));
      resetBulkSelection();
      await invalidateInbox();
    },
    onError: (error) => notifyError(error),
  });

  const pageError =
    summary.error ||
    conversations.error ||
    selectedConversation.error ||
    messages.error;
  const unavailableChannelCount = (summary.data?.channels || []).filter(
    (channel) => !channel.is_connected && channel.total > 0,
  ).length;
  function sendReply() {
    const text = draft.trim();
    if (!selected || !text) return;
    sendMutation.mutate({ conversationId: selected.id, text });
  }

  function insertQuickReply(text: string) {
    setDraft((current) =>
      current.trim() ? `${current.trimEnd()}\n${text}` : text,
    );
    setQuickRepliesOpen(false);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }

  function openEntity(path: string, id?: number | string | null) {
    if (!id) return;
    navigate(`${path}/${id}`);
  }

  function createLinkedLead() {
    if (!selected) return;
    createLeadMutation.mutate({
      conversationId: selected.id,
      message: lastMessage?.text || undefined,
    });
  }

  function createLinkedDeal() {
    if (!selected) return;
    createDealMutation.mutate({
      conversationId: selected.id,
      title: t("conversations.pipelineDealTitle", {
        title: conversationTitle(selected, t),
      }),
    });
  }

  function createLinkedTask() {
    if (!selected) return;
    setTaskDraft({
      title: t("conversations.followUpTaskTitle", {
        title: conversationTitle(selected, t),
      }),
      description: lastMessage?.text || "",
      priority:
        selected.priority === "urgent" ||
        selected.priority === "high" ||
        selected.priority === "low"
          ? selected.priority
          : "normal",
      due_at: "",
    });
    setTaskModalOpen(true);
  }

  function submitTaskFromInspector() {
    if (!selected) return;
    createTaskMutation.mutate({
      conversationId: selected.id,
      title: taskDraft.title,
      description: taskDraft.description,
      priority: taskDraft.priority,
      due_at: taskDraft.due_at
        ? new Date(taskDraft.due_at).toISOString()
        : null,
    });
  }

  function openCrmLinkModal(target: "client" | "lead" | "deal") {
    setCrmLinkSearch("");
    setCrmLinkModal(target);
  }

  function linkClientToConversation(clientId: number) {
    if (!selected) return;
    linkClientMutation.mutate({ conversationId: selected.id, clientId });
  }

  function linkLeadToConversation(leadId: number) {
    if (!selected) return;
    linkLeadMutation.mutate({ conversationId: selected.id, leadId });
  }

  function linkDealToConversation(dealId: number) {
    if (!selected) return;
    linkDealMutation.mutate({ conversationId: selected.id, dealId });
  }

  function previewSelectedPipeline() {
    if (!selected) return;
    qualifyMutation.mutate(selected.id);
  }

  function runSelectedPipeline() {
    if (!selected) return;
    if (!selectedInsight) {
      previewSelectedPipeline();
      return;
    }
    runPipelineMutation.mutate({
      conversationId: selected.id,
      dealTitle: t("conversations.pipelineDealTitle", {
        title: conversationTitle(selected, t),
      }),
    });
  }

  const selectedInsight = selected ? getAutoPipelineInsight(selected) : null;
  const canApplyPipeline = canRunAiPipeline && Boolean(selectedInsight);
  const messageList = useMemo(() => {
    if (!messages.data) return [];
    return [...messages.data.pages].reverse().flatMap((page) => page.results);
  }, [messages.data]);
  const canLoadMoreMessages = Boolean(messages.hasNextPage);
  const lastMessage = messageList[messageList.length - 1];
  const lastMessageSignature = lastMessage
    ? `${lastMessage.id}:${lastMessage.created_at || lastMessage.sent_at || ""}:${lastMessage.text || ""}`
    : "";

  useEffect(() => {
    if (!selected?.id) return;
    const frame = window.requestAnimationFrame(() => {
      if (messageEndRef.current) {
        messageEndRef.current.scrollIntoView({
          block: "end",
          behavior: "smooth",
        });
        return;
      }
      messageScrollRef.current?.scrollTo({
        top: messageScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [lastMessageSignature, messageList.length, selected?.id]);

  useEffect(() => {
    resizeComposer();
  }, [draft]);

  if (legacySelectedId) {
    return (
      <Navigate
        to={`/app/conversations/${legacySelectedId}${searchWithoutLegacyConversation(searchParams)}`}
        replace
      />
    );
  }

  if (pageError) {
    return (
      <div data-testid="inbox-error-state">
        <ErrorState
          message={getApiErrorMessage(pageError)}
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void Promise.all([
                  summary.refetch(),
                  conversations.refetch(),
                  selectedConversation.refetch(),
                  messages.refetch(),
                ]);
              }}
            >
              {t("common.retry")}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div
      className="-mx-2 overflow-hidden sm:-mx-3 lg:-mx-4"
      style={{ height: `calc(100dvh - ${CONVERSATIONS_SHELL_OFFSET}px)` }}
    >
      <WorkQueueLayout
        style={{ height: "100%", minHeight: 0 }}
        className={cn(
          "overflow-hidden border border-zani-border shadow-soft lg:grid-cols-[288px_minmax(0,1fr)]",
          inspectorOpen
            ? "xl:grid-cols-[288px_minmax(640px,1fr)_284px] 2xl:grid-cols-[288px_minmax(760px,1fr)_284px]"
            : "xl:grid-cols-[288px_minmax(0,1fr)]",
        )}
      >
        <ConversationListPane
          mobileThreadOpen={mobileThreadOpen}
          filters={filters}
          sortBy={sortBy}
          hasActiveFilters={hasActiveFilters}
          activeFilterSummary={activeFilterSummary}
          queueFilterOptions={queueFilterOptions}
          ownerFilterOptions={ownerFilterOptions}
          agentFilterOptions={agentFilterOptions}
          channelOptions={localizedChannelOptions}
          priorityOptions={localizedPriorityOptions}
          statusOptions={localizedStatusOptions}
          sortOptions={localizedSortOptions}
          onQueueChange={handleQueueChange}
          onOwnerChange={handleOwnerChange}
          onFilterChange={updateFilters}
          onSortChange={handleSortChange}
          onReset={resetConversationFilters}
          items={items}
          sortedItems={sortedItems}
          selectedId={selected?.id}
          loading={conversations.isLoading || selectedConversation.isLoading}
          bulkMode={bulkMode}
          selectedIds={selectedIds}
          onSelectVisible={selectVisibleConversations}
          onResetBulk={resetBulkSelection}
          onBulkAction={(action) => bulkMutation.mutate(action)}
          bulkPending={bulkMutation.isPending}
          onToggleBulkId={toggleBulkId}
          onSelectConversation={selectConversation}
          onRetryLastMessage={(conversation) => {
            const messageId = conversation.last_message?.id;
            if (!messageId) return;
            retryMessageMutation.mutate({
              conversationId: conversation.id,
              messageId,
            });
          }}
          retryingMessageId={
            retryMessageMutation.isPending
              ? Number(retryMessageMutation.variables?.messageId || 0)
              : null
          }
          priorityActions={summary.data?.next_actions || []}
          unavailableChannelCount={unavailableChannelCount}
          canViewIntegrations={canViewIntegrations}
          t={t}
        />

        <ConversationThreadPane
          selected={selected}
          mobileThreadOpen={mobileThreadOpen}
          onMobileClose={() => setMobileThreadOpen(false)}
          messageScrollRef={messageScrollRef}
          messageEndRef={messageEndRef}
          messagesLoading={messages.isLoading || selectedConversation.isLoading}
          messageList={messageList}
          canLoadMoreMessages={canLoadMoreMessages}
          isFetchingNextPage={messages.isFetchingNextPage}
          onLoadMoreMessages={() => {
            void messages.fetchNextPage();
          }}
          onRetryMessage={(failedMessage) => {
            if (!selected) return;
            retryMessageMutation.mutate({
              conversationId: selected.id,
              messageId: failedMessage.id,
            });
          }}
          draft={draft}
          composerRef={composerRef}
          sendPending={sendMutation.isPending}
          onDraftChange={setDraft}
          onResizeComposer={resizeComposer}
          onOpenQuickReplies={() => {
            setQuickReplySearch("");
            setQuickRepliesOpen(true);
          }}
          onSendReply={sendReply}
          onAssign={() => selected && assignMutation.mutate(selected.id)}
          assignPending={assignMutation.isPending}
          onToggleBot={() =>
            selected &&
            toggleBotMutation.mutate({
              conversationId: selected.id,
              botEnabled: !selected.bot_enabled,
            })
          }
          toggleBotPending={toggleBotMutation.isPending}
          onCloseConversation={() =>
            selected &&
            closeMutation.mutate({
              conversationId: selected.id,
              reason: "closed_from_inbox",
            })
          }
          closePending={closeMutation.isPending}
          onReopenConversation={() =>
            selected && reopenMutation.mutate(selected.id)
          }
          reopenPending={reopenMutation.isPending}
          t={t}
        />

        <aside
          className={cn(
            "hidden min-h-0 flex-col gap-3 overflow-y-auto border-l border-zani-border bg-surface-muted p-3 xl:flex",
            !inspectorOpen && "xl:hidden",
          )}
        >
          {selected ? (
            <>
              <section className="rounded-card border border-zani-border bg-surface-card p-3 shadow-soft">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-zani-muted">
                  {t("common.client")}
                </p>
                <div className="mt-3 flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                    <UserRound size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate font-bold text-zani-text">
                        {selected.client_name || conversationTitle(selected, t)}
                      </p>
                      <button
                        type="button"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-control text-zani-muted hover:bg-surface-hover hover:text-zani-text disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={t("common.open")}
                        disabled={!selected.client}
                        onClick={() =>
                          openEntity("/app/clients", selected.client)
                        }
                      >
                        <ExternalLink size={14} />
                      </button>
                    </div>
                    <p className="mt-1 truncate text-xs font-bold text-zani-muted">
                      {selected.client_phone ||
                        selected.external_user_id ||
                        t("conversations.noContact")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill className="bg-[var(--zani-success-soft)] text-zani-success ring-[rgba(21,128,61,0.18)]">
                        {selected.client
                          ? t("common.client")
                          : t("conversations.newContact")}
                      </Pill>
                      <Pill className="bg-surface-muted text-zani-muted ring-zani-border">
                        {channelLabel(selected.channel, t)}
                      </Pill>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-card border border-zani-border bg-surface-card p-3 shadow-soft">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-zani-muted">
                  {t("conversations.dialogState")}
                </p>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-card bg-surface-muted p-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-zani-muted">
                        {t("conversations.channel")}
                      </p>
                      <p className="mt-1 font-bold text-zani-text">
                        {channelLabel(selected.channel, t)}
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-zani-muted">
                        {selected.bot_enabled
                          ? t("conversations.channelConnected")
                          : t("conversations.botPaused")}
                      </p>
                    </div>
                    {selected.bot_enabled ? (
                      <PlayCircle className="text-zani-success" size={22} />
                    ) : (
                      <PauseCircle className="text-zani-warning" size={22} />
                    )}
                  </div>
                  <div className="rounded-card bg-surface-muted p-2">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-zani-muted">
                      {t("conversations.responsible")}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zani-card text-xs font-bold text-zani-text ring-1 ring-zani-border">
                          {(selected.assigned_to_email || "ZA")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <p className="min-w-0 truncate text-sm font-bold text-zani-text">
                          {selected.assigned_to_email ||
                            t("conversations.unassigned")}
                        </p>
                      </div>
                      {!selected.assigned_to ? (
                        <Button
                          type="button"
                          className="h-8 rounded-control px-3 text-xs"
                          variant="secondary"
                          onClick={() => assignMutation.mutate(selected.id)}
                          isLoading={assignMutation.isPending}
                        >
                          {t("conversations.take")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <Select
                    label={t("conversations.priority")}
                    value={selected.priority || "normal"}
                    options={priorityActionOptions}
                    onChange={(event) =>
                      setPriorityMutation.mutate({
                        conversationId: selected.id,
                        priority: event.target.value as NonNullable<
                          InboxConversation["priority"]
                        >,
                      })
                    }
                    disabled={setPriorityMutation.isPending}
                  />
                  <Button
                    type="button"
                    className="h-9 rounded-control px-3 text-xs"
                    variant="secondary"
                    onClick={() => markUnreadMutation.mutate(selected.id)}
                    isLoading={markUnreadMutation.isPending}
                  >
                    <BellDot size={15} /> {t("conversations.markUnreadAction")}
                  </Button>
                </div>
              </section>

              <section className="rounded-card border border-zani-border bg-surface-card p-3 shadow-soft">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-zani-muted">
                  <Link2 size={15} /> {t("conversations.crmLink")}
                </p>
                <div className="mt-3 space-y-3">
                  <div className="rounded-card bg-surface-muted p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-zani-muted">
                          {t("common.client")}
                        </p>
                        <p className="truncate text-sm font-bold text-zani-text">
                          {selected.client_name ||
                            (selected.client
                              ? `#${selected.client}`
                              : t("conversations.clientNotCreated"))}
                        </p>
                      </div>
                      <Pill
                        className={
                          selected.client
                            ? "bg-[var(--zani-success-soft)] text-zani-success ring-[rgba(21,128,61,0.18)]"
                            : "bg-surface-muted text-zani-muted ring-zani-border"
                        }
                      >
                        {selected.client
                          ? t("conversations.linked")
                          : t("conversations.notLinked")}
                      </Pill>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        className="h-8 rounded-control px-2 text-xs"
                        variant="secondary"
                        onClick={() =>
                          selected.client
                            ? openEntity("/app/clients", selected.client)
                            : createClientMutation.mutate({
                                conversationId: selected.id,
                              })
                        }
                        isLoading={createClientMutation.isPending}
                      >
                        {selected.client
                          ? t("conversations.openClient")
                          : t("conversations.createClient")}
                      </Button>
                      <Button
                        type="button"
                        className="h-8 rounded-control px-2 text-xs"
                        variant="secondary"
                        onClick={() => openCrmLinkModal("client")}
                      >
                        {t("conversations.linkExisting")}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-card bg-surface-muted p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-zani-muted">
                          {t("leads.title")}
                        </p>
                        <p className="truncate text-sm font-bold text-zani-text">
                          {selected.lead
                            ? `#${selected.lead}`
                            : t("conversations.leadNotLinked")}
                        </p>
                      </div>
                      <Pill
                        className={
                          selected.lead
                            ? "bg-[var(--zani-success-soft)] text-zani-success ring-[rgba(21,128,61,0.18)]"
                            : "bg-surface-muted text-zani-muted ring-zani-border"
                        }
                      >
                        {selected.lead
                          ? t("conversations.linked")
                          : t("conversations.notLinked")}
                      </Pill>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        className="h-8 rounded-control px-2 text-xs"
                        variant="secondary"
                        onClick={() =>
                          selected.lead
                            ? openEntity("/app/leads", selected.lead)
                            : createLinkedLead()
                        }
                        isLoading={createLeadMutation.isPending}
                      >
                        {selected.lead
                          ? t("conversations.openLead")
                          : t("conversations.createLead")}
                      </Button>
                      <Button
                        type="button"
                        className="h-8 rounded-control px-2 text-xs"
                        variant="secondary"
                        onClick={() => openCrmLinkModal("lead")}
                      >
                        {t("conversations.linkExisting")}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-card bg-surface-muted p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-zani-muted">
                          {t("deals.title")}
                        </p>
                        <p className="truncate text-sm font-bold text-zani-text">
                          {selected.deal
                            ? `#${selected.deal}`
                            : t("conversations.dealNotLinked")}
                        </p>
                      </div>
                      <Pill
                        className={
                          selected.deal
                            ? "bg-[var(--zani-success-soft)] text-zani-success ring-[rgba(21,128,61,0.18)]"
                            : "bg-surface-muted text-zani-muted ring-zani-border"
                        }
                      >
                        {selected.deal
                          ? t("conversations.linked")
                          : t("conversations.notLinked")}
                      </Pill>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        className="h-8 rounded-control px-2 text-xs"
                        variant="secondary"
                        onClick={() =>
                          selected.deal
                            ? openEntity("/app/deals", selected.deal)
                            : createLinkedDeal()
                        }
                        isLoading={createDealMutation.isPending}
                      >
                        {selected.deal
                          ? t("conversations.openDeal")
                          : t("conversations.createDeal")}
                      </Button>
                      <Button
                        type="button"
                        className="h-8 rounded-control px-2 text-xs"
                        variant="secondary"
                        onClick={() => openCrmLinkModal("deal")}
                      >
                        {t("conversations.linkExisting")}
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="button"
                    className="h-9 w-full rounded-control px-3 text-xs"
                    variant="secondary"
                    onClick={createLinkedTask}
                    isLoading={createTaskMutation.isPending}
                  >
                    <CheckSquare size={15} /> {t("conversations.createTask")}
                  </Button>
                </div>
              </section>

              <section className="rounded-card border border-ai-100 bg-ai-50 p-3 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 font-bold text-ai-900">
                    <Sparkles size={18} /> {t("conversations.replyHint")}
                  </p>
                  <span className="rounded-full bg-zani-card/80 px-2 py-0.5 text-[10px] font-bold text-ai-700 ring-1 ring-ai-100">
                    BETA
                  </span>
                </div>
                <p className="mt-2 text-xs font-bold leading-5 text-ai-800">
                  {t("conversations.assistantDraftHelp")}
                </p>
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-ai-700">
                  {t("conversations.recommendedReply")}
                </p>
                <div className="mt-3 rounded-card bg-zani-card p-3 text-xs font-semibold leading-5 text-zani-text">
                  {draft || t("conversations.prepareDraftFallback")}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    className="h-10 rounded-control px-3 text-xs"
                    variant="ai"
                    onClick={() => suggestMutation.mutate(selected.id)}
                    isLoading={suggestMutation.isPending}
                    disabled={!canSuggestAi}
                  >
                    <Sparkles size={16} /> {t("conversations.prepareReply")}
                  </Button>
                  <Button
                    type="button"
                    className="h-10 rounded-control px-3 text-xs"
                    variant="secondary"
                    disabled={selected.status === "closed"}
                    onClick={() => {
                      setQuickReplySearch("");
                      setQuickRepliesOpen(true);
                    }}
                  >
                    <Tags size={15} /> {t("conversations.quickRepliesButton")}
                  </Button>
                </div>
              </section>

              <section className="rounded-card border border-ai-100 bg-surface-card p-3 shadow-soft">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-ai-700">
                  <CalendarCheck size={15} /> {t("conversations.crmAutomation")}
                </p>
                <div className="mt-3 rounded-card bg-ai-50 p-3">
                  <p className="text-sm font-bold text-zani-text">
                    {selectedInsight?.nextAction ||
                      (selected.handoff_required
                        ? t("conversations.replyToClient")
                        : t("conversations.checkLinkedLeads"))}
                  </p>
                  <p className="mt-2 text-xs font-bold leading-5 text-zani-muted">
                    {selectedInsight?.intent
                      ? t("conversations.intentLine", {
                          intent: selectedInsight.intent,
                        })
                      : t("conversations.crmAutomationPreviewFallback")}
                    {selectedInsight?.confidence !== null &&
                    selectedInsight?.confidence !== undefined
                      ? ` ${t("conversations.confidenceLine", { confidence: selectedInsight.confidence })}`
                      : ""}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    className="h-10 rounded-control px-3 text-xs"
                    variant="ai"
                    onClick={previewSelectedPipeline}
                    disabled={!canSuggestAiPipeline}
                    isLoading={qualifyMutation.isPending}
                    title={
                      !canSuggestAiPipeline
                        ? t("permissions.hiddenTitle")
                        : undefined
                    }
                  >
                    <Sparkles size={16} />{" "}
                    {t("conversations.previewQualification")}
                  </Button>
                  <Button
                    type="button"
                    className="h-10 rounded-control px-3 text-xs"
                    variant="secondary"
                    onClick={runSelectedPipeline}
                    disabled={!canApplyPipeline}
                    isLoading={runPipelineMutation.isPending}
                    title={
                      !canRunAiPipeline
                        ? t("permissions.hiddenTitle")
                        : !selectedInsight
                          ? t("conversations.previewRequired")
                          : undefined
                    }
                  >
                    <Link2 size={16} /> {t("conversations.updateLinks")}
                  </Button>
                </div>
              </section>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-center text-sm font-bold text-zani-muted">
              {t("conversations.selectContext")}
            </div>
          )}
        </aside>
      </WorkQueueLayout>

      <Dialog
        title={t("conversations.quickRepliesTitle")}
        open={quickRepliesOpen}
        onClose={() => setQuickRepliesOpen(false)}
        size="md"
        bodyClassName="bg-zani-card p-0"
      >
        <div className="border-b border-zani-border p-4">
          <input
            type="search"
            className="h-11 w-full rounded-control border border-zani-border bg-zani-card px-3 text-sm font-semibold text-zani-text outline-none transition placeholder:text-zani-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
            placeholder={t("conversations.quickRepliesSearch")}
            value={quickReplySearch}
            onChange={(event) => setQuickReplySearch(event.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-[56vh] overflow-y-auto p-3">
          {quickReplies.isLoading ? (
            <LoadingState label={t("common.loading")} />
          ) : null}
          {!quickReplies.isLoading && !quickReplyTemplates.length ? (
            <EmptyState
              title={t("conversations.noTemplates")}
              description={t("conversations.noQuickRepliesText")}
            />
          ) : null}
          <div className="space-y-2">
            {quickReplyTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="w-full rounded-card border border-zani-border bg-zani-card p-3 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                onClick={() => insertQuickReply(template.text)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-zani-text">
                      {template.title}
                    </p>
                    <p className="mt-1 line-clamp-3 text-sm font-semibold leading-6 text-zani-muted">
                      {template.text}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-surface-muted px-2 py-1 text-[11px] font-bold text-zani-muted">
                    {template.channel === "all"
                      ? t("conversations.allChannels")
                      : channelLabel(template.channel, t)}
                  </span>
                </div>
                {template.category ? (
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-zani-muted">
                    {template.category}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </Dialog>

      <Dialog
        title={
          crmLinkModal === "client"
            ? t("conversations.linkClientTitle")
            : crmLinkModal === "lead"
              ? t("conversations.linkLeadTitle")
              : t("conversations.linkDealTitle")
        }
        open={Boolean(crmLinkModal)}
        onClose={() => setCrmLinkModal(null)}
        size="md"
        bodyClassName="bg-zani-card p-0"
      >
        <div className="border-b border-zani-border p-4">
          <Input
            value={crmLinkSearch}
            onChange={(event) => setCrmLinkSearch(event.target.value)}
            placeholder={t("conversations.linkSearchPlaceholder")}
            autoFocus
          />
        </div>
        <div className="max-h-[56vh] overflow-y-auto p-3">
          {crmLinkModal === "client" ? (
            <>
              {clientLinkCandidates.isLoading ? (
                <LoadingState label={t("common.loading")} />
              ) : null}
              {!clientLinkCandidates.isLoading &&
              !clientLinkCandidates.data?.length ? (
                <EmptyState
                  title={t("conversations.noLinkCandidates")}
                  description={t("conversations.noLinkCandidatesText")}
                />
              ) : null}
              <div className="space-y-2">
                {(clientLinkCandidates.data || []).map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    className="w-full rounded-card border border-zani-border bg-zani-card p-3 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                    onClick={() => linkClientToConversation(client.id)}
                  >
                    <p className="text-sm font-bold text-zani-text">
                      {client.full_name || `#${client.id}`}
                    </p>
                    <p className="mt-1 text-xs font-bold text-zani-muted">
                      {client.phone ||
                        client.email ||
                        t("conversations.noContact")}
                    </p>
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {crmLinkModal === "lead" ? (
            <>
              {leadLinkCandidates.isLoading ? (
                <LoadingState label={t("common.loading")} />
              ) : null}
              {!leadLinkCandidates.isLoading &&
              !leadLinkCandidates.data?.length ? (
                <EmptyState
                  title={t("conversations.noLinkCandidates")}
                  description={t("conversations.noLinkCandidatesText")}
                />
              ) : null}
              <div className="space-y-2">
                {(leadLinkCandidates.data || []).map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    className="w-full rounded-card border border-zani-border bg-zani-card p-3 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                    onClick={() => linkLeadToConversation(lead.id)}
                  >
                    <p className="text-sm font-bold text-zani-text">
                      {lead.client_name || `#${lead.id}`}
                    </p>
                    <p className="mt-1 text-xs font-bold text-zani-muted">
                      {lead.message || lead.status}
                    </p>
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {crmLinkModal === "deal" ? (
            <>
              {dealLinkCandidates.isLoading ? (
                <LoadingState label={t("common.loading")} />
              ) : null}
              {!dealLinkCandidates.isLoading &&
              !dealLinkCandidates.data?.length ? (
                <EmptyState
                  title={t("conversations.noLinkCandidates")}
                  description={t("conversations.noLinkCandidatesText")}
                />
              ) : null}
              <div className="space-y-2">
                {(dealLinkCandidates.data || []).map((deal) => (
                  <button
                    key={deal.id}
                    type="button"
                    className="w-full rounded-card border border-zani-border bg-zani-card p-3 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                    onClick={() => linkDealToConversation(deal.id)}
                  >
                    <p className="text-sm font-bold text-zani-text">
                      {deal.title || `#${deal.id}`}
                    </p>
                    <p className="mt-1 text-xs font-bold text-zani-muted">
                      {deal.client_name || deal.stage_name || deal.status}
                    </p>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        title={t("conversations.createTaskTitle")}
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        size="md"
        bodyClassName="space-y-4 bg-zani-card"
      >
        <Input
          label={t("tasks.title")}
          value={taskDraft.title}
          onChange={(event) =>
            setTaskDraft((current) => ({
              ...current,
              title: event.target.value,
            }))
          }
          placeholder={t("tasks.titlePlaceholder")}
          autoFocus
        />
        <Textarea
          label={t("tasks.description")}
          value={taskDraft.description}
          onChange={(event) =>
            setTaskDraft((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          placeholder={t("tasks.descriptionPlaceholder")}
          rows={4}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label={t("tasks.priority")}
            value={taskDraft.priority}
            options={[
              { value: "low", label: t("tasks.priorityLow") },
              { value: "normal", label: t("tasks.priorityNormal") },
              { value: "high", label: t("tasks.priorityHigh") },
              { value: "urgent", label: t("tasks.priorityUrgent") },
            ]}
            onChange={(event) =>
              setTaskDraft((current) => ({
                ...current,
                priority: event.target.value as typeof taskDraft.priority,
              }))
            }
          />
          <Input
            label={t("tasks.dueAt")}
            type="datetime-local"
            value={taskDraft.due_at}
            onChange={(event) =>
              setTaskDraft((current) => ({
                ...current,
                due_at: event.target.value,
              }))
            }
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-zani-border pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setTaskModalOpen(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={submitTaskFromInspector}
            disabled={!taskDraft.title.trim()}
            isLoading={createTaskMutation.isPending}
          >
            {t("tasks.create")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
