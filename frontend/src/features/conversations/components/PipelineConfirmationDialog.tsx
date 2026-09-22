import { useState } from "react";

import type { PipelineAction, PipelineConfirmation } from "../../../api/inbox";
import { Button } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Overlay";
import { ErrorState } from "../../../components/ui/StateViews";
import { useI18n } from "../../../lib/i18n";

export type PipelineReview = Omit<PipelineConfirmation, "actions"> & {
  summary: string;
  proposedActions: PipelineAction[];
};

export function PipelineConfirmationDialog({ review, allowedActions, pending, error, onClose, onConfirm }: {
  review: PipelineReview;
  allowedActions: PipelineAction[];
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (confirmation: PipelineConfirmation) => void;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(() => review.proposedActions.filter((action) => allowedActions.includes(action)));
  const actions = selected.filter((action) => allowedActions.includes(action));
  return (
    <Dialog open title={t("conversations.confirmPipelineTitle")} onClose={() => { if (!pending) onClose(); }} size="md">
      <div className="space-y-4">
        <p className="whitespace-pre-wrap text-sm text-zani-text">{review.summary}</p>
        <fieldset disabled={pending} className="space-y-3">
          <legend className="mb-3 text-sm font-semibold">{t("conversations.confirmPipelineActions")}</legend>
          {(["create_lead", "create_task", "create_deal"] as const).map((action) => (
            <label key={action} className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={actions.includes(action)} disabled={!allowedActions.includes(action)}
                onChange={(event) => setSelected((current) => event.target.checked ? [...current, action] : current.filter((item) => item !== action))} />
              {t(`conversations.confirmPipeline.${action}`)}
            </label>
          ))}
        </fieldset>
        {error ? <ErrorState message={error} /> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>{t("common.cancel")}</Button>
          <Button onClick={() => onConfirm({ conversationId: review.conversationId, previewId: review.previewId, actions })}
            disabled={!actions.length} isLoading={pending}>{t("conversations.confirmPipelineSubmit")}</Button>
        </div>
      </div>
    </Dialog>
  );
}
