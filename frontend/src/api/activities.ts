import { createCrudApi } from "./crud";
import { apiClient } from "./client";
import type { ActivityEvent, Client, Id, Segment, SegmentFilter, Tag, TaggedObject } from "../types";

export const activityEventsApi = createCrudApi<ActivityEvent>("/api/activity-events/");
export const tagsApi = createCrudApi<Tag>("/api/tags/");
export const taggedObjectsApi = {
  ...createCrudApi<TaggedObject>("/api/tagged-objects/"),
  listForEntity: async ({ entity_type, entity_id }: { entity_type: string; entity_id: Id | string }) => {
    const { data } = await apiClient.get<TaggedObject[] | { results: TaggedObject[] }>("/api/tagged-objects/", {
      params: { entity_type, entity_id },
    });
    return Array.isArray(data) ? data : data.results;
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
