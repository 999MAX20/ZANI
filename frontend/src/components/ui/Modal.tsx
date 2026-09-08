import { Dialog } from "./Overlay";

export function Modal({
  title,
  open,
  onClose,
  children,
  size,
  className,
  bodyClassName,
  closeOnBackdrop,
  testId,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  bodyClassName?: string;
  closeOnBackdrop?: boolean;
  testId?: string;
}) {
  return (
    <Dialog
      title={title}
      open={open}
      onClose={onClose}
      size={size}
      className={className}
      bodyClassName={bodyClassName}
      closeOnBackdrop={closeOnBackdrop}
      testId={testId}
    >
      {children}
    </Dialog>
  );
}
