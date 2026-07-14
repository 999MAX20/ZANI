import writeXlsxFile from "write-excel-file/browser";

import { formatDateTime } from "../../../lib/format";
import type { Client, Lead, Service, TeamMember } from "../../../types";
import type { Translate } from "../types";
import { getClient, getService, getSourceLabel, getStatusLabel, nextAction } from "./leadFormat";

export function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function toCsvValue(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function getLeadExportRows({
  rows,
  clients,
  services,
  teamMembers,
  t,
}: {
  rows: Lead[];
  clients: Client[];
  services: Service[];
  teamMembers: TeamMember[];
  t: Translate;
}) {
  const headers = [t("leads.tableLead"), t("leads.tablePhone"), t("leads.source"), t("leads.tableStatus"), t("leads.priority"), t("leads.responsible"), t("leads.lastActivity"), t("leads.nextStep")];
  const data = rows.map((lead) => {
    const client = getClient(lead, clients);
    const service = getService(lead, services);
    const responsible = teamMembers.find((member) => member.user.id === lead.responsible_user);
    return {
      [headers[0]]: client?.full_name || t("leads.leadFallback", { id: lead.id }),
      [headers[1]]: client?.phone || "",
      [headers[2]]: getSourceLabel(lead.source, t),
      [headers[3]]: getStatusLabel(lead.status, t),
      [headers[4]]: lead.status === "new" && !lead.responsible_user ? t("leads.priorityHot") : t("leads.priorityNormal"),
      [headers[5]]: responsible?.user.full_name || responsible?.user.email || t("leads.withoutManager"),
      [headers[6]]: formatDateTime(lead.updated_at),
      [headers[7]]: nextAction(lead, t),
    };
  });
  return { headers, data };
}

export async function exportLeadRows({
  kind,
  rows,
  clients,
  services,
  teamMembers,
  t,
}: {
  kind: "csv" | "excel";
  rows: Lead[];
  clients: Client[];
  services: Service[];
  teamMembers: TeamMember[];
  t: Translate;
}) {
  const { headers, data } = getLeadExportRows({ rows, clients, services, teamMembers, t });
  if (kind === "excel") {
    await writeXlsxFile(
      [
        headers.map((header) => ({ value: header, fontWeight: "bold" as const })),
        ...data.map((row) => headers.map((header) => ({ value: String(row[header] ?? "") }))),
      ],
      { sheet: t("nav.leads").slice(0, 31), columns: headers.map(() => ({ width: 24 })) },
    ).toFile("zani-leads.xlsx");
    return;
  }
  const lines = data.map((row) => headers.map((header) => toCsvValue(row[header])).join(","));
  downloadText("zani-leads.csv", [headers.map(toCsvValue).join(","), ...lines].join("\n"), "text/csv;charset=utf-8");
}
