import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DatabaseZap, RefreshCw, ShieldCheck } from "lucide-react";

import { businessConnectorsApi } from "../../../../api/connectors";
import { getApiErrorMessage } from "../../../../api/client";
import { Button } from "../../../../components/ui/Button";
import { ErrorState } from "../../../../components/ui/StateViews";
import { Input } from "../../../../components/ui/Input";
import type { BusinessConnector, Id } from "../../../../types";

export function MoySkladInlineSetup({
  businessId,
  canManage,
  connector,
}: {
  businessId: Id;
  canManage: boolean;
  connector?: BusinessConnector;
}) {
  const queryClient = useQueryClient();
  const [accessToken, setAccessToken] = useState("");
  const [entities, setEntities] = useState<string[]>(Array.isArray(connector?.config_json?.entities) ? connector?.config_json?.entities as string[] : ["products", "stock", "sales", "clients"]);
  const [pageSize, setPageSize] = useState(String(connector?.config_json?.page_size || "50"));
  const [showAccessSetup, setShowAccessSetup] = useState(Boolean(connector?.config_json?.access_token_configured));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["moysklad-status", connector?.id],
    queryFn: () => businessConnectorsApi.moyskladStatus(Number(connector?.id)),
    enabled: Boolean(connector?.id),
  });

  const saveConfig = useMutation({
    mutationFn: () => businessConnectorsApi.configureMoySklad({
      business: businessId,
      accessToken,
      entities,
      pageSize: Number(pageSize || 50),
    }),
    onSuccess: () => {
      setAccessToken("");
      setNotice("МойСклад подключен. Доступ сохранен приватно, можно проверить подключение.");
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["moysklad-status"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => businessConnectorsApi.moyskladTestConnection(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? "Подключение к МойСклад проверено." : data.reason || "Не удалось проверить доступ МойСклад.");
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["moysklad-status", connector?.id] });
    },
  });

  const syncData = useMutation({
    mutationFn: () => businessConnectorsApi.moyskladSync(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? `Данные загружены: ${data.events.length} событий.` : data.reason || "Не удалось загрузить данные МойСклад.");
      queryClient.invalidateQueries({ queryKey: ["business-events"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["connector-sync-runs"] });
      queryClient.invalidateQueries({ queryKey: ["moysklad-status", connector?.id] });
    },
  });

  const toggleEntity = (entity: string) => {
    setEntities((current) => current.includes(entity) ? current.filter((item) => item !== entity) : [...current, entity]);
  };

  const error = saveConfig.error || testConnection.error || syncData.error || status.error;
  const tokenConfigured = Boolean(status.data?.access_token_configured || connector?.config_json?.access_token_configured);

  return (
    <div className="w-full space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Доступ</p>
          <p className="mt-1 text-sm font-black text-midnight">{tokenConfigured ? "Сохранен" : "Нужен"}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Режим</p>
          <p className="mt-1 text-sm font-black text-midnight">Только чтение</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Склад</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.last_sync_at ? "Загружался" : "Еще нет"}</p>
        </div>
      </div>

      {!showAccessSetup ? (
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-black text-blue-950">Подключение МойСклад</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-blue-800">
            Сейчас МойСклад подключается через ключ доступа. Следующий production-шаг — авторизация через приложение МойСклад без копирования ключа.
          </p>
          <Button type="button" className="mt-3" disabled={!canManage} onClick={() => setShowAccessSetup(true)}>
            <ShieldCheck size={16} /> Ввести ключ доступа
          </Button>
        </div>
      ) : (
        <Input
          label="Ключ доступа МойСклад"
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
          placeholder={tokenConfigured ? "Доступ уже сохранен. Вставьте новый ключ только для замены." : "Вставьте ключ доступа из МойСклад"}
          type="password"
          autoComplete="off"
        />
      )}

      <button type="button" className="text-sm font-black text-brand-700" onClick={() => setShowAdvanced((value) => !value)}>
        {showAdvanced ? "Скрыть дополнительные настройки" : "Дополнительные настройки"}
      </button>
      {showAdvanced ? (
        <div className="space-y-3 rounded-2xl bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["products", "Товары"],
              ["stock", "Остатки"],
              ["sales", "Продажи"],
              ["clients", "Контрагенты"],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={entities.includes(value)} onChange={() => toggleEntity(value)} />
                {label}
              </label>
            ))}
          </div>
          <Input label="Лимит строк за раз" value={pageSize} onChange={(event) => setPageSize(event.target.value)} placeholder="50" type="number" />
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Button type="button" disabled={!canManage || (!accessToken.trim() && !connector)} isLoading={saveConfig.isPending} onClick={() => saveConfig.mutate()}>
          <ShieldCheck size={16} /> {connector ? "Сохранить доступ" : "Подключить МойСклад"}
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !tokenConfigured} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
          <RefreshCw size={16} /> Проверить
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !tokenConfigured || !entities.length} isLoading={syncData.isPending} onClick={() => syncData.mutate()}>
          <DatabaseZap size={16} /> Загрузить данные
        </Button>
      </div>

      <p className="text-xs font-semibold leading-5 text-slate-500">
        ZANI только читает товары, остатки, продажи и контрагентов. Изменение документов, цен и остатков в МойСклад здесь отключено.
      </p>
    </div>
  );
}
