import { Modal } from "../../../components/ui/Modal";

type ShortcutItem = {
  key: string;
  label: string;
};

export function LeadShortcutsModal({
  open,
  title,
  shortcuts,
  onClose,
}: {
  open: boolean;
  title: string;
  shortcuts: ShortcutItem[];
  onClose: () => void;
}) {
  return (
    <Modal title={title} open={open} onClose={onClose}>
      <div className="grid gap-2 sm:grid-cols-2">
        {shortcuts.map((shortcut) => (
          <div
            key={shortcut.key}
            className="flex items-center justify-between gap-3 rounded-control border border-zani-border bg-surface-muted px-3 py-2"
          >
            <span className="text-sm font-bold text-zani-muted">
              {shortcut.label}
            </span>
            <kbd className="rounded-lg border border-zani-border bg-surface-card px-2 py-1 text-xs font-bold text-zani-text shadow-sm">
              {shortcut.key}
            </kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
}
