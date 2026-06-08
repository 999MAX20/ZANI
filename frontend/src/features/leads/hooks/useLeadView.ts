import { useState } from "react";

import type { LeadViewMode } from "../types";
import { leadViewModes } from "../types";

export function useLeadView(initialMode?: LeadViewMode | string | null) {
  const [mode, setMode] = useState<LeadViewMode>(() => {
    return initialMode && leadViewModes.includes(initialMode as LeadViewMode) ? (initialMode as LeadViewMode) : "table";
  });

  return { mode, setMode };
}
