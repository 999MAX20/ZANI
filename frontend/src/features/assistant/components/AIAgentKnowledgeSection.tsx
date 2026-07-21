import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Save, Settings } from "lucide-react";

import { businessKnowledgeApi } from "../../../api/ai";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { cn } from "../../../lib/cn";
import { useI18n } from "../../../lib/i18n";
import type { BusinessKnowledgeItem, Id } from "../../../types";
import { FieldHint, HelpCard } from "./AIAgentsShared";
export function KnowledgeSection({ businessId, items, canManage }: { businessId: Id; items: BusinessKnowledgeItem[]; canManage: boolean }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessKnowledgeItem | null>(null);
  const [draft, setDraft] = useState({ title: "", category: "business", content: "", is_active: true });
  const saveKnowledge = useMutation({
    mutationFn: () => {
      const payload = { ...draft, business: businessId };
      return editing ? businessKnowledgeApi.update({ id: editing.id, payload }) : businessKnowledgeApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-items"] });
      setOpen(false);
      setEditing(null);
      setDraft({ title: "", category: "business", content: "", is_active: true });
    },
  });

  const openEditor = (item?: BusinessKnowledgeItem) => {
    if (item) {
      setEditing(item);
      setDraft({ title: item.title, category: item.category || "business", content: item.content, is_active: item.is_active });
    } else {
      setEditing(null);
      setDraft({ title: "", category: "business", content: "", is_active: true });
    }
    setOpen(true);
  };

  const knowledgeTemplates = [
    { title: t("aiAgents.knowledge.template.prices"), category: "sales", content: t("aiAgents.knowledge.template.pricesContent") },
    { title: t("aiAgents.knowledge.template.schedule"), category: "business", content: t("aiAgents.knowledge.template.scheduleContent") },
    { title: t("aiAgents.knowledge.template.booking"), category: "policy", content: t("aiAgents.knowledge.template.bookingContent") },
    { title: t("aiAgents.knowledge.template.faq"), category: "faq", content: t("aiAgents.knowledge.template.faqContent") },
  ];

  const openTemplate = (template: { title: string; category: string; content: string }) => {
    setEditing(null);
    setDraft({ ...template, is_active: true });
    setOpen(true);
  };

  return (
    <>
      <div className="space-y-4">
        <HelpCard
          title={t("aiAgents.onboarding.knowledge.helpTitle")}
          text={t("aiAgents.onboarding.knowledge.helpText")}
          recommendation={t("aiAgents.onboarding.knowledge.recommendation")}
        />
        <div className="rounded-card border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-black text-midnight">{t("aiAgents.knowledgeCompany")}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">{t("aiAgents.knowledgeCompanyText")}</p>
            </div>
            <Button type="button" disabled={!canManage} onClick={() => openEditor()}>
              <Plus size={16} /> {t("aiAgents.knowledge.add")}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {items.length ? items.map((item) => (
            <Card key={item.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">{item.category || t("aiAgents.knowledge.category")}</p>
                    <h3 className="mt-2 text-lg font-black text-midnight">{item.title}</h3>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-black", item.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                    {item.is_active ? t("aiAgents.knowledge.active") : t("aiAgents.knowledge.off")}
                  </span>
                </div>
                <p className="mt-3 line-clamp-4 text-sm font-semibold leading-6 text-slate-500">{item.content}</p>
                <Button className="mt-4" type="button" variant="secondary" disabled={!canManage} onClick={() => openEditor(item)}>
                  <Settings size={16} /> {t("aiAgents.configure")}
                </Button>
              </CardBody>
            </Card>
          )) : (
            <Card className="md:col-span-2">
              <CardBody>
                <BookOpen className="text-brand-600" size={26} />
                <h3 className="mt-4 text-lg font-black text-midnight">{t("aiAgents.knowledge.emptyTitle")}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{t("aiAgents.knowledge.emptyText")}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {knowledgeTemplates.map((template) => (
                    <button
                      key={template.title}
                      type="button"
                      disabled={!canManage}
                      className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-200 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => openTemplate(template)}
                    >
                      <span className="text-sm font-black text-midnight">{template.title}</span>
                      <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{template.category}</span>
                    </button>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Modal title={editing ? t("aiAgents.knowledge.editTitle") : t("aiAgents.knowledge.newTitle")} open={open} onClose={() => setOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            saveKnowledge.mutate();
          }}
        >
          <Input label={t("aiAgents.knowledge.title")} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
          <FieldHint>{t("aiAgents.hint.knowledgeTitle")}</FieldHint>
          <Input label={t("aiAgents.knowledge.category")} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} />
          <FieldHint>{t("aiAgents.hint.knowledgeCategory")}</FieldHint>
          <Textarea label={t("aiAgents.knowledge.content")} value={draft.content} onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} />
          <FieldHint>{t("aiAgents.hint.knowledgeContent")}</FieldHint>
          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-600">
            <input type="checkbox" checked={draft.is_active} onChange={(event) => setDraft((current) => ({ ...current, is_active: event.target.checked }))} />
            {t("aiAgents.knowledge.useInContext")}
          </label>
          <FieldHint>{t("aiAgents.hint.knowledgeActive")}</FieldHint>
          <Button type="submit" disabled={!canManage || !draft.title.trim() || !draft.content.trim()} isLoading={saveKnowledge.isPending}>
            <Save size={16} /> {t("common.save")}
          </Button>
        </form>
      </Modal>
    </>
  );
}
