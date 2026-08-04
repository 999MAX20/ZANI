import { Upload } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useI18n } from "../../../lib/i18n";

export function AttachmentFilePicker({
  accept,
  onFiles,
}: {
  accept: string;
  onFiles: (files: FileList | File[]) => void;
}) {
  const { t } = useI18n();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const restoreDrawerPositionAndFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      const trigger = triggerRef.current;
      const drawer = trigger?.closest<HTMLElement>(
        '[data-testid="crm-entity-drawer"]',
      );
      if (drawer) drawer.scrollTop = 0;
      trigger?.focus({ preventScroll: true });
    });
  }, []);

  const resetInput = useCallback(() => {
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return undefined;
    const handleCancel = () => {
      resetInput();
      restoreDrawerPositionAndFocus();
    };
    input.addEventListener("cancel", handleCancel);
    return () => input.removeEventListener("cancel", handleCancel);
  }, [resetInput, restoreDrawerPositionAndFocus]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-controls={inputId}
        data-testid="crm-attachment-picker-trigger"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          onFiles(event.dataTransfer.files);
        }}
        className={`mb-4 flex w-full cursor-pointer flex-col items-center justify-center rounded-card border border-dashed px-4 py-5 text-center transition ${
          isDragging
            ? "border-brand-300 bg-brand-50 text-brand-700"
            : "border-zani-border bg-surface-muted text-zani-muted hover:border-brand-200 hover:bg-surface-card"
        }`}
      >
        <span className="grid h-10 w-10 place-items-center rounded-card bg-surface-card text-brand-600 shadow-sm">
          <Upload size={18} />
        </span>
        <span className="mt-3 text-sm font-semibold text-zani-ink">
          {t("crmCard.dropFilesTitle")}
        </span>
        <span className="mt-1 max-w-md text-xs font-semibold leading-5">
          {t("crmCard.dropFilesText")}
        </span>
      </button>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        data-testid="crm-attachment-input"
        onChange={(event) => {
          if (event.target.files?.length) onFiles(event.target.files);
          resetInput();
          restoreDrawerPositionAndFocus();
        }}
      />
    </>
  );
}
