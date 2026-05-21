import { createCrudApi } from "./crud";
import type { QuickReplyTemplate } from "../types";

export const quickRepliesApi = createCrudApi<QuickReplyTemplate>("/api/quick-replies/");
