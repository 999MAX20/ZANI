import type { Service } from "../types";

// Deliberately synthetic: no API imports, real IDs, people, contact data or dates.
export function serviceFixture(name: string, overrides: Partial<Service> = {}): Service {
  return {
    id: 1, business: 0, name, description: "Synthetic fixture",
    duration_minutes: 30, price_from: "5000.00", is_active: true,
    is_archived: false, archived_at: null, archived_by: null, archive_reason: "",
    created_at: "2020-01-01T00:00:00Z", updated_at: "2020-01-01T00:00:00Z",
    ...overrides,
  };
}
