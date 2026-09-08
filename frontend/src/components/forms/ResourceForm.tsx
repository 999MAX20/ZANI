import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
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
  formId,
  showSubmit = true,
  showContextHint = !initial?.id,
  disabled = false,
  onDirtyChange,
}: {
  businessId: Id;
  initial?: Partial<Resource>;
  teamMembers?: TeamMember[];
  onSubmit: (payload: Partial<Resource>) => Promise<unknown>;
  formId?: string;
  showSubmit?: boolean;
  showContextHint?: boolean;
  disabled?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}) {
  const { t } = useI18n();
  const activeTeamMembers = teamMembers.filter((member) => member.is_active);
  const currentLinkedUserOption = initial?.linked_user
    && !activeTeamMembers.some((member) => String(member.user.id) === String(initial.linked_user))
    ? {
        value: String(initial.linked_user),
        label: initial.linked_user_name || initial.linked_user_email || String(initial.linked_user),
      }
    : null;
  const form = useForm<Values>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
      name: initial?.name || "",
      resource_type: initial?.resource_type || "staff",
      linked_user: initial?.linked_user ? String(initial.linked_user) : "",
      is_active: initial?.is_active ?? true,
    },
  });
  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  return (
    <form
      id={formId}
      className="grid gap-4"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit({
          business: businessId,
          name: values.name,
          resource_type: values.resource_type as Resource["resource_type"],
          linked_user: values.linked_user ? Number(values.linked_user) : null,
          is_active: values.is_active,
        });
        form.reset(values);
      })}
    >
      {showContextHint ? (
        <div className="rounded-card border border-brand-100 bg-brand-50 p-4 text-sm text-zani-subtle">
          <p className="font-semibold text-zani-ink">{t("resources.formHintTitle")}</p>
          <p className="mt-1 leading-6">
            {t("resources.formHintText")}
          </p>
        </div>
      ) : null}
      <Input disabled={disabled} label={t("resources.name")} placeholder={t("resources.namePlaceholder")} error={form.formState.errors.name?.message} {...form.register("name")} />
      <Controller
        control={form.control}
        name="resource_type"
        render={({ field }) => (
          <Select
            {...field}
            disabled={disabled}
            label={t("resources.type")}
            options={[
              { value: "staff", label: t("resources.typeStaff") },
              { value: "room", label: t("resources.typeRoom") },
              { value: "hall", label: t("resources.typeHall") },
              { value: "box", label: t("resources.typeBox") },
              { value: "equipment", label: t("resources.typeEquipment") },
              { value: "other", label: t("resources.typeOther") },
            ]}
          />
        )}
      />
      <Controller
        control={form.control}
        name="linked_user"
        render={({ field }) => (
          <Select
            {...field}
            disabled={disabled}
            label={t("resources.linkedUser")}
            options={[
              { value: "", label: t("resources.noLinkedUser") },
              ...(currentLinkedUserOption ? [currentLinkedUserOption] : []),
              ...activeTeamMembers.map((member) => ({
                value: String(member.user.id),
                label: member.user.full_name || member.user.email,
              })),
            ]}
          />
        )}
      />
      <label className="flex items-center gap-2 text-sm font-semibold text-zani-subtle">
        <input disabled={disabled} type="checkbox" className="h-4 w-4 rounded border-zani-border accent-brand-500 disabled:cursor-not-allowed disabled:opacity-60" {...form.register("is_active")} />
        {t("resources.available")}
      </label>
      {showSubmit ? <Button type="submit" disabled={disabled} isLoading={form.formState.isSubmitting}>{t("resources.save")}</Button> : null}
    </form>
  );
}
