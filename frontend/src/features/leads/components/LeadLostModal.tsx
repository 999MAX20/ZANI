import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";

export function LeadLostModal({
  open,
  title,
  leadTitle,
  leadMessage,
  reason,
  reasons,
  isLoading,
  labels,
  onClose,
  onReasonChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  leadTitle: string;
  leadMessage: string;
  reason: string;
  reasons: string[];
  isLoading: boolean;
  labels: {
    noComment: string;
    reasonType: string;
    selectReason: string;
    comment: string;
    submit: string;
  };
  onClose: () => void;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
}) {
  if (!open) return null;

  return (
    <Modal title={title} open={open} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="font-black text-midnight">{leadTitle}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">{leadMessage || labels.noComment}</p>
        </div>
        <Select
          label={labels.reasonType}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          options={[
            { value: "", label: labels.selectReason },
            ...reasons.map((item) => ({ value: item, label: item })),
          ]}
        />
        <Input label={labels.comment} value={reason} onChange={(event) => onReasonChange(event.target.value)} required />
        <Button type="submit" variant="danger" isLoading={isLoading} disabled={!reason}>{labels.submit}</Button>
      </form>
    </Modal>
  );
}
