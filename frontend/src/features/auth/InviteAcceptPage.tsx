import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { getApiErrorMessage } from "../../api/client";
import { teamApi } from "../../api/team";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";

type FormValues = {
  full_name?: string;
  phone?: string;
  password: string;
};

export function InviteAcceptPage() {
  const navigate = useNavigate();
  const { token = "" } = useParams();
  const { t } = useI18n();
  const schema = z.object({
    full_name: z.string().optional(),
    phone: z.string().optional(),
    password: z.string().min(8, t("validation.passwordMin")),
  });
  const preview = useQuery({
    queryKey: ["team-invitation-preview", token],
    queryFn: () => teamApi.previewInvitation(token),
    enabled: Boolean(token),
    retry: false,
  });
  const acceptMutation = useMutation({
    mutationFn: (values: FormValues) => teamApi.acceptInvitation({ token, ...values }),
    onSuccess: () => navigate("/login"),
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: { full_name: preview.data?.full_name || "", phone: "", password: "" },
  });

  if (preview.isLoading) return <LoadingState label={t("invite.checking")} />;

  return (
    <main className="min-h-screen bg-soft-mesh px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
        <div className="glass-panel w-full rounded-[2rem] p-6 sm:p-8">
          <div className="mb-6 grid h-14 w-14 place-items-center rounded-3xl bg-ai-gradient text-white shadow-glow">
            <KeyRound size={24} />
          </div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-brand-700">{t("invite.eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-black text-midnight">{preview.data?.business_name || "Zani"}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {t("invite.description")}
          </p>

          {preview.error ? <div className="mt-5"><ErrorState message={getApiErrorMessage(preview.error)} /></div> : null}
          {preview.data?.status && preview.data.status !== "pending" ? (
            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
              {t("invite.inactive", { status: preview.data.status })}
            </div>
          ) : null}
          {acceptMutation.error ? <div className="mt-5"><ErrorState message={getApiErrorMessage(acceptMutation.error)} /></div> : null}

          <form className="mt-6 space-y-4" onSubmit={form.handleSubmit((values) => acceptMutation.mutate(values))}>
            <Input label={t("invite.email")} value={preview.data?.email || ""} readOnly />
            <Input label={t("invite.name")} {...form.register("full_name")} placeholder={t("invite.namePlaceholder")} />
            <Input label={t("invite.phone")} {...form.register("phone")} placeholder={t("invite.phonePlaceholder")} />
            <Input label={t("invite.newPassword")} type="password" error={form.formState.errors.password?.message} {...form.register("password")} />
            <Button className="w-full" variant="ai" type="submit" isLoading={acceptMutation.isPending} disabled={preview.data?.status !== "pending"}>
              <CheckCircle2 size={18} />
              {t("invite.accept")}
              <ArrowRight size={18} />
            </Button>
          </form>
          <Link to="/login" className="mt-4 block text-center text-sm font-bold text-brand-700">
            {t("invite.login")}
          </Link>
        </div>
      </section>
    </main>
  );
}
