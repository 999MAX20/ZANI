import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router";

import type { Bot } from "../../types";
import { canonicalSection } from "./aiAgentsUtils";

function isAiAgentsRoute(pathname: string) {
  return (
    pathname === "/app/ai-agents"
    || pathname.startsWith("/app/ai-agents/")
    || pathname === "/ai-agents"
  );
}

export function useCanonicalAIAgentRoute({
  bots,
  hasBusiness,
  isPageLoading,
}: {
  bots: Bot[];
  hasBusiness: boolean;
  isPageLoading: boolean;
}) {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedBotId = params.id ? Number(params.id) : null;
  const activeSection = canonicalSection(params.section);
  const hasInvalidSection = Boolean(params.section && params.section !== activeSection);
  const matchedBot = selectedBotId ? bots.find((bot) => bot.id === selectedBotId) || null : null;
  const selectedBot = matchedBot || bots[0] || null;
  const needsCanonicalRoute = Boolean(
    !isPageLoading
    && hasBusiness
    && bots.length
    && selectedBot
    && (!params.id || !matchedBot || !params.section || hasInvalidSection),
  );
  const canonicalRoute = needsCanonicalRoute && selectedBot
    ? `/app/ai-agents/${selectedBot.id}/${activeSection}`
    : null;

  useEffect(() => {
    if (!canonicalRoute) return;

    const sourcePathname = location.pathname;
    if (!isAiAgentsRoute(sourcePathname)) return;

    let cancelled = false;
    const applyCanonicalRoute = () => {
      if (
        cancelled
        || window.location.pathname !== sourcePathname
        || !isAiAgentsRoute(window.location.pathname)
      ) {
        return;
      }
      navigate(canonicalRoute, { replace: true });
    };

    queueMicrotask(applyCanonicalRoute);
    return () => {
      cancelled = true;
    };
  }, [canonicalRoute, location.key, location.pathname, navigate]);

  return { activeSection, canonicalRoute, selectedBot };
}
