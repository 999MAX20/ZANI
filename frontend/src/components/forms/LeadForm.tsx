import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

import { leadsApi, type LeadCreatePayload } from "../../api/leads";
import { useI18n } from "../../lib/i18n";
import type { DuplicateClient, Id, Lead, Service, Client, TeamMember } from "../../types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";

function createSchema(t: (key: string) => string) {
  return z.object({
    client: z.coerce.number().min(1, t("leadForm.selectClientError")),
    service: z.coerce.number().optional(),
    source: z.string(),
    message: z.string().optional(),
    responsible_user: z.coerce.number().optional(),
  });
}

type Values = z.infer<ReturnType<typeof createSchema>>;

export function LeadForm({
  businessId,
  clients,
  services,
  teamMembers = [],
  initial,
  onSubmit,
  onOpenClient,
}: {
  businessId: Id;
  clients: Client[];
  services: Service[];
  teamMembers?: TeamMember[];
  initial?: Lead;
  onSubmit: (payload: LeadCreatePayload) => Promise<unknown>;
  onOpenClient?: (id: Id) => void;
}) {
  const { t } = useI18n();
  const [duplicates, setDuplicates] = useState<DuplicateClient[]>([]);
  const [relatedLeadsCount, setRelatedLeadsCount] = useState(0);
  const hasClients = clients.length > 0;
  const hasServices = services.length > 0;
  const form = useForm<Values>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
      client: initial?.client || clients[0]?.id || 0,
      service: initial?.service || undefined,
      source: initial?.source || "manual",
      message: initial?.message || "",
      responsible_user: initial?.responsible_user || undefined,
    },
  });
  const clientId = form.watch("client");

  useEffect(() => {
    if (!clientId) {
      setDuplicates([]);
      setRelatedLeadsCount(0);
      return;
    }
    const timeout = window.setTimeout(() => {
      leadsApi
        .checkDuplicates({ business: businessId, client: Number(clientId) })
        .then((result) => {
          setDuplicates(result.duplicates);
          setRelatedLeadsCount(result.related_leads.filter((lead) => lead.id !== initial?.id).length);
        })
        .catch(() => {
          setDuplicates([]);
          setRelatedLeadsCount(0);
        });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [businessId, clientId, initial?.id]);

  return (
    <form className="grid gap-4 rounded-card border border-slate-200 bg-white p-4 shadow-card sm:p-5" onSubmit={form.handleSubmit((values) => onSubmit({ ...values, business: businessId, source: values.source as Lead["source"], service: values.service || null, responsible_user: values.responsible_user || null }))}>
      {!hasClients ? (
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">{t("leadForm.needClientTitle")}</p>
          <p className="mt-1 leading-6 text-amber-800">{t("leadForm.needClientText")}</p>
          <Link className="mt-3 inline-flex font-bold text-amber-950 underline-offset-4 hover:underline" to="/app/clients?create=1">
            {t("clients.create")}
          </Link>
        </div>
      ) : null}
      {!hasServices ? (
        <div className="rounded-card border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-bold text-midnight">{t("leadForm.serviceLaterTitle")}</p>
          <p className="mt-1 leading-6">{t("leadForm.serviceLaterText")}</p>
          <Link className="mt-3 inline-flex font-bold text-brand-700 underline-offset-4 hover:underline" to="/app/services">
            {t("services.title")}
          </Link>
        </div>
      ) : null}
      <Select label={t("appointment.client")} options={[{ value: 0, label: t("appointment.selectClient") }, ...clients.map((client) => ({ value: client.id, label: `${client.full_name} ${client.phone || ""}` }))]} {...form.register("client")} />
      {duplicates.length || relatedLeadsCount ? (
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-black">{t("leadForm.relatedTitle")}</p>
          <p className="mt-1 text-amber-800">
            {relatedLeadsCount ? `${t("leadForm.relatedCount").replace("{count}", String(relatedLeadsCount))} ` : ""}
            {t("leadForm.relatedText")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {duplicates.slice(0, 2).map((client) => (
              <Button key={client.id} type="button" variant="secondary" className="h-9 rounded-xl px-3 text-xs" onClick={() => onOpenClient?.(client.id)}>
                {t("clients.openExisting")}
              </Button>
            ))}
            {!duplicates.length && clientId && onOpenClient ? (
              <Button type="button" variant="secondary" className="h-9 rounded-xl px-3 text-xs" onClick={() => onOpenClient(Number(clientId))}>
                {t("clients.openExisting")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <Select label={t("appointment.service")} options={[{ value: "", label: t("leadForm.noService") }, ...services.map((service) => ({ value: service.id, label: service.name }))]} {...form.register("service")} />
      <Select label={t("appointment.source")} options={[
        { value: "manual", label: t("clients.sourceManual") },
        { value: "website", label: t("clients.sourceWebsite") },
        { value: "landing", label: t("leadForm.sourceLanding") },
        { value: "telegram", label: "Telegram" },
        { value: "whatsapp", label: "WhatsApp" },
        { value: "instagram", label: "Instagram" },
        { value: "other", label: t("clients.sourceOther") },
      ]} {...form.register("source")} />
      {teamMembers.length ? (
        <Select
          label={t("leads.responsible")}
          options={[
            { value: "", label: t("leadForm.assignLater") },
            ...teamMembers
              .filter((member) => member.is_active)
              .map((member) => ({
                value: member.user.id,
                label: member.user.full_name || member.user.email,
              })),
          ]}
          {...form.register("responsible_user")}
        />
      ) : null}
      <Textarea label={t("leadForm.message")} {...form.register("message")} />
      <Button type="submit" isLoading={form.formState.isSubmitting} disabled={!hasClients}>{duplicates.length || relatedLeadsCount ? t("clients.createAnyway") : t("clients.save")}</Button>
    </form>
  );
}
