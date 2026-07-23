import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useI18n } from "../../lib/i18n";
import type { Id, Resource, TeamMember } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const createSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(2, t("resources.nameRequired")),
    resource_type: z.string(),
    linked_user: z.string(),
    is_active: z.boolean(),
  });

type Values = z.infer<ReturnType<typeof createSchema>>;

export function ResourceForm({
  businessId,
  initial,
  teamMembers = [],
  onSubmit,
}: {
  businessId: Id;
  initial?: Partial<Resource>;
  teamMembers?: TeamMember[];
  onSubmit: (payload: Partial<Resource>) => Promise<unknown>;
}) {
  const { t } = useI18n();
  const activeTeamMembers = teamMembers.filter((member) => member.is_active);
  const form = useForm<Values>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
      name: initial?.name || "",
      resource_type: initial?.resource_type || "staff",
      linked_user: initial?.linked_user ? String(initial.linked_user) : "",
      is_active: initial?.is_active ?? true,
    },
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) =>
        onSubmit({
          business: businessId,
          name: values.name,
          resource_type: values.resource_type as Resource["resource_type"],
          linked_user: values.linked_user ? Number(values.linked_user) : null,
          is_active: values.is_active,
        }),
      )}
    >
      <div className="rounded-card border border-brand-100 bg-brand-50 p-4 text-sm text-zani-subtle">
        <p className="font-semibold text-zani-ink">{t("resources.formHintTitle")}</p>
        <p className="mt-1 leading-6">
          {t("resources.formHintText")}
        </p>
      </div>
      <Input label={t("resources.name")} placeholder={t("resources.namePlaceholder")} error={form.formState.errors.name?.message} {...form.register("name")} />
      <Select
        label={t("resources.type")}
        options={[
          { value: "staff", label: t("resources.typeStaff") },
          { value: "room", label: t("resources.typeRoom") },
          { value: "hall", label: t("resources.typeHall") },
          { value: "box", label: t("resources.typeBox") },
          { value: "equipment", label: t("resources.typeEquipment") },
          { value: "other", label: t("resources.typeOther") },
        ]}
        {...form.register("resource_type")}
      />
      <Select
        label={t("resources.linkedUser")}
        options={[
          { value: "", label: t("resources.noLinkedUser") },
          ...activeTeamMembers.map((member) => ({
            value: String(member.user.id),
            label: member.user.full_name || member.user.email,
          })),
        ]}
        {...form.register("linked_user")}
      />
      <label className="flex items-center gap-2 text-sm font-semibold text-zani-subtle">
        <input type="checkbox" className="h-4 w-4 rounded border-zani-border accent-brand-500" {...form.register("is_active")} />
        {t("resources.available")}
      </label>
      <Button type="submit" isLoading={form.formState.isSubmitting}>{t("resources.save")}</Button>
    </form>
  );
}
