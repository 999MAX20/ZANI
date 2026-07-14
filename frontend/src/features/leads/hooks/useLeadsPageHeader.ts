import { useEffect } from "react";
import { Plus, SlidersHorizontal } from "lucide-react";

import type { Translate } from "../types";
import { usePageHeader } from "../../../components/layout/PageHeaderContext";

export function useLeadsPageHeader({
  t,
  onCreateLead,
  onToggleFilters,
}: {
  t: Translate;
  onCreateLead: () => void;
  onToggleFilters: () => void;
}) {
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader({
      title: t("nav.leads"),
      secondaryActions: [
        {
          label: t("leads.filters"),
          icon: SlidersHorizontal,
          onClick: onToggleFilters,
        },
      ],
      primaryAction: {
        label: t("leads.create"),
        icon: Plus,
        onClick: onCreateLead,
      },
    });
    return () => setPageHeader(null);
  }, [onCreateLead, onToggleFilters, setPageHeader, t]);
}
