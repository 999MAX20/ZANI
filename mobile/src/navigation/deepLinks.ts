export type MobileDeepLinkTarget =
  | { tab: "home" }
  | { tab: "actions" }
  | { tab: "inbox"; id?: number }
  | { tab: "leads"; id?: number }
  | { tab: "clients"; id?: number }
  | { tab: "tasks"; id?: number }
  | { tab: "calendar"; id?: number }
  | { tab: "alerts"; id?: number };

export const mobileDeepLinkPrefixes = ["zani://", "https://app.zani.kz/mobile"];

export function parseZaniDeepLink(url: string): MobileDeepLinkTarget {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { tab: "home" };
  }
  const pathParts = [parsed.hostname, ...parsed.pathname.split("/")].filter(Boolean);
  const section = pathParts[0] || "home";
  const id = Number(pathParts[1] || parsed.searchParams.get("id") || "");
  const entityId = Number.isFinite(id) && id > 0 ? id : undefined;
  if (section === "actions") return { tab: "actions" };
  if (section === "inbox") return { tab: "inbox", id: entityId };
  if (section === "leads") return { tab: "leads", id: entityId };
  if (section === "clients") return { tab: "clients", id: entityId };
  if (section === "tasks") return { tab: "tasks", id: entityId };
  if (section === "calendar" || section === "appointments") return { tab: "calendar", id: entityId };
  if (section === "alerts" || section === "notifications") return { tab: "alerts", id: entityId };
  return { tab: "home" };
}
