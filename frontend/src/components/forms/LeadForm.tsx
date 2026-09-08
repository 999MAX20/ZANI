import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { z } from "zod";

import { leadsApi, type LeadCreatePayload } from "../../api/leads";
import { useI18n } from "../../lib/i18n";
import type { DuplicateClient, Id, Lead, Service, Client, TeamMember } from "../../types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { StatusNotice } from "../ui/StatusNotice";
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
  const selectableServices = services.filter(
    (service) => (service.is_active && !service.is_archived) || service.id === initial?.service,
  );
  const hasClients = clients.length > 0;
  const hasServices = selectableServices.length > 0;
  const form = useForm<Values>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
      client: initial?.client || 0,
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
    <form data-testid="lead-action-form" className="grid gap-4 rounded-card border border-zani-border bg-surface-card p-4 shadow-card sm:p-5" onSubmit={form.handleSubmit(async (values) => {
      try {
        await onSubmit({ ...values, business: businessId, source: values.source as Lead["source"], service: values.service || null, responsible_user: values.responsible_user || null });
      } catch {
        // The owning mutation renders localized, recoverable action feedback.
      }
    })}>
      {!hasClients ? (
        <StatusNotice
          tone="warning"
          title={t("leadForm.needClientTitle")}
          description={t("leadForm.needClientText")}
          action={<Link className="zani-focus-ring inline-flex rounded-control px-2 py-1 font-semibold text-zani-warning underline-offset-4 hover:underline" to="/app/clients?create=1">
            {t("clients.create")}
          </Link>}
        />
      ) : null}
      {!hasServices ? (
        <StatusNotice
          tone="info"
          title={t("leadForm.serviceLaterTitle")}
          description={t("leadForm.serviceLaterText")}
          action={<Link className="zani-focus-ring inline-flex rounded-control px-2 py-1 font-bold text-zani-info underline-offset-4 hover:underline" to="/app/business/services">
            {t("services.title")}
          </Link>}
        />
      ) : null}
      <Select
        label={t("appointment.client")}
        error={form.formState.errors.client?.message}
        options={[{ value: 0, label: t("appointment.selectClient") }, ...clients.map((client) => ({ value: client.id, label: `${client.full_name} ${client.phone || ""}` }))]}
        {...form.register("client")}
      />
      {duplicates.length || relatedLeadsCount ? (
        <StatusNotice
          tone="warning"
          title={t("leadForm.relatedTitle")}
          description={(
            <p>
            {relatedLeadsCount ? `${t("leadForm.relatedCount").replace("{count}", String(relatedLeadsCount))} ` : ""}
            {t("leadForm.relatedText")}
            </p>
          )}
          details={<div className="flex flex-wrap gap-2">
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
          </div>}
        />
      ) : null}
      <Select label={t("appointment.service")} options={[{ value: "", label: t("leadForm.noService") }, ...selectableServices.map((service) => ({ value: service.id, label: service.name }))]} {...form.register("service")} />
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
      <Button data-testid="lead-action-submit" type="submit" isLoading={form.formState.isSubmitting} disabled={!hasClients}>{duplicates.length || relatedLeadsCount ? t("clients.createAnyway") : t("clients.save")}</Button>
    </form>
  );
}
