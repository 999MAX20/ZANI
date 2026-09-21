import { useCallback, useState } from "react";
import { Button } from "../components/ui/Button";
import { ServiceEditModal } from "../features/services/components/ServiceEditModal";
import { useI18n } from "../lib/i18n";
import { serviceFixture } from "./serviceFixtures";

export type ServiceModalState = "editable" | "archived" | "error" | "saving";

export function ServiceModalExample({ state = "editable" }: { state?: ServiceModalState }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  const [savedName, setSavedName] = useState("");
  const [error, setError] = useState(state === "error");
  const onDirtyChange = useCallback(() => {}, []);
  const service = serviceFixture(`Synthetic — ${t("services.name")} — ${t("services.inspectorSubtitle")}`, {
    is_archived: state === "archived", is_active: state !== "archived",
  });
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("common.edit")}</Button>
      <output data-testid="catalog-saved-name">{savedName}</output>
      <ServiceEditModal
        service={open ? service : null} businessId={0} appointmentCount={12}
        canManage isSaving={state === "saving"}
        errorMessage={error ? t("actions.errorNetwork") : undefined}
        onDirtyChange={onDirtyChange} onClose={() => setOpen(false)}
        onSubmit={async (payload) => {
          // Local callback demonstration, never a CRM mutation or simulated API.
          setSavedName(payload.name || ""); setError(false); setOpen(false);
        }}
      />
    </>
  );
}
