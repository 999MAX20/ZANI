import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Send,
  Webhook,
} from "lucide-react";
import { useMemo, useState } from "react";

import { developerApi } from "../../api/developers";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { ErrorState } from "../../components/ui/StateViews";
import { Textarea } from "../../components/ui/Textarea";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useI18n } from "../../lib/i18n";
import type {
  ApiTokenCreateResponse,
  Id,
  WebhookDeliveryLog,
} from "../../types";

const defaultTokenScopes = "clients:read";
const defaultWebhookEvents = "lead.created,appointment.created,system.test";

export function DevelopersSection() {
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { t } = useI18n();
  const [tokenName, setTokenName] = useState(() =>
    t("developers.defaultTokenName"),
  );
  const [tokenScopes, setTokenScopes] = useState(defaultTokenScopes);
  const [lastToken, setLastToken] = useState<ApiTokenCreateResponse | null>(
    null,
  );
  const [webhookForm, setWebhookForm] = useState({
    name: t("developers.defaultWebhookName"),
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["developer-api-tokens"] }),
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
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["developer-webhook-deliveries"],
      }),
  });

  const retryDeliveryMutation = useMutation({
    mutationFn: developerApi.deliveries.retry,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["developer-webhook-deliveries"],
      }),
  });

  const latestDeliveries = useMemo(
    () => (deliveries.data || []).slice(0, 8),
    [deliveries.data],
  );
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
              {t("developers.advanced")}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-zani-text">
              {t("developers.title")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zani-subtle">
              {t("developers.description")}
            </p>
          </div>
          <div className="rounded-control border border-zani-border bg-surface-muted px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-zani-subtle">
            {t("developers.summary", {
              tokens: tokens.data?.length || 0,
              webhooks: webhooks.data?.length || 0,
            })}
          </div>
        </div>
        {error ? (
          <div className="mb-4">
            <ErrorState message={getApiErrorMessage(error)} />
          </div>
        ) : null}
        {lastToken ? (
          <div className="mb-4 rounded-card border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-900">
              {t("developers.copyNow")}
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              {t("developers.copyNowText")}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 break-all rounded-control bg-surface-card px-3 py-2 text-sm text-zani-text">
                {lastToken.token}
              </code>
              <Button
                type="button"
                variant="secondary"
                onClick={() => copyText(lastToken.token, "token")}
              >
                <Copy size={16} />
                {lastCopied === "token"
                  ? t("developers.copied")
                  : t("common.copy")}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-card border border-zani-border bg-surface-muted p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-control bg-surface-card text-brand-600">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="font-bold text-zani-text">
                  {t("developers.tokensTitle")}
                </h3>
                <p className="text-sm text-zani-subtle">
                  {t("developers.tokensText")}
                </p>
              </div>
            </div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                createTokenMutation.mutate();
              }}
            >
              <Input
                label={t("developers.name")}
                value={tokenName}
                onChange={(event) => setTokenName(event.target.value)}
                required
              />
              <Input
                label={t("developers.scopes")}
                value={tokenScopes}
                onChange={(event) => setTokenScopes(event.target.value)}
                placeholder="clients:read"
                required
              />
              <Button type="submit" isLoading={createTokenMutation.isPending}>
                {t("developers.createToken")}
              </Button>
            </form>
            <div className="mt-5 space-y-2">
              {(tokens.data || []).map((token) => (
                <div
                  key={token.id}
                  className="rounded-control bg-surface-card p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold text-zani-text">{token.name}</p>
                      <p className="mt-1 text-xs text-zani-subtle">
                        {token.token_prefix}... / {token.scopes_json.join(", ")}
                      </p>
                      <p className="mt-1 text-xs text-zani-faint">
                        {t("developers.lastUsed")}{" "}
                        {formatDate(token.last_used_at)}
                      </p>
                    </div>
                    <span
                      className={
                        token.is_active
                          ? "rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700"
                          : "rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold text-zani-subtle"
                      }
                    >
                      {token.is_active
                        ? t("developers.active")
                        : t("developers.revoked")}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => rotateTokenMutation.mutate(token.id)}
                      isLoading={rotateTokenMutation.isPending}
                    >
                      <RotateCcw size={15} />
                      {t("developers.rotate")}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => revokeTokenMutation.mutate(token.id)}
                      disabled={!token.is_active}
                      isLoading={revokeTokenMutation.isPending}
                    >
                      {t("developers.revoke")}
                    </Button>
                  </div>
                </div>
              ))}
              {!tokens.isLoading && !tokens.data?.length ? (
                <p className="text-sm text-zani-subtle">
                  {t("developers.noTokens")}
                </p>
              ) : null}
            </div>
          </div>
          <div className="rounded-card border border-zani-border bg-surface-card p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-control bg-surface-muted text-brand-600">
                <Webhook size={20} />
              </div>
              <div>
                <h3 className="font-bold text-zani-text">
                  {t("developers.webhooksTitle")}
                </h3>
                <p className="text-sm text-zani-subtle">
                  {t("developers.webhooksText")}
                </p>
              </div>
            </div>
            <form
              className="mt-4 grid gap-3 lg:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                createWebhookMutation.mutate();
              }}
            >
              <Input
                label={t("developers.name")}
                value={webhookForm.name}
                onChange={(event) =>
                  setWebhookForm({ ...webhookForm, name: event.target.value })
                }
                required
              />
              <Input
                label={t("common.url")}
                value={webhookForm.url}
                onChange={(event) =>
                  setWebhookForm({ ...webhookForm, url: event.target.value })
                }
                required
              />
              <Input
                label={t("developers.signatureSecret")}
                value={webhookForm.secret}
                onChange={(event) =>
                  setWebhookForm({ ...webhookForm, secret: event.target.value })
                }
                placeholder={t("common.optional")}
              />
              <Input
                label={t("developers.events")}
                value={webhookForm.events}
                onChange={(event) =>
                  setWebhookForm({ ...webhookForm, events: event.target.value })
                }
                required
              />
              <div className="lg:col-span-2 flex flex-wrap gap-2">
                <Button
                  type="submit"
                  isLoading={createWebhookMutation.isPending}
                >
                  {t("developers.addWebhook")}
                </Button>
                {webhookForm.secret ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => copyText(webhookForm.secret, "secret")}
                  >
                    <Copy size={16} />
                    {lastCopied === "secret"
                      ? t("developers.copied")
                      : t("developers.copySecret")}
                  </Button>
                ) : null}
              </div>
            </form>
            <div className="mt-5 space-y-3">
              {(webhooks.data || []).map((endpoint) => (
                <div
                  key={endpoint.id}
                  className="rounded-control bg-surface-muted p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-zani-text">
                        {endpoint.name}
                      </p>
                      <p className="mt-1 break-all text-xs text-zani-subtle">
                        {endpoint.url}
                      </p>
                      <p className="mt-1 text-xs text-zani-faint">
                        {endpoint.events_json.join(", ") ||
                          t("developers.allEvents")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => testDeliveryMutation.mutate(endpoint.id)}
                      isLoading={testDeliveryMutation.isPending}
                    >
                      <Send size={15} />
                      {t("developers.check")}
                    </Button>
                  </div>
                </div>
              ))}
              {!webhooks.isLoading && !webhooks.data?.length ? (
                <p className="text-sm text-zani-subtle">
                  {t("developers.noWebhooks")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-5 rounded-card border border-zani-border bg-surface-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-zani-text">
                {t("developers.deliveryTitle")}
              </h3>
              <p className="mt-1 text-sm text-zani-subtle">
                {t("developers.deliveryText")}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => deliveries.refetch()}
              isLoading={deliveries.isFetching}
            >
              <RefreshCw size={15} />
              {t("developers.refresh")}
            </Button>
          </div>
          <div className="space-y-2">
            {latestDeliveries.map((delivery) => (
              <DeliveryRow
                key={delivery.id}
                delivery={delivery}
                isRetrying={retryDeliveryMutation.isPending}
                onRetry={(id) => retryDeliveryMutation.mutate(id)}
                t={t}
              />
            ))}
            {!deliveries.isLoading && !latestDeliveries.length ? (
              <p className="rounded-control bg-surface-muted p-4 text-sm text-zani-subtle">
                {t("developers.noDeliveries")}
              </p>
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function DeliveryRow({
  delivery,
  isRetrying,
  onRetry,
  t,
}: {
  delivery: WebhookDeliveryLog;
  isRetrying: boolean;
  onRetry: (id: Id) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="rounded-control border border-zani-border bg-surface-muted p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-bold text-zani-text">
            {delivery.event_type} /{" "}
            {delivery.endpoint_name || `Endpoint #${delivery.endpoint}`}
          </p>
          <p className="mt-1 text-xs text-zani-subtle">
            {delivery.idempotency_key} / {t("developers.attempts")}{" "}
            {delivery.attempts} / HTTP {delivery.response_status || "-"} /{" "}
            {formatDate(delivery.created_at)}
          </p>
          {delivery.error ? (
            <p className="mt-1 text-xs font-semibold text-red-600">
              {delivery.error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={deliveryStatusClass(delivery.status)}>
            {delivery.status}
          </span>
          {delivery.status === "failed" ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onRetry(delivery.id)}
              isLoading={isRetrying}
            >
              {t("common.retry")}
            </Button>
          ) : null}
        </div>
      </div>
      <details className="mt-3 rounded-control bg-surface-card px-3 py-2">
        <summary className="cursor-pointer text-xs font-bold text-zani-subtle">
          {t("developers.showPayload")}
        </summary>
        <Textarea
          className="mt-3 text-xs"
          value={JSON.stringify(delivery.payload_json, null, 2)}
          readOnly
        />
      </details>
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
    pending:
      "rounded-full bg-surface-card px-2.5 py-1 text-xs font-semibold text-zani-subtle",
    sent: "rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700",
    failed:
      "rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700",
  };
  return classes[status];
}
