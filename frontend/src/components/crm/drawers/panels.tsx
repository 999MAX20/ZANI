import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, FilePenLine, FileText, Image, MoreHorizontal, Paperclip, Share2, StickyNote, Upload, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useState } from "react";

import { getApiErrorMessage } from "../../../api/client";
import { fileAttachmentsApi } from "../../../api/fileAttachments";
import { notesApi } from "../../../api/activities";
import { customFieldValuesApi } from "../../../api/customFields";
import { leadsApi } from "../../../api/leads";
import { tasksApi } from "../../../api/tasks";
import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import type { CrmCardPayload, FileAttachment } from "../../../types";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Dialog, PopoverSurface } from "../../ui/Overlay";
import { Select } from "../../ui/Select";
import { StatusBadge } from "../../ui/StatusBadge";
import { Textarea } from "../../ui/Textarea";
import { drawerSurfaceClass, EmptyBlock, getChannelLabel } from "./shared";
import { EntityTimelineList } from "./timeline";
import type { CrmDrawerEntity } from "./types";

const attachmentAccept = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt";

function formatAttachmentSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function isPreviewableAttachment(attachment: FileAttachment) {
  return attachment.content_type.startsWith("image/") || attachment.content_type === "application/pdf" || attachment.content_type.startsWith("text/");
}

function attachmentTypeLabel(attachment: FileAttachment) {
  if (attachment.content_type.startsWith("image/")) return "Image";
  if (attachment.content_type === "application/pdf") return "PDF";
  if (attachment.content_type.includes("spreadsheet") || attachment.original_name.match(/\.(xls|xlsx|csv)$/i)) return "Spreadsheet";
  if (attachment.content_type.includes("word") || attachment.original_name.match(/\.(doc|docx)$/i)) return "Document";
  if (attachment.content_type.startsWith("text/")) return "Text";
  return attachment.content_type || "File";
}

