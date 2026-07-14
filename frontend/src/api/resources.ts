import { createCrudApi } from "./crud";
import type { Resource } from "../types";

export const resourcesApi = createCrudApi<Resource>("/api/resources/");
