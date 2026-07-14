import type { CrmEntityType, Id } from "../../../types";

export type CrmCardTab = "overview" | "timeline" | "tasks" | "appointments" | "messages" | "notes" | "deals" | "files";

export type CrmDrawerEntity = {
  type: CrmEntityType;
  id: Id;
  initialTab?: CrmCardTab;
};

export type CrmDrawerTabConfig = {
  id: CrmCardTab;
  labelKey: string;
};
