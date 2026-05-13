import { createCrudApi } from "./crud";
import type { AutomationRule } from "../types";

export const automationRulesApi = createCrudApi<AutomationRule>("/api/automation-rules/");
