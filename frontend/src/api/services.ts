import { createCrudApi } from "./crud";
import type { Service } from "../types";

export const servicesApi = createCrudApi<Service>("/api/services/");
