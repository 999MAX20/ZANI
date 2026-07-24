import type { Appointment, CurrentUser, Id, Resource } from "../../types";
import { getPermissionScope } from "../../lib/permissions";

export function canAccessAppointmentAction({
  appointment,
  resources,
  user,
  businessId,
  action = "update",
}: {
  appointment: Appointment;
  resources: Resource[];
  user: CurrentUser | null;
  businessId: Id | undefined;
  action?: "update" | "delete";
}) {
  const scope = getPermissionScope(
    user,
    businessId,
    "appointments",
    action,
  );
  if (scope === "business") return true;
  if (scope !== "own" || !user?.id || !appointment.resource) return false;

  const resource = resources.find(
    (item) => Number(item.id) === Number(appointment.resource),
  );
  return Number(resource?.linked_user) === Number(user.id);
}
