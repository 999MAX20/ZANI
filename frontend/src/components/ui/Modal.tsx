import { Dialog } from "./Overlay";

export function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog title={title} open={open} onClose={onClose}>
      {children}
    </Dialog>
  );
}
