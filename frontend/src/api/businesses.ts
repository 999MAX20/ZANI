import { createCrudApi } from "./crud";
import type { Business } from "../types";

export const businessesApi = createCrudApi<Business>("/api/businesses/");
