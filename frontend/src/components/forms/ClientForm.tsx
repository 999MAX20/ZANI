import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { clientsApi } from "../../api/clients";
import { useI18n } from "../../lib/i18n";
import type { Client, DuplicateClient, Id } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";

function createSchema(t: (key: string) => string) {
  return z.object({
    full_name: z.string().min(2, t("validation.name")),
    phone: z.string().optional(),
    email: z.string().email(t("validation.email")).or(z.literal("")),
    source: z.string(),
    source_detail: z.string().optional(),
    notes: z.string().optional(),
  });
}

type Values = z.infer<ReturnType<typeof createSchema>>;

export function ClientForm({
  businessId,
  initial,
  onSubmit,
  onOpenClient,
  onMergeDuplicate,
}: {
  businessId: Id;
  initial?: Client;
  onSubmit: (payload: Partial<Client>) => Promise<unknown>;
  onOpenClient?: (id: Id) => void;
  onMergeDuplicate?: (duplicateId: Id) => Promise<unknown>;
}) {
  const { t } = useI18n();
  const [duplicates, setDuplicates] = useState<DuplicateClient[]>([]);
  const [duplicateError, setDuplicateError] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
      full_name: initial?.full_name || "",
      phone: initial?.phone || "",
      email: initial?.email || "",
      source: initial?.source || "manual",
      source_detail: initial?.source_detail || "",
      notes: initial?.notes || "",
    },
  });
  const phone = form.watch("phone");
  const email = form.watch("email");

  useEffect(() => {
    const hasContact = Boolean(phone?.trim() || email?.trim());
    if (!hasContact) {
      setDuplicates([]);
      return;
    }
    const timeout = window.setTimeout(() => {
      clientsApi
        .checkDuplicates({
          business: businessId,
          phone,
          email,
          exclude_client_id: initial?.id,
        })
        .then((result) => {
          setDuplicates(result.duplicates);
          setDuplicateError("");
        })
        .catch(() => setDuplicateError(t("clients.duplicateError")));
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [businessId, email, initial?.id, phone, t]);

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => onSubmit({ ...values, business: businessId } as Partial<Client>))}
    >
      <Input label={t("clients.name")} error={form.formState.errors.full_name?.message} {...form.register("full_name")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("clients.phone")} {...form.register("phone")} />
        <Input label={t("common.email")} error={form.formState.errors.email?.message} {...form.register("email")} />
      </div>
      {duplicates.length ? (
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-black">{t("clients.duplicateTitle")}</p>
          <p className="mt-1 text-amber-800">{t("clients.duplicateText")}</p>
          <div className="mt-3 space-y-2">
            {duplicates.slice(0, 3).map((client) => (
              <div key={client.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-white p-3">
                <span className="font-semibold">{client.full_name} · {client.phone || client.email || t("clients.noContact")}</span>
                {onOpenClient ? (
                  <Button type="button" variant="secondary" className="h-9 rounded-xl px-3 text-xs" onClick={() => onOpenClient(client.id)}>
                    {t("clients.openExisting")}
                  </Button>
                ) : null}
                {initial && onMergeDuplicate ? (
                  <Button type="button" variant="ghost" className="h-9 rounded-xl px-3 text-xs" onClick={() => onMergeDuplicate(client.id)}>
                    {t("clients.mergeCurrent")}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {duplicateError ? <div className="rounded-control bg-slate-50 p-3 text-sm text-slate-500">{duplicateError}</div> : null}
      <Select
        label={t("appointment.source")}
        options={[
          { value: "manual", label: t("clients.sourceManual") },
          { value: "website", label: t("clients.sourceWebsite") },
          { value: "telegram", label: "Telegram" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "instagram", label: "Instagram" },
          { value: "parser", label: t("clients.sourceParser") },
          { value: "other", label: t("clients.sourceOther") },
        ]}
        {...form.register("source")}
      />
      <Input label={t("clients.sourceDetail")} {...form.register("source_detail")} />
      <Textarea label={t("clients.notes")} {...form.register("notes")} />
      <Button type="submit" isLoading={form.formState.isSubmitting}>{duplicates.length && !initial ? t("clients.createAnyway") : t("clients.save")}</Button>
    </form>
  );
}
