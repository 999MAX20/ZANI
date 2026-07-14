import { useEffect } from "react";
import { Plus } from "lucide-react";

import { usePageHeader } from "../../../components/layout/PageHeaderContext";
import type { Translate } from "../types";

export function useClientsPageHeader({
  t,
  onCreateClient,
  onCloseClientCard,
}: {
  t: Translate;
  onCreateClient: () => void;
  onCloseClientCard: () => void;
}) {
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader({
      title: t("clients.title"),
      primaryAction: {
        label: t("clients.create"),
        icon: Plus,
        onClick: onCreateClient,
      },
    });
    return () => setPageHeader(null);
  }, [onCreateClient, setPageHeader, t]);

  useEffect(() => {
    function handleHotkeys(event: KeyboardEvent) {
      const isCommand = event.metaKey || event.ctrlKey;
      if (isCommand && event.key.toLowerCase() === "n") {
        event.preventDefault();
        onCreateClient();
      }
      if (event.key === "Escape") onCloseClientCard();
    }

    window.addEventListener("keydown", handleHotkeys);
    return () => window.removeEventListener("keydown", handleHotkeys);
  }, [onCloseClientCard, onCreateClient]);
}
