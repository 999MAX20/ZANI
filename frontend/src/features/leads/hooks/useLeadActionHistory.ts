import { useCallback, useState } from "react";

import { useUndoToast } from "../../../components/actions/UndoToastProvider";
import type { ActionHistoryItem, Translate, UndoToast } from "../types";

export function useLeadActionHistory({
  t,
  onNotice,
}: {
  t: Translate;
  onNotice: (message: string | null, tone?: "success" | "info" | "warning" | "danger") => void;
}) {
  const showUndoToast = useUndoToast();
  const [, setUndoStack] = useState<ActionHistoryItem[]>([]);
  const [, setRedoStack] = useState<ActionHistoryItem[]>([]);

  const pushHistory = useCallback((item: UndoToast) => {
    const nextItem = { ...item, id: String(Date.now()) };
    setUndoStack((value) => [nextItem, ...value].slice(0, 20));
    setRedoStack([]);
    showUndoToast({
      message: item.message,
      undoLabel: t("leads.undo"),
      durationMs: 5_000,
      onUndo: async () => {
        await nextItem.undo();
        setUndoStack((value) => value.filter((historyItem) => historyItem.id !== nextItem.id));
        setRedoStack((value) => [nextItem, ...value].slice(0, 20));
        onNotice(t("leads.actionUndone"));
      },
    });
  }, [onNotice, showUndoToast, t]);

  return { pushHistory };
}
