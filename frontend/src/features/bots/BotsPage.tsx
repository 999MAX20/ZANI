import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot as BotIcon, MessageSquareText, Plus, Radio, Settings2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { botsApi } from "../../api/bots";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import type { Bot } from "../../types";

export function BotsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { bots, botChannels, botConversations } = useEntityData({ bots: true, botChannels: true, botConversations: true });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", status: "draft", default_language: "ru" });

  const mutation = useMutation({
    mutationFn: (payload: Partial<Bot>) => botsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      setOpen(false);
      setForm({ name: "", status: "draft", default_language: "ru" });
    },
  });

  const statusOptions = [
    { value: "draft", label: t("status.draft") },
    { value: "active", label: t("status.active") },
    { value: "paused", label: t("status.paused") },
  ];
  const languageOptions = [
    { value: "ru", label: t("language.ru") },
    { value: "kk", label: t("language.kk") },
    { value: "en", label: t("language.en") },
  ];

  if (!business) return <ErrorState message={t("bots.noBusiness")} />;
  if (bots.isLoading || botChannels.isLoading || botConversations.isLoading) return <LoadingState />;

  const botList = bots.data || [];

  return (
    <>
      <PageHeader
        title={t("bots.title")}
        description={t("bots.description")}
        actions={<Button variant="ai" onClick={() => setOpen(true)}><Plus size={18} />{t("bots.create")}</Button>}
      />
      {mutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutation.error)} /></div> : null}

      {!botList.length ? (
        <EmptyState
          title={t("bots.emptyTitle")}
          description={t("bots.emptyText")}
          action={<Button variant="secondary" onClick={() => setOpen(true)}><Plus size={16} />{t("bots.create")}</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {botList.map((bot) => {
            const channels = (botChannels.data || []).filter((channel) => channel.bot === bot.id);
            const conversations = (botConversations.data || []).filter((conversation) => conversation.bot === bot.id);
            return (
              <Card key={bot.id} className="overflow-hidden">
                <CardBody>
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow">
                        <BotIcon size={22} />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-midnight">{bot.name}</h2>
                        <p className="text-sm text-slate-500">{t("bots.defaultLanguage")}: {bot.default_language.toUpperCase()}</p>
                      </div>
                    </div>
                    <StatusBadge status={bot.status} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-100 bg-white/70 p-3">
                      <Radio className="mb-2 text-brand-600" size={18} />
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("bots.channels")}</p>
                      <p className="mt-1 text-xl font-bold text-midnight">{channels.length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white/70 p-3">
                      <MessageSquareText className="mb-2 text-ai-600" size={18} />
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("bots.dialogs")}</p>
                      <p className="mt-1 text-xl font-bold text-midnight">{conversations.length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white/70 p-3">
                      <Settings2 className="mb-2 text-slate-600" size={18} />
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("bots.mode")}</p>
                      <p className="mt-1 text-xl font-bold text-midnight">{t("bots.manual")}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link to={`/dashboard/bots/${bot.id}`}>
                      <Button variant="secondary">{t("common.open")}</Button>
                    </Link>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Modal title={t("bots.create")} open={open} onClose={() => setOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate({
              business: business.id,
              name: form.name,
              status: form.status as Bot["status"],
              default_language: form.default_language,
              settings_json: {},
            });
          }}
        >
          <Input label={t("bots.name")} placeholder={t("bots.websiteAssistantPlaceholder")} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <Select label={t("bots.status")} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} options={statusOptions} />
          <Select label={t("bots.defaultLanguage")} value={form.default_language} onChange={(event) => setForm({ ...form, default_language: event.target.value })} options={languageOptions} />
          <Button type="submit" isLoading={mutation.isPending}>{t("common.save")}</Button>
        </form>
      </Modal>
    </>
  );
}
