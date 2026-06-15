import { AlertTriangle, Archive, Bot, CalendarPlus, CheckCheck, ChevronLeft, ChevronRight, CircleDollarSign, CircleDot, ClipboardList, Mail, MessageCircle, Mic, MoreHorizontal, Phone, Tag, UserCheck, XCircle } from "lucide-react";
import { useRef, useState } from "react";

import type { CrmDrawerEntity } from "../../../components/crm/CrmEntityDrawer";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { cn } from "../../../lib/cn";
import { formatDateTime } from "../../../lib/format";
import type { Client, Id, Lead, Service, Task } from "../../../types";
import { statusClass, type LeadAction, type LeadAiInsight, type Translate } from "../types";
import { fuzzyIncludes } from "../utils/leadFilters";
import { formatFileSize, getSourceLabel, getStatusLabel, initials, leadTitle, nextAction, Pill, TruncatedText } from "../utils/leadFormat";
import { SourceBadge } from "./common/SourceBadge";

export function LeadDetailPanel({
  selected,
  selectedClient,
  selectedService,
  selectedNextTask,
  selectedDeals,
  selectedAppointments,
  selectedConversations,
  aiInsight,
  clientList,
  teamList,
  priorityLead,
  actionMutation,
  mergeClientMutation,
  noteMutation,
  openLead,
  onWhatsAppTemplate,
  setAppointmentOpen,
  setLostLead,
  setLostReason,
  setNextActionOpen,
  setDrawerEntity,
  onClose,
  collapsed,
  onToggleCollapsed,
  t,
}: {
  selected: Lead;
  selectedClient?: Client;
  selectedService?: Service;
  selectedNextTask?: Task;
  selectedDeals: unknown[];
  selectedAppointments: unknown[];
  selectedConversations: unknown[];
  aiInsight: LeadAiInsight;
  clientList: Client[];
  teamList: Array<{ user: { id: Id; full_name?: string; email: string } }>;
  priorityLead: Lead | null;
  actionMutation: {
    mutate: (variables: { action: LeadAction; lead: Lead; user_id?: Id; lost_reason?: string }) => void;
    isPending: boolean;
  };
  mergeClientMutation: {
    mutate: (variables: { targetId: Id; duplicateId: Id }) => void;
    isPending: boolean;
  };
  noteMutation: {
    mutate: (variables: { lead: Lead; text: string; files: File[] }) => void;
    isPending: boolean;
  };
  openLead: (lead: Lead) => void;
  onWhatsAppTemplate: (lead: Lead, template?: string) => void;
  setAppointmentOpen: (value: boolean) => void;
  setLostLead: (lead: Lead) => void;
  setLostReason: (value: string) => void;
  setNextActionOpen: (value: boolean) => void;
  setDrawerEntity: (entity: CrmDrawerEntity | null) => void;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  t: Translate;
}) {
  const [noteDraft, setNoteDraft] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<{ stop: () => void } | null>(null);
  const templates = [
    { id: "greeting", label: t("leads.templateGreeting"), text: t("leads.templateGreetingText") },
    { id: "price", label: t("leads.templatePrice"), text: t("leads.templatePriceText") },
    { id: "booking", label: t("leads.templateBooking"), text: t("leads.templateBookingText") },
  ];
  const mentionQuery = noteDraft.match(/@([\p{L}\d._-]*)$/u)?.[1]?.toLowerCase() ?? null;
  const templateQuery = noteDraft.match(/(?:^|\s)\/([\p{L}\d_-]*)$/u)?.[1]?.toLowerCase() ?? null;
  const mentionSuggestions = mentionQuery === null ? [] : teamList
    .filter((member) => fuzzyIncludes(`${member.user.full_name || ""} ${member.user.email}`, mentionQuery))
    .slice(0, 4);
  const templateSuggestions = templateQuery === null ? [] : templates
    .filter((template) => fuzzyIncludes(`${template.label} ${template.text}`, templateQuery))
    .slice(0, 4);

  function replaceCommand(pattern: RegExp, value: string) {
    setNoteDraft((current) => current.replace(pattern, value));
  }

  function submitNote() {
    const mentions = Array.from(new Set((noteDraft.match(/@[\p{L}\d._-]+/gu) || []).map((item) => item.trim())));
    const mentionsText = mentions.length ? `\n\n${t("leads.mentions")}: ${mentions.join(", ")}` : "";
    noteMutation.mutate({ lead: selected, text: `${noteDraft.trim()}${mentionsText}`, files: attachedFiles });
    setNoteDraft("");
    setAttachedFiles([]);
  }

  async function startVoiceNote() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNoteDraft((value) => `${value}${value ? "\n" : ""}${t("leads.voiceUnsupported")}`);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) voiceChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], `lead-${selected.id}-voice-${Date.now()}.webm`, { type: blob.type });
        setAttachedFiles((value) => [...value, file].slice(0, 6));
        setNoteDraft((value) => value || t("leads.voiceNoteAttached"));
        stream.getTracks().forEach((track) => track.stop());
      };
      const SpeechRecognition =
        (window as unknown as {
          SpeechRecognition?: new () => {
            continuous: boolean;
            interimResults: boolean;
            lang: string;
            onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
            start: () => void;
            stop: () => void;
          };
          webkitSpeechRecognition?: new () => {
            continuous: boolean;
            interimResults: boolean;
            lang: string;
            onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
            start: () => void;
            stop: () => void;
          };
        }).SpeechRecognition ||
        (window as unknown as {
          webkitSpeechRecognition?: new () => {
            continuous: boolean;
            interimResults: boolean;
            lang: string;
            onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
            start: () => void;
            stop: () => void;
          };
        }).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigator.language || "ru-RU";
        recognition.onresult = (event) => {
          const text = Array.from(event.results).map((result) => result[0].transcript).join(" ").trim();
          if (text) setNoteDraft(text);
        };
        recognition.start();
        speechRecognitionRef.current = recognition;
      }
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (error) {
      setNoteDraft((value) => `${value}${value ? "\n" : ""}${t("leads.voiceUnsupported")}`);
      setRecording(false);
      speechRecognitionRef.current = null;
      mediaRecorderRef.current = null;
    }
  }

  function stopVoiceNote() {
    speechRecognitionRef.current?.stop();
    speechRecognitionRef.current = null;
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  if (collapsed) {
    return (
      <div className="flex h-full w-16 flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white py-3 shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition-all duration-200">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg px-0" onClick={onToggleCollapsed} aria-label={t("leads.expandPanel")}>
          <ChevronLeft size={18} />
        </Button>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-xs font-black text-brand-700">{initials(leadTitle(selected, clientList, t))}</span>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg px-0" disabled={!selectedClient?.phone} onClick={() => selectedClient?.phone && (window.location.href = `tel:${selectedClient.phone}`)}>
          <Phone size={17} />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg px-0" onClick={() => setNextActionOpen(true)}>
          <ClipboardList size={17} />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg px-0" onClick={() => setDrawerEntity({ type: "lead", id: selected.id })}>
          <MoreHorizontal size={17} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-96 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition-all duration-200">
      <div className="shrink-0 border-b border-slate-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-midnight" title={leadTitle(selected, clientList, t)}>{leadTitle(selected, clientList, t)}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill className={statusClass[selected.status]}>{getStatusLabel(selected.status, t)}</Pill>
              <SourceBadge source={selected.source} t={t} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onToggleCollapsed ? (
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg px-0" onClick={onToggleCollapsed} aria-label={t("leads.collapsePanel")}>
                <ChevronRight size={18} />
              </Button>
            ) : null}
            {onClose ? (
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg px-0" onClick={onClose}>
                <XCircle size={18} />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-600">
          <div className="flex min-w-0 items-center gap-2"><Phone size={16} /> <span className="truncate">{selectedClient?.phone || t("leads.phoneMissing")}</span></div>
          <div className="flex min-w-0 items-center gap-2"><Mail size={16} /> <span className="truncate">{selectedClient?.email || t("leads.emailMissing")}</span></div>
          <div className="flex min-w-0 items-center gap-2"><Tag size={16} /> <span className="truncate">{selectedService?.name || getSourceLabel(selected.source, t)}</span></div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" className="rounded-lg px-2 text-xs" disabled={!selectedClient?.phone} onClick={() => selectedClient?.phone && (window.location.href = `tel:${selectedClient.phone}`)}>
            <Phone size={15} /> {t("leads.call")}
          </Button>
          <Button
            variant="secondary"
            className="rounded-lg px-2 text-xs"
            disabled={!selectedClient?.phone}
            onClick={() => onWhatsAppTemplate(selected)}
          >
            <MessageCircle size={15} /> WhatsApp
          </Button>
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.nextStep")}</p>
          <TruncatedText className="mt-1 text-sm font-bold text-midnight">{nextAction(selected, t)}</TruncatedText>
          <p className="mt-1 text-xs text-slate-500">{formatDateTime(selected.updated_at)}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pr-2">
        <section className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-brand-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-black text-midnight"><Bot size={16} /> {t("leads.aiPriorityTitle")}</p>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-brand-700">{aiInsight.score}/100</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <span className={cn("block h-full rounded-full", aiInsight.score >= 75 ? "bg-emerald-500" : aiInsight.score >= 50 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${aiInsight.score}%` }} />
          </div>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{aiInsight.recommendation}</p>
          <p className="mt-2 text-xs font-black text-red-700">{t("leads.aiLossRisk", { value: aiInsight.lossRisk })}</p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.aiConversationSummary")}</p>
          <p className="mt-2 text-sm font-bold leading-6 text-midnight">{aiInsight.summary}</p>
          <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-600">
            <p><span className="font-black text-slate-400">{t("leads.aiIntent")}:</span> {aiInsight.intent}</p>
            <p><span className="font-black text-slate-400">{t("leads.aiNextBestAction")}:</span> {aiInsight.recommendation}</p>
          </div>
        </section>

        {(aiInsight.stale || aiInsight.duplicateClients.length) ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-black text-amber-900">{aiInsight.stale ? t("leads.staleLeadTitle") : t("leads.duplicatesTitle")}</p>
            {aiInsight.stale ? <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">{t("leads.staleLeadText")}</p> : null}
            {aiInsight.duplicateClients.length ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800">{t("leads.duplicatesText", { count: aiInsight.duplicateClients.length })}</p>
                {aiInsight.duplicateClients.slice(0, 3).map((duplicate) => (
                  <div key={duplicate.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-2">
                    <span className="min-w-0 truncate text-xs font-bold text-midnight">{duplicate.full_name}</span>
                    {selectedClient ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 rounded-lg px-2 text-xs"
                        isLoading={mergeClientMutation.isPending}
                        onClick={() => mergeClientMutation.mutate({ targetId: selectedClient.id, duplicateId: duplicate.id })}
                      >
                        {t("leads.mergeDuplicate")}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.clientRequest")}</p>
          <p className="mt-2 line-clamp-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">{selected.message || t("leads.noLeadComment")}</p>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.control")}</p>
          <Select
            label={t("leads.responsible")}
            value={selected.responsible_user ? String(selected.responsible_user) : ""}
            onChange={(event) => actionMutation.mutate({ action: "assign", lead: selected, user_id: event.target.value ? Number(event.target.value) : undefined })}
            options={[
              { value: "", label: t("leads.assignToMe") },
              ...teamList.map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email })),
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            {selected.status === "new" ? (
              <Button variant="secondary" className="rounded-lg px-2 text-xs" onClick={() => actionMutation.mutate({ action: "contacted", lead: selected })} isLoading={actionMutation.isPending}>
                <CheckCheck size={16} /> {t("leads.contacted")}
              </Button>
            ) : null}
            {["new", "contacted", "lost"].includes(selected.status) ? (
              <Button variant="secondary" className="rounded-lg px-2 text-xs" onClick={() => actionMutation.mutate({ action: "take", lead: selected })} isLoading={actionMutation.isPending}>
                <UserCheck size={16} /> {t("leads.takeWork")}
              </Button>
            ) : null}
            {!["closed", "lost"].includes(selected.status) ? (
              <>
                <Button variant="secondary" className="rounded-lg px-2 text-xs" onClick={() => setAppointmentOpen(true)}>
                  <CalendarPlus size={16} /> {t("leads.book")}
                </Button>
                <Button variant="secondary" className="rounded-lg px-2 text-xs" onClick={() => actionMutation.mutate({ action: "closed", lead: selected })} isLoading={actionMutation.isPending}>
                  <CheckCheck size={16} /> {t("leads.success")}
                </Button>
                <Button
                  variant="secondary"
                  className="rounded-lg px-2 text-xs"
                  onClick={() => {
                    setLostLead(selected);
                    setLostReason(selected.lost_reason || "");
                  }}
                  isLoading={actionMutation.isPending}
                >
                  <XCircle size={16} /> {t("leads.lost")}
                </Button>
              </>
            ) : (
              <Button variant="secondary" className="rounded-lg px-2 text-xs" onClick={() => actionMutation.mutate({ action: "reopen", lead: selected })} isLoading={actionMutation.isPending}>
                <CircleDot size={16} /> {t("leads.reopen")}
              </Button>
            )}
          </div>
        </section>

        <section>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.history")}</p>
            <div className="mt-3 space-y-3">
              <div className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-midnight">{t("leads.leadCreated")}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(selected.created_at)}</p>
                </div>
              </div>
              {selectedNextTask ? (
                <div className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  <div className="min-w-0">
                    <TruncatedText className="text-sm font-bold text-midnight">{selectedNextTask.title}</TruncatedText>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(selectedNextTask.due_at)}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.quickActions")}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="h-14 flex-col rounded-xl px-1 text-xs" disabled={!selectedClient?.phone} onClick={() => selectedClient?.phone && (window.location.href = `tel:${selectedClient.phone}`)}>
              <Phone size={16} /> {t("leads.call")}
            </Button>
            <Button
              variant="secondary"
              className="h-14 flex-col rounded-xl px-1 text-xs"
              disabled={!selectedClient?.phone}
              onClick={() => onWhatsAppTemplate(selected)}
            >
              <MessageCircle size={16} /> WhatsApp
            </Button>
            <Button className="h-14 flex-col rounded-xl px-1 text-xs" onClick={() => actionMutation.mutate({ action: "deal", lead: selected })} isLoading={actionMutation.isPending}>
              <CircleDollarSign size={16} /> {t("leads.deal")}
            </Button>
            <Button variant="secondary" className="h-14 flex-col rounded-xl px-1 text-xs" onClick={() => setNextActionOpen(true)}>
              <ClipboardList size={16} /> {t("leads.task")}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.internalNotes")}</p>
          <div className="relative">
            <textarea
              className="mt-3 min-h-20 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-brand-300 focus:bg-white"
              placeholder={t("leads.notePlaceholder")}
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
            />
            {mentionSuggestions.length || templateSuggestions.length ? (
              <div className="absolute inset-x-2 top-full z-20 mt-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {mentionSuggestions.map((member) => (
                  <button
                    key={member.user.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
                    onClick={() => replaceCommand(/@([\p{L}\d._-]*)$/u, `@${(member.user.full_name || member.user.email).replace(/\s+/g, "_")} `)}
                  >
                    <span className="truncate">{member.user.full_name || member.user.email}</span>
                    <span className="text-xs text-slate-400">@</span>
                  </button>
                ))}
                {templateSuggestions.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="w-full rounded-lg px-2 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
                    onClick={() => replaceCommand(/(?:^|\s)\/([\p{L}\d_-]*)$/u, ` ${template.text}`)}
                  >
                    {template.label}
                    <span className="block truncate text-xs font-semibold text-slate-400">{template.text}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {attachedFiles.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachedFiles.map((file) => (
                <span key={`${file.name}-${file.size}`} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 text-slate-400">{formatFileSize(file.size)}</span>
                  <button type="button" className="shrink-0 text-slate-400 hover:text-red-600" onClick={() => setAttachedFiles((value) => value.filter((item) => item !== file))}>
                    <XCircle size={13} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer text-xs font-bold text-brand-700 hover:text-brand-800">
                {t("leads.attachFiles")}
                <input
                  className="sr-only"
                  type="file"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    setAttachedFiles((value) => [...value, ...files].slice(0, 6));
                    event.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                className={cn("inline-flex items-center gap-1 text-xs font-bold", recording ? "text-red-600" : "text-brand-700 hover:text-brand-800")}
                onClick={recording ? stopVoiceNote : startVoiceNote}
              >
                <Mic size={14} /> {recording ? t("leads.voiceStop") : t("leads.voiceRecord")}
              </button>
            </div>
            <Button
              size="sm"
              className="rounded-lg"
              disabled={!noteDraft.trim() && !attachedFiles.length}
              isLoading={noteMutation.isPending}
              onClick={submitNote}
            >
              {t("leads.addNote")}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.templates")}</p>
          <div className="mt-3 grid gap-2">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-bold text-midnight hover:border-brand-200 hover:bg-brand-50"
                onClick={() => onWhatsAppTemplate(selected, template.text)}
              >
                {template.label}
                <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{template.text}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-base font-black text-midnight">{selectedDeals.length}</p>
            <p className="truncate text-[10px] font-bold text-slate-400">{t("leads.relatedDeals")}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-base font-black text-midnight">{selectedAppointments.length}</p>
            <p className="truncate text-[10px] font-bold text-slate-400">{t("leads.relatedBookings")}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-base font-black text-midnight">{selectedConversations.length}</p>
            <p className="truncate text-[10px] font-bold text-slate-400">{t("leads.relatedConversations")}</p>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <Button className="justify-center rounded-lg" variant="secondary" onClick={() => setDrawerEntity({ type: "lead", id: selected.id })}>
            {t("leads.fullCard")}
          </Button>
          <Button className="justify-center rounded-lg bg-brand-600" onClick={() => priorityLead && openLead(priorityLead)} disabled={!priorityLead}>
            {t("leads.callNow")}
          </Button>
        </div>

        {selected.lost_reason ? (
          <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
            <AlertTriangle aria-hidden="true" size={16} className="mb-2" />
            {selected.lost_reason}
          </div>
        ) : null}
      </div>
    </div>
  );
}
