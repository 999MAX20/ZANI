import { Plus } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { useI18n } from "../../../lib/i18n";

export function CreateAgentModal({
  canManage,
  isCreating,
  name,
  onClose,
  onNameChange,
  onSubmit,
  open,
}: {
  canManage: boolean;
  isCreating: boolean;
  name: string;
  onClose: () => void;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
  open: boolean;
}) {
  const { t } = useI18n();
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const frameId = window.requestAnimationFrame(() => nameInputRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frameId);
  }, [open]);

  return (
    <Modal title={t("aiAgents.newAgentTitle")} open={open} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Input
          ref={nameInputRef}
          autoFocus
          label={t("aiAgents.agentName")}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={t("aiAgents.agentNamePlaceholder")}
        />
        <Button type="submit" variant="primary" disabled={!canManage || !name.trim()} isLoading={isCreating}>
          <Plus aria-hidden="true" size={16} />
          {t("aiAgents.createAgent")}
        </Button>
      </form>
    </Modal>
  );
}

export function UnsavedAgentChangesModal({
  onClose,
  onDiscard,
  open,
}: {
  onClose: () => void;
  onDiscard: () => void;
  open: boolean;
}) {
  const { t } = useI18n();

  return (
    <Modal title={t("aiAgents.unsavedTitle")} open={open} onClose={onClose}>
      <p className="text-sm font-medium leading-6 text-zani-subtle">{t("aiAgents.unsavedText")}</p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="button" variant="warning" onClick={onDiscard}>
          {t("actions.discardChanges")}
        </Button>
      </div>
    </Modal>
  );
}
