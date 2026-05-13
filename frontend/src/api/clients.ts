import { createCrudApi } from "./crud";
import type { Client } from "../types";

export const clientsApi = createCrudApi<Client>("/api/clients/");