export function EntityAttachmentsPanel({ data, entity }: { data: CrmCardPayload; entity: CrmDrawerEntity }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<FileAttachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewScale, setPreviewScale] = useState(1);
  const [attachmentActionError, setAttachmentActionError] = useState("");
  const [loadingAttachmentId, setLoadingAttachmentId] = useState<string | number | null>(null);
  const [openAttachmentMenuId, setOpenAttachmentMenuId] = useState<string | number | null>(null);
  const [renamingAttachment, setRenamingAttachment] = useState<FileAttachment | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const businessId = data.client?.business || data.lead?.business || data.deal?.business || data.appointment?.business;
  const inputId = `crm-attachment-upload-${entity.type}-${entity.id}`;
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("Business is required.");
      if (!selectedFiles.length) throw new Error("File is required.");
      return Promise.all(
        selectedFiles.map((file) =>
          fileAttachmentsApi.upload({
            business: businessId,
            entityType: entity.type,
            entityId: entity.id,
            file,
          }),
        ),
      );
    },
    onSuccess: async () => {
      setSelectedFiles([]);
      setIsUploadOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crm-card", entity.type, entity.id] }),
        queryClient.invalidateQueries({ queryKey: ["file-attachments"] }),
      ]);
    },
  });
  const renameMutation = useMutation({
    mutationFn: () => {
      if (!renamingAttachment) throw new Error("Attachment is required.");
      return fileAttachmentsApi.rename({ id: renamingAttachment.id, originalName: renameValue.trim() });
    },
    onSuccess: async () => {
      setRenamingAttachment(null);
      setRenameValue("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crm-card", entity.type, entity.id] }),
        queryClient.invalidateQueries({ queryKey: ["file-attachments"] }),
      ]);
    },
  });

  function appendFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files);
    if (!nextFiles.length) return;
    setAttachmentActionError("");
    setSelectedFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const unique = nextFiles.filter((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return [...current, ...unique].slice(0, 10);
    });
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function loadAttachmentBlob(attachment: FileAttachment) {
    setAttachmentActionError("");
    setLoadingAttachmentId(attachment.id);
    try {
      return await fileAttachmentsApi.downloadBlob(attachment.id);
    } catch (error) {
      setAttachmentActionError(getApiErrorMessage(error));
      return null;
    } finally {
      setLoadingAttachmentId(null);
    }
  }

  async function openAttachmentPreview(attachment: FileAttachment) {
    if (!isPreviewableAttachment(attachment)) return;
    const blob = await loadAttachmentBlob(attachment);
    if (!blob) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));
    setPreviewAttachment(attachment);
    setPreviewScale(1);
  }

  async function downloadAttachment(attachment: FileAttachment) {
    const blob = await loadAttachmentBlob(attachment);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.original_name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function shareAttachment(attachment: FileAttachment) {
    const blob = await loadAttachmentBlob(attachment);
    if (!blob) return;
    const file = new File([blob], attachment.original_name, { type: attachment.content_type || blob.type });
    const navigatorWithShare = navigator as Navigator & {
      canShare?: (data: ShareData & { files?: File[] }) => boolean;
      share?: (data: ShareData & { files?: File[] }) => Promise<void>;
    };
    try {
      if (navigatorWithShare.share && (!navigatorWithShare.canShare || navigatorWithShare.canShare({ files: [file] }))) {
        await navigatorWithShare.share({ title: attachment.original_name, files: [file] });
        return;
      }
      setAttachmentActionError(t("crmCard.shareUnsupported"));
    } catch (error) {
      setAttachmentActionError(getApiErrorMessage(error));
    }
  }

  return (
    <div className={drawerSurfaceClass}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            <Paperclip size={14} /> {t("crmCard.attachments")}
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-500">{t("crmCard.attachmentsText")}</p>
        </div>
      </div>
      {data.attachments.length || selectedFiles.length ? (
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {data.attachments.length ? (
            <Button type="button" variant="secondary" onClick={() => setIsUploadOpen((current) => !current)}>
              <Upload size={16} />
              {isUploadOpen ? t("common.cancel") : t("crmCard.addAttachment")}
            </Button>
          ) : null}
          {selectedFiles.length ? (
            <Button type="button" variant="secondary" isLoading={uploadMutation.isPending} onClick={() => uploadMutation.mutate()}>
              <Upload size={16} />
              {t("crmCard.uploadSelected", { count: selectedFiles.length })}
            </Button>
          ) : null}
        </div>
      ) : null}
      {!data.attachments.length || isUploadOpen || selectedFiles.length ? (
        <label
          htmlFor={inputId}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            appendFiles(event.dataTransfer.files);
          }}
          className={`mb-4 flex cursor-pointer flex-col items-center justify-center rounded-card border border-dashed px-4 py-5 text-center transition ${
            isDragging ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 bg-slate-50 text-slate-500 hover:border-brand-200 hover:bg-white"
          }`}
        >
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm">
            <Upload size={18} />
          </span>
          <span className="mt-3 text-sm font-black text-midnight">{t("crmCard.dropFilesTitle")}</span>
          <span className="mt-1 max-w-md text-xs font-semibold leading-5">{t("crmCard.dropFilesText")}</span>
          <input
            id={inputId}
            type="file"
            multiple
            accept={attachmentAccept}
            className="sr-only"
            onChange={(event) => {
              appendFiles(event.target.files || []);
              event.target.value = "";
            }}
          />
        </label>
      ) : null}
      {selectedFiles.length ? (
        <div className="mb-4 space-y-2">
          {selectedFiles.map((file) => (
            <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-3 rounded-control border border-slate-200 bg-white px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-midnight">
                {file.type.startsWith("image/") ? <Image size={15} className="shrink-0 text-brand-600" /> : <FileText size={15} className="shrink-0 text-slate-500" />}
                <span className="truncate">{file.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-500">
                {formatAttachmentSize(file.size)}
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  onClick={() => setSelectedFiles((current) => current.filter((item) => item !== file))}
                  aria-label={t("crmCard.removeFile")}
                >
                  <X size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {uploadMutation.error || attachmentActionError ? <p className="mb-4 rounded-control bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{uploadMutation.error ? getApiErrorMessage(uploadMutation.error) : attachmentActionError}</p> : null}
      {data.attachments.length ? (
        <div className="space-y-2">
          {data.attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative flex min-w-0 items-center justify-between gap-3 rounded-card border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:border-brand-200 hover:bg-white"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-sm">
                  {attachment.content_type.startsWith("image/") ? <Image size={18} /> : <FileText size={18} />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-midnight">{attachment.original_name}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                    {attachmentTypeLabel(attachment)} · {formatAttachmentSize(attachment.size)} · {formatDateTime(attachment.created_at)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-control border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-midnight"
                onClick={() => setOpenAttachmentMenuId((current) => (current === attachment.id ? null : attachment.id))}
                aria-label={t("crmCard.fileActions")}
              >
                <MoreHorizontal size={18} />
              </button>
              {openAttachmentMenuId === attachment.id ? (
                <>
                  <button type="button" className="fixed inset-0 z-[9] cursor-default" aria-label={t("common.close")} onClick={() => setOpenAttachmentMenuId(null)} />
                  <PopoverSurface className="absolute right-3 top-12 z-10 w-48 p-1">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!isPreviewableAttachment(attachment)}
                      onClick={() => {
                        setOpenAttachmentMenuId(null);
                        openAttachmentPreview(attachment);
                      }}
                    >
                      <ExternalLink size={15} />
                      {t("crmCard.previewFile")}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      onClick={() => {
                        renameMutation.reset();
                        setOpenAttachmentMenuId(null);
                        setRenamingAttachment(attachment);
                        setRenameValue(attachment.original_name);
                      }}
                    >
                      <FilePenLine size={15} />
                      {t("crmCard.renameFile")}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      onClick={() => {
                        setOpenAttachmentMenuId(null);
                        downloadAttachment(attachment);
                      }}
                    >
                      <Download size={15} />
                      {loadingAttachmentId === attachment.id ? t("common.loading") : t("crmCard.downloadFile")}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      onClick={() => {
                        setOpenAttachmentMenuId(null);
                        shareAttachment(attachment);
                      }}
                    >
                      <Share2 size={15} />
                      {loadingAttachmentId === attachment.id ? t("common.loading") : t("crmCard.shareFile")}
                    </button>
                  </PopoverSurface>
                </>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-slate-500">{t("crmCard.noAttachments")}</p>
      )}
      <Dialog
        title={previewAttachment?.original_name || t("crmCard.previewFile")}
        open={Boolean(previewAttachment && previewUrl)}
        size="xl"
        className="max-w-[min(96vw,1440px)]"
        bodyClassName="flex min-h-0 flex-col gap-4"
        onClose={() => {
          setPreviewAttachment(null);
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl("");
          setPreviewScale(1);
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-500">
            {previewAttachment ? `${attachmentTypeLabel(previewAttachment)} · ${formatAttachmentSize(previewAttachment.size)}` : null}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setPreviewScale((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))} aria-label={t("crmCard.zoomOut")}>
              <ZoomOut size={15} />
            </Button>
            <button type="button" className="min-h-9 rounded-control border border-slate-200 bg-white px-3 text-xs font-black text-slate-600" onClick={() => setPreviewScale(1)}>
              {Math.round(previewScale * 100)}%
            </button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setPreviewScale((value) => Math.min(3, Number((value + 0.25).toFixed(2))))} aria-label={t("crmCard.zoomIn")}>
              <ZoomIn size={15} />
            </Button>
          </div>
        </div>
        <div className="min-h-[62vh] overflow-auto rounded-card border border-slate-200 bg-slate-100 p-3">
          {previewAttachment?.content_type.startsWith("image/") ? (
            <div className="flex min-h-[62vh] items-start justify-center">
              <img
                src={previewUrl}
                alt={previewAttachment.original_name}
                className="max-w-none rounded-card bg-white object-contain shadow-sm"
                style={{ width: `${previewScale * 100}%` }}
              />
            </div>
          ) : previewAttachment?.content_type === "application/pdf" || previewAttachment?.content_type.startsWith("text/") ? (
            <iframe
              title={previewAttachment.original_name}
              src={`${previewUrl}#zoom=${Math.round(previewScale * 100)}`}
              className="h-[72vh] w-full rounded-card border border-slate-200 bg-white"
            />
          ) : null}
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={() => previewAttachment && downloadAttachment(previewAttachment)}>
            <Download size={16} />
            {t("crmCard.downloadFile")}
          </Button>
        </div>
      </Dialog>
      <Dialog
        title={t("crmCard.renameFile")}
        open={Boolean(renamingAttachment)}
        onClose={() => {
          renameMutation.reset();
          setRenamingAttachment(null);
          setRenameValue("");
        }}
        size="sm"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            renameMutation.mutate();
          }}
        >
          <Input label={t("crmCard.fileName")} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} required />
          {renameMutation.error ? <p className="rounded-control bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{getApiErrorMessage(renameMutation.error)}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                renameMutation.reset();
                setRenamingAttachment(null);
                setRenameValue("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!renameValue.trim()} isLoading={renameMutation.isPending}>
              {t("crmCard.saveFileName")}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

export function EntityDealsPanel({ data }: { data: CrmCardPayload }) {
  return (
    <div className="space-y-3">
      {data.deals.length ? (
        data.deals.map((deal) => (
          <div key={deal.id} className={drawerSurfaceClass}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-midnight">{deal.title}</p>
              <StatusBadge status={deal.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">#{deal.id} · {deal.amount || 0} {deal.currency}</p>
            {deal.notes ? <p className="mt-3 text-sm leading-6 text-slate-600">{deal.notes}</p> : null}
          </div>
        ))
      ) : (
        <EmptyBlock title="Сделок пока нет" text="Сделок пока нет." />
      )}
    </div>
  );
}

export function EntityTimeline({ data }: { data: CrmCardPayload }) {
  return <EntityTimelineList data={data} />;
}

export function EntityTasksPanel({ data }: { data: CrmCardPayload }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [taskTitle, setTaskTitle] = useState("");
  const businessId = data.client?.business || data.lead?.business || data.deal?.business || data.appointment?.business;
  const mutation = useMutation({
    mutationFn: () => {
      if (!businessId || !taskTitle.trim()) throw new Error("Task title is required.");
      return tasksApi.create({
        business: businessId,
        title: taskTitle.trim(),
        client: data.client?.id || null,
        lead: data.lead?.id || null,
        deal: data.deal?.id || null,
        appointment: data.appointment?.id || null,
        priority: "normal",
      });
    },
    onSuccess: () => {
      setTaskTitle("");
      queryClient.invalidateQueries({ queryKey: ["crm-card"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  return (
    <div className="space-y-3">
      <div className={drawerSurfaceClass}>
        <h3 className="font-black text-midnight">{t("crmCard.quickTask")}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{t("crmCard.quickTaskText")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder={t("crmCard.taskPlaceholder")} />
          <Button type="button" variant="secondary" isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            {t("crmCard.createTask")}
          </Button>
        </div>
        {mutation.error ? <p className="mt-2 text-sm font-semibold text-red-600">{t("crmCard.taskError")}</p> : null}
      </div>
      {data.tasks.map((task) => (
        <div key={task.id} className={drawerSurfaceClass}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-midnight">{task.title}</p>
            <StatusBadge status={task.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{task.priority} · {t("crmCard.deadline")} {formatDateTime(task.due_at)}</p>
          {task.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{task.description}</p> : null}
        </div>
      ))}
      {!data.tasks.length ? <EmptyBlock title={t("crmCard.noTasks")} text={t("crmCard.noTasksText")} /> : null}
    </div>
  );
}

export function EntityAppointmentsPanel({ data }: { data: CrmCardPayload }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {data.appointments.map((appointment) => (
        <div key={appointment.id} className={drawerSurfaceClass}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-bold text-midnight">{appointment.service_name || t("nav.appointments")}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {formatDateTime(appointment.start_at)}
                {appointment.resource_name ? ` / ${appointment.resource_name}` : ""}
              </p>
            </div>
            <StatusBadge status={appointment.status} />
          </div>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <p className="min-w-0 truncate font-semibold">{appointment.client_name || data.client?.full_name || t("deals.clientMissing")}</p>
            <p className="min-w-0 truncate font-semibold">{appointment.lead ? appointment.lead_title || t("crmCard.leadNumber", { id: appointment.lead }) : t("deals.notLinked")}</p>
          </div>
          {appointment.notes ? <p className="mt-3 text-sm leading-6 text-slate-600">{appointment.notes}</p> : null}
        </div>
      ))}
      {!data.appointments.length ? <EmptyBlock title={t("nav.appointments")} text={t("appointments.emptyText")} /> : null}
    </div>
  );
}

export function EntityConversationsPanel({ data }: { data: CrmCardPayload }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {data.conversations.map((conversation) => (
        <div key={conversation.id} className={drawerSurfaceClass}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-midnight">{getChannelLabel(conversation.channel, t)}</p>
            <StatusBadge status={conversation.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{t("crmCard.unread")}: {conversation.unread_count || 0} · {formatDateTime(conversation.last_message_at || conversation.updated_at)}</p>
          {conversation.last_message?.text ? <p className="mt-3 text-sm leading-6 text-slate-600">{conversation.last_message.text}</p> : null}
        </div>
      ))}
      {!data.conversations.length ? <EmptyBlock title={t("crmCard.noDialogs")} text={t("crmCard.noDialogsText")} /> : null}
    </div>
  );
}

export function EntityNotesPanel({ data, entity }: { data: CrmCardPayload; entity: CrmDrawerEntity }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const businessId = data.client?.business || data.lead?.business || data.deal?.business || data.appointment?.business;
  const entityType = entity.type.charAt(0).toUpperCase() + entity.type.slice(1);
  const mutation = useMutation({
    mutationFn: () => {
      const noteText = text.trim();
      if (!noteText) throw new Error("Note text is required.");
      if (entity.type === "lead" && data.lead) {
        return leadsApi.addNote({ id: data.lead.id, text: noteText });
      }
      if (!businessId) throw new Error("Business is required.");
      return notesApi.create({
        business: businessId,
        client: data.client?.id || null,
        entity_type: entityType,
        entity_id: String(entity.id),
        text: noteText,
      });
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["crm-card", entity.type, entity.id] });
      queryClient.invalidateQueries({ queryKey: ["activity-events"] });
    },
  });

  return (
    <div className="space-y-3">
      <div className={drawerSurfaceClass}>
        <h3 className="font-black text-midnight">{t("crmCard.comment")}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{t("crmCard.commentText")}</p>
        <Textarea className="mt-3" value={text} onChange={(event) => setText(event.target.value)} placeholder={t("crmCard.commentPlaceholder")} />
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="secondary" isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            {t("crmCard.addComment")}
          </Button>
        </div>
        {mutation.error ? <p className="mt-2 text-sm font-semibold text-red-600">{t("crmCard.commentError")}</p> : null}
      </div>
      {data.notes.map((note) => (
        <div key={note.id} className={drawerSurfaceClass}>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            <StickyNote size={14} /> Note · {formatDateTime(note.created_at)}
          </div>
          <p className="text-sm leading-6 text-slate-700">{note.text}</p>
        </div>
      ))}
      {!data.notes.length ? <EmptyBlock title={t("crmCard.noNotes")} text={t("crmCard.noNotesText")} /> : null}
    </div>
  );
}

export function EntityCustomFieldsPanel({ data, entity }: { data: CrmCardPayload; entity: CrmDrawerEntity }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<number, string>>({});
  useEffect(() => {
    const nextValues: Record<number, string> = {};
    data.custom_fields.forEach((field) => {
      const value = field.value?.value_json?.value;
      nextValues[field.definition.id] = typeof value === "boolean" ? String(value) : String(value ?? "");
    });
    setValues(nextValues);
  }, [data.custom_fields]);

  const mutation = useMutation({
    mutationFn: () =>
      customFieldValuesApi.bulkUpsert({
        business: data.client?.business || data.lead?.business || data.deal?.business || data.appointment?.business || 0,
        entity_type: entity.type,
        entity_id: String(entity.id),
        values: data.custom_fields.map((field) => ({
          definition: field.definition.id,
          value_json: {
            value: field.definition.field_type === "boolean" ? values[field.definition.id] === "true" : values[field.definition.id] || "",
          },
        })),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm-card", entity.type, entity.id] }),
  });

  if (!data.custom_fields.length) return null;

  return (
    <div className={drawerSurfaceClass}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-midnight">{t("crmCard.customFields")}</h3>
          <p className="mt-1 text-sm text-slate-500">{t("crmCard.customFieldsText")}</p>
        </div>
        <Button type="button" variant="secondary" isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
          {t("crmCard.saveFields")}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.custom_fields.map((field) => {
          const options = field.definition.options_json?.options || [];
          if (field.definition.field_type === "boolean") {
            return (
              <Select
                key={field.definition.id}
                label={field.definition.label}
                value={values[field.definition.id] || "false"}
                onChange={(event) => setValues({ ...values, [field.definition.id]: event.target.value })}
                options={[
                  { value: "false", label: t("crmCard.no") },
                  { value: "true", label: t("crmCard.yes") },
                ]}
              />
            );
          }
          if (field.definition.field_type === "select" && options.length) {
            return (
              <Select
                key={field.definition.id}
                label={field.definition.label}
                value={values[field.definition.id] || ""}
                onChange={(event) => setValues({ ...values, [field.definition.id]: event.target.value })}
                options={[{ value: "", label: t("crmCard.notSelected") }, ...options.map((option) => ({ value: option, label: option }))]}
              />
            );
          }
          return (
            <Input
              key={field.definition.id}
              label={field.definition.label}
              type={field.definition.field_type === "number" || field.definition.field_type === "money" ? "number" : field.definition.field_type === "date" ? "date" : "text"}
              value={values[field.definition.id] || ""}
              onChange={(event) => setValues({ ...values, [field.definition.id]: event.target.value })}
            />
          );
        })}
      </div>
    </div>
  );
}
