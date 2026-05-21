import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, RefreshCw, RotateCcw, Send, Webhook } from "lucide-react";
import { useMemo, useState } from "react";

import { developerApi } from "../../api/developers";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { ErrorState } from "../../components/ui/StateViews";
import { Textarea } from "../../components/ui/Textarea";
import { useActiveBusiness } from "../../hooks/useBusiness";
import type { ApiTokenCreateResponse, Id, WebhookDeliveryLog } from "../../types";

const defaultTokenScopes = "clients:read";
const defaultWebhookEvents = "lead.created,appointment.created,system.test";

export function DevelopersSection() {
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const [tokenName, setTokenName] = useState("CRM API token");
  const [tokenScopes, setTokenScopes] = useState(defaultTokenScopes);
  const [lastToken, setLastToken] = useState<ApiTokenCreateResponse | null>(null);
  const [webhookForm, setWebhookForm] = useState({
    name: "Production webhook",
    url: "mock://success",
    secret: "",
    events: defaultWebhookEvents,
  });
  const [lastCopied, setLastCopied] = useState("");

  const tokens = useQuery({
    queryKey: ["developer-api-tokens", business?.id],
    queryFn: developerApi.tokens.list,
    enabled: Boolean(business),
  });
  const webhooks = useQuery({
    queryKey: ["developer-webhooks", business?.id],
    queryFn: developerApi.webhooks.list,
    enabled: Boolean(business),
  });
  const deliveries = useQuery({
    queryKey: ["developer-webhook-deliveries", business?.id],
    queryFn: () => developerApi.deliveries.list(),
    enabled: Boolean(business),
  });

  const createTokenMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is required.");
      return developerApi.tokens.create({
        business: business.id,
        name: tokenName,
        scopes_json: splitCsv(tokenScopes),
      });
    },
    onSuccess: (token) => {
      setLastToken(token);
      queryClient.invalidateQueries({ queryKey: ["developer-api-tokens"] });
    },
  });

  const rotateTokenMutation = useMutation({
    mutationFn: developerApi.tokens.rotate,
    onSuccess: (token) => {
      setLastToken(token);
      queryClient.invalidateQueries({ queryKey: ["developer-api-tokens"] });
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: developerApi.tokens.revoke,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["developer-api-tokens"] }),
  });

  const createWebhookMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is required.");
      return developerApi.webhooks.create({
        business: business.id,
        name: webhookForm.name,
        url: webhookForm.url,
        secret: webhookForm.secret,
        events_json: splitCsv(webhookForm.events),
        is_active: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["developer-webhooks"] });
      setWebhookForm((current) => ({ ...current, secret: "" }));
    },
  });

  const testDeliveryMutation = useMutation({
    mutationFn: developerApi.webhooks.testDelivery,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["developer-webhook-deliveries"] }),
  });

  const retryDeliveryMutation = useMutation({
    mutationFn: developerApi.deliveries.retry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["developer-webhook-deliveries"] }),
  });

  const latestDeliveries = useMemo(() => (deliveries.data || []).slice(0, 8), [deliveries.data]);
  const error =
    createTokenMutation.error ||
    rotateTokenMutation.error ||
    revokeTokenMutation.error ||
    createWebhookMutation.error ||
    testDeliveryMutation.error ||
    retryDeliveryMutation.error ||
    tokens.error ||
    webhooks.error ||
    deliveries.error;

  async function copyText(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setLastCopied(label);
    window.setTimeout(() => setLastCopied(""), 2000);
  }

  return (
    <Card className="mb-5">
      <CardBody>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Developers</p>
            <h2 className="mt-2 text-2xl font-semibold text-midnight">API tokens и webhooks</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Интеграционный слой для внешних сервисов: scoped tokens, delivery logs, retries и idempotency keys без доступа к чужим данным.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            {tokens.data?.length || 0} tokens · {webhooks.data?.length || 0} hooks
          </div>
        </div>
        {error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(error)} /></div> : null}
        {lastToken ? (
          <div className="mb-4 rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="font-black text-emerald-900">Скопируйте токен сейчас</p>
            <p className="mt-1 text-sm text-emerald-800">Полный ключ показывается только один раз. В базе хранится только hash.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 break-all rounded-2xl bg-white px-3 py-2 text-sm text-slate-700">{lastToken.token}</code>
              <Button type="button" variant="secondary" onClick={() => copyText(lastToken.token, "token")}>
                <Copy size={16} />
                {lastCopied === "token" ? "Скопировано" : "Copy"}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-brand-600">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="font-black text-midnight">API tokens</h3>
                <p className="text-sm text-slate-500">Минимально: `clients:read` для внешнего read API.</p>
              </div>
            </div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                createTokenMutation.mutate();
              }}
            >
              <Input label="Название" value={tokenName} onChange={(event) => setTokenName(event.target.value)} required />
              <Input label="Scopes" value={tokenScopes} onChange={(event) => setTokenScopes(event.target.value)} placeholder="clients:read" required />
              <Button type="submit" isLoading={createTokenMutation.isPending}>
                Создать token
              </Button>
            </form>
            <div className="mt-5 space-y-2">
              {(tokens.data || []).map((token) => (
                <div key={token.id} className="rounded-2xl bg-white p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold text-midnight">{token.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{token.token_prefix}... · {token.scopes_json.join(", ")}</p>
                      <p className="mt-1 text-xs text-slate-400">Last used: {formatDate(token.last_used_at)}</p>
                    </div>
                    <span className={token.is_active ? "rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700" : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500"}>
                      {token.is_active ? "Active" : "Revoked"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => rotateTokenMutation.mutate(token.id)} isLoading={rotateTokenMutation.isPending}>
                      <RotateCcw size={15} />
                      Rotate
                    </Button>
                    <Button type="button" variant="danger" onClick={() => revokeTokenMutation.mutate(token.id)} disabled={!token.is_active} isLoading={revokeTokenMutation.isPending}>
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
              {!tokens.isLoading && !tokens.data?.length ? <p className="text-sm text-slate-500">Токенов пока нет.</p> : null}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-50 text-brand-600">
                <Webhook size={20} />
              </div>
              <div>
                <h3 className="font-black text-midnight">Webhook endpoints</h3>
                <p className="text-sm text-slate-500">Для dev можно использовать `mock://success` и `mock://fail`.</p>
              </div>
            </div>
            <form
              className="mt-4 grid gap-3 lg:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                createWebhookMutation.mutate();
              }}
            >
              <Input label="Название" value={webhookForm.name} onChange={(event) => setWebhookForm({ ...webhookForm, name: event.target.value })} required />
              <Input label="URL" value={webhookForm.url} onChange={(event) => setWebhookForm({ ...webhookForm, url: event.target.value })} required />
              <Input label="Secret" value={webhookForm.secret} onChange={(event) => setWebhookForm({ ...webhookForm, secret: event.target.value })} placeholder="optional signing secret" />
              <Input label="Events" value={webhookForm.events} onChange={(event) => setWebhookForm({ ...webhookForm, events: event.target.value })} required />
              <div className="lg:col-span-2 flex flex-wrap gap-2">
                <Button type="submit" isLoading={createWebhookMutation.isPending}>Добавить webhook</Button>
                {webhookForm.secret ? (
                  <Button type="button" variant="secondary" onClick={() => copyText(webhookForm.secret, "secret")}>
                    <Copy size={16} />
                    {lastCopied === "secret" ? "Скопировано" : "Copy secret"}
                  </Button>
                ) : null}
              </div>
            </form>
            <div className="mt-5 space-y-3">
              {(webhooks.data || []).map((endpoint) => (
                <div key={endpoint.id} className="rounded-2xl bg-slate-50 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-midnight">{endpoint.name}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">{endpoint.url}</p>
                      <p className="mt-1 text-xs text-slate-400">{endpoint.events_json.join(", ") || "all events"}</p>
                    </div>
                    <Button type="button" variant="secondary" onClick={() => testDeliveryMutation.mutate(endpoint.id)} isLoading={testDeliveryMutation.isPending}>
                      <Send size={15} />
                      Test
                    </Button>
                  </div>
                </div>
              ))}
              {!webhooks.isLoading && !webhooks.data?.length ? <p className="text-sm text-slate-500">Webhook endpoints пока не настроены.</p> : null}
            </div>
          </div>
        </div>
        <div className="mt-5 rounded-3xl border border-slate-100 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-midnight">Delivery logs</h3>
              <p className="mt-1 text-sm text-slate-500">Последние доставки, ответы провайдера и ручной retry для failed событий.</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => deliveries.refetch()} isLoading={deliveries.isFetching}>
              <RefreshCw size={15} />
              Refresh
            </Button>
          </div>
          <div className="space-y-2">
            {latestDeliveries.map((delivery) => (
              <DeliveryRow
                key={delivery.id}
                delivery={delivery}
                isRetrying={retryDeliveryMutation.isPending}
                onRetry={(id) => retryDeliveryMutation.mutate(id)}
              />
            ))}
            {!deliveries.isLoading && !latestDeliveries.length ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Доставок пока нет. Нажмите Test у webhook endpoint.</p> : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function DeliveryRow({ delivery, isRetrying, onRetry }: { delivery: WebhookDeliveryLog; isRetrying: boolean; onRetry: (id: Id) => void }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-bold text-midnight">{delivery.event_type} · {delivery.endpoint_name || `Endpoint #${delivery.endpoint}`}</p>
          <p className="mt-1 text-xs text-slate-500">
            {delivery.idempotency_key} · attempts {delivery.attempts} · HTTP {delivery.response_status || "-"} · {formatDate(delivery.created_at)}
          </p>
          {delivery.error ? <p className="mt-1 text-xs font-semibold text-red-600">{delivery.error}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={deliveryStatusClass(delivery.status)}>{delivery.status}</span>
          {delivery.status === "failed" ? (
            <Button type="button" variant="secondary" onClick={() => onRetry(delivery.id)} isLoading={isRetrying}>
              Retry
            </Button>
          ) : null}
        </div>
      </div>
      <Textarea className="mt-3 text-xs" value={JSON.stringify(delivery.payload_json, null, 2)} readOnly />
    </div>
  );
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value?: string | null) {
  if (!value) return "never";
  return new Date(value).toLocaleString("ru-RU");
}

function deliveryStatusClass(status: WebhookDeliveryLog["status"]) {
  const classes: Record<WebhookDeliveryLog["status"], string> = {
    pending: "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600",
    sent: "rounded-full bg-green-50 px-2.5 py-1 text-xs font-black text-green-700",
    failed: "rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700",
  };
  return classes[status];
}
