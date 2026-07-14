import { apiClient, unwrapList } from "./client";
import { createCrudApi } from "./crud";
import type { CrmEntityType, CustomFieldDefinition, CustomFieldValue, Id } from "../types";

export const customFieldsApi = {
  ...createCrudApi<CustomFieldDefinition>("/api/custom-fields/"),
  listByEntity: async (entityType: CrmEntityType) => {
    const { data } = await apiClient.get<{ results: CustomFieldDefinition[] } | CustomFieldDefinition[]>("/api/custom-fields/", {
      params: { entity_type: entityType },
    });
    return unwrapList(data);
  },
};

export const customFieldValuesApi = {
  ...createCrudApi<CustomFieldValue>("/api/custom-field-values/"),
  bulkUpsert: async (payload: {
    business: Id;
    entity_type: CrmEntityType;
    entity_id: string;
    values: Array<{ definition: Id; value_json: Record<string, unknown> }>;
  }) => {
    const { data } = await apiClient.post<CustomFieldValue[]>("/api/custom-field-values/bulk-upsert/", payload);
    return unwrapList(data);
  },
};
