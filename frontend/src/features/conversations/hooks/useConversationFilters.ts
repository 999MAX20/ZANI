import { useEffect, useMemo, useState } from "react";
import type { SetURLSearchParams } from "react-router-dom";

import { normalizeFilters, type InboxFilters } from "../../../api/inbox";
import { CONVERSATIONS_PRESET_STORAGE_KEY } from "../conversationConstants";
import type { InboxPreset, InboxSort } from "../conversationTypes";
import { getPresetFilters, getSavedConversationsFilterState, isValidPreset } from "../conversationUtils";

const FILTER_QUERY_KEYS = [
  "status",
  "bot",
  "channel",
  "assigned_to",
  "priority",
  "unread",
  "handoff_required",
  "bot_enabled",
  "search",
  "preset",
  "sort",
];

type UseConversationFiltersArgs = {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  selectedId: number | null;
};

export function useConversationFilters({ searchParams, setSearchParams, selectedId }: UseConversationFiltersArgs) {
  const savedState = getSavedConversationsFilterState();
  const isFilterUrlPresent = FILTER_QUERY_KEYS.some((key) => searchParams.get(key));
  const [activePreset, setActivePreset] = useState<InboxPreset>(() => {
    const presetFromUrl = searchParams.get("preset");
    if (isValidPreset(presetFromUrl)) return presetFromUrl;
    if (!isFilterUrlPresent && savedState?.preset) return savedState.preset;
    return "all";
  });
  const [sortBy, setSortBy] = useState<InboxSort>(() => {
    const sortFromUrl = searchParams.get("sort");
    if (sortFromUrl === "latest" || sortFromUrl === "unread" || sortFromUrl === "first_response") return sortFromUrl;
    if (savedState?.sortBy) return savedState.sortBy;
    return "latest";
  });
  const [filters, setFilters] = useState<InboxFilters>(() => {
    const base: InboxFilters = {
      status: searchParams.get("status") || "",
      bot: searchParams.get("bot") || savedState?.filters?.bot || undefined,
      channel: searchParams.get("channel") || savedState?.filters?.channel || undefined,
      assigned_to: searchParams.get("assigned_to") || savedState?.filters?.assigned_to || undefined,
      priority: searchParams.get("priority") || savedState?.filters?.priority || undefined,
      unread: searchParams.get("unread") || undefined,
      handoff_required: searchParams.get("handoff_required") || undefined,
      bot_enabled: searchParams.get("bot_enabled") || undefined,
      search: searchParams.get("search") || undefined,
    };
    const presetFromUrl = searchParams.get("preset");
    if (!isFilterUrlPresent && isValidPreset(presetFromUrl) && presetFromUrl !== "custom") {
      return getPresetFilters(presetFromUrl, base);
    }
    if (!isFilterUrlPresent && savedState?.preset) {
      return getPresetFilters(savedState.preset, base);
    }
    return base;
  });

  function persistFilterState(nextFilters: InboxFilters, preset: InboxPreset, nextSort?: InboxSort) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      CONVERSATIONS_PRESET_STORAGE_KEY,
      JSON.stringify({
        preset,
        sortBy: nextSort || sortBy,
        filters: nextFilters,
      }),
    );
  }

  function applyFilters(nextFilters: InboxFilters, preset: InboxPreset = activePreset, nextSortBy?: InboxSort, replaceHistory = true) {
    setFilters(nextFilters);
    setActivePreset(preset);
    if (nextSortBy) {
      setSortBy(nextSortBy);
    }
    persistFilterState(nextFilters, preset, nextSortBy);

    const params = new URLSearchParams();
    if (selectedId) params.set("conversation", String(selectedId));
    if (searchParams.get("page") && searchParams.get("page") !== "1") {
      params.set("page", searchParams.get("page") || "");
    }

    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
    });
    params.set("sort", nextSortBy || sortBy);
    if (preset !== "custom") params.set("preset", preset);

    setSearchParams(params, { replace: replaceHistory });
  }

  useEffect(() => {
    const hasFilterQuery = FILTER_QUERY_KEYS.some((key) => searchParams.get(key));
    if (!hasFilterQuery) return;

    const nextFilters: InboxFilters = {
      status: searchParams.get("status") || "",
      bot: searchParams.get("bot") || undefined,
      channel: searchParams.get("channel") || undefined,
      assigned_to: searchParams.get("assigned_to") || undefined,
      priority: searchParams.get("priority") || undefined,
      unread: searchParams.get("unread") || undefined,
      handoff_required: searchParams.get("handoff_required") || undefined,
      bot_enabled: searchParams.get("bot_enabled") || undefined,
      search: searchParams.get("search") || undefined,
    };

    const nextSort: InboxSort = (searchParams.get("sort") as InboxSort) || "latest";
    const presetFromUrl = searchParams.get("preset");

    if (presetFromUrl && isValidPreset(presetFromUrl)) {
      setActivePreset(presetFromUrl);
    }
    setSortBy((prev) => (nextSort === "latest" || nextSort === "unread" || nextSort === "first_response" ? nextSort : prev));
    setFilters(nextFilters);
  }, [searchParams]);

  const normalizedFilters = useMemo(() => normalizeFilters(filters), [filters]);

  return {
    activePreset,
    applyFilters,
    filters,
    normalizedFilters,
    sortBy,
  };
}
