import { useEffect } from "react";

import type { Lead } from "../../../types";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function useLeadKeyboardShortcuts({
  rows,
  selected,
  onOpenLead,
  onCallLead,
  onWhatsAppLead,
  onCreateLead,
  onCloseOverlays,
  onOpenShortcuts,
}: {
  rows: Lead[];
  selected: Lead | null;
  onOpenLead: (lead: Lead) => void;
  onCallLead: (lead: Lead) => void;
  onWhatsAppLead: (lead: Lead) => void;
  onCreateLead: () => void;
  onCloseOverlays: () => void;
  onOpenShortcuts: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const editable = isEditableTarget(event.target);
      if (editable && event.key !== "Escape") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "?") {
        event.preventDefault();
        onOpenShortcuts();
        return;
      }

      if (event.key === "Escape") {
        onCloseOverlays();
        return;
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        onCreateLead();
        return;
      }

      if (!selected && !rows.length) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const currentIndex = selected ? rows.findIndex((lead) => lead.id === selected.id) : -1;
        const nextIndex = event.key === "ArrowDown" ? Math.min(rows.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
        const nextLead = rows[nextIndex] || rows[0];
        if (nextLead) onOpenLead(nextLead);
        return;
      }

      if (event.key === "Enter" && selected) {
        event.preventDefault();
        onOpenLead(selected);
        return;
      }

      if (event.key.toLowerCase() === "c" && selected) {
        event.preventDefault();
        onCallLead(selected);
        return;
      }

      if (event.key.toLowerCase() === "w" && selected) {
        event.preventDefault();
        onWhatsAppLead(selected);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCallLead, onCloseOverlays, onCreateLead, onOpenLead, onOpenShortcuts, onWhatsAppLead, rows, selected]);
}
