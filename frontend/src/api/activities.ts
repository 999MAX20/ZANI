import { createCrudApi } from "./crud";
import { apiClient, unwrapList } from "./client";
import type { ActivityEvent, Client, Id, Note, Segment, SegmentFilter, Tag, TaggedObject } from "../types";
import type { PaginatedResponse } from "./client";
import type { TimelineActorsPage, TimelineEvent, TimelineFilters } from "../types/timeline";

export const activityEventsApi = {
  ...createCrudApi<ActivityEvent>("/api/activity-events/"),
  listPage: async (business: Id, filters: TimelineFilters, signal?: AbortSignal) => {
    const { search, ...rest } = filters;
    const params = Object.fromEntries(Object.entries({ business, ...rest, q: search }).filter(([, value]) => value !== ""));
    const { data } = await apiClient.get<PaginatedResponse<TimelineEvent>>("/api/activity-events/", { params, signal });
    return data;
  },
  actors: async (business: Id, q: string, page: number, selected_actor?: string, signal?: AbortSignal) => {
    const { data } = await apiClient.get<TimelineActorsPage>("/api/activity-events/actors/", { params: { business, q, page, page_size: 20, selected_actor: selected_actor && selected_actor !== "none" ? selected_actor : undefined }, signal });
    return data;
  },
  listForEntity: async ({ entity_type, entity_id }: { entity_type: string; entity_id: Id | string }) => {
    const { data } = await apiClient.get<ActivityEvent[] | { results: ActivityEvent[] }>("/api/activity-events/", {
      params: { entity_type, entity_id },
    });
    return unwrapList(data);
  },
};
export const notesApi = createCrudApi<Note>("/api/notes/");
export const tagsApi = createCrudApi<Tag>("/api/tags/");
export const taggedObjectsApi = {
  ...createCrudApi<TaggedObject>("/api/tagged-objects/"),
  listForEntity: async ({ entity_type, entity_id }: { entity_type: string; entity_id: Id | string }) => {
    const { data } = await apiClient.get<TaggedObject[] | { results: TaggedObject[] }>("/api/tagged-objects/", {
      params: { entity_type, entity_id },
    });
    return unwrapList(data);
  },
};
export const segmentFiltersApi = createCrudApi<SegmentFilter>("/api/segment-filters/");
export const segmentsApi = {
  ...createCrudApi<Segment>("/api/segments/"),
  evaluate: async (id: Id) => {
    const { data } = await apiClient.get<{ count: number; clients: Client[] }>(`/api/segments/${id}/evaluate/`);
    return data;
  },
  refreshCount: async (id: Id) => {
    const { data } = await apiClient.post<{ count: number; segment: Segment }>(`/api/segments/${id}/refresh-count/`);
    return data;
  },
};
