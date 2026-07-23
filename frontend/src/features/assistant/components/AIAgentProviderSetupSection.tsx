import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Radio } from "lucide-react";

import { botChannelsApi } from "../../../api/bots";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { ToggleSwitch } from "../../../components/ui/Switch";
import { useI18n } from "../../../lib/i18n";
import { cn } from "../../../lib/cn";
import type { Bot as BotType, BotChannel, Id } from "../../../types";
import { InstagramInlineSetup } from "../../integrations/components/setup/InstagramSetup";
import { LogoMark } from "../../integrations/components/setup/IntegrationSetupUi";
import { TelegramInlineSetup } from "../../integrations/components/setup/TelegramSetup";
import { WhatsAppInlineSetup } from "../../integrations/components/setup/WhatsAppSetup";
import { channelStatus, channelStatusClass } from "../aiAgentsUtils";
import { HelpCard, FieldHint } from "./AIAgentsShared";
export function ChannelManagerSection(props: {
  businessId: Id;
  bot: BotType;
  bots: BotType[];
  canManage: boolean;
  channelByName: (name: BotChannel["channel"]) => BotChannel | undefined;
  addChannel: ReturnType<typeof useMutation<BotChannel, Error, BotChannel["channel"]>>;
  toggleChannel: ReturnType<typeof useMutation<BotChannel, Error, { channel: BotChannel; status: BotChannel["status"] }>>;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <HelpCard
        title={t("aiAgents.onboarding.channels.helpTitle")}
        text={t("aiAgents.onboarding.channels.helpText")}
        recommendation={t("aiAgents.onboarding.channels.recommendation")}
      />
      <ChannelsSection {...props} />
    </div>
  );
}

function ChannelsSection({
  businessId,
  bot,
  bots,
  canManage,
  channelByName,
  addChannel,
  toggleChannel,
}: {
  businessId: Id;
  bot: BotType;
  bots: BotType[];
  canManage: boolean;
  channelByName: (name: BotChannel["channel"]) => BotChannel | undefined;
  addChannel: ReturnType<typeof useMutation<BotChannel, Error, BotChannel["channel"]>>;
  toggleChannel: ReturnType<typeof useMutation<BotChannel, Error, { channel: BotChannel; status: BotChannel["status"] }>>;
}) {
  const { t } = useI18n();
  const [setupChannel, setSetupChannel] = useState<BotChannel["channel"] | null>(null);
  const channelCards: Array<{ key: BotChannel["channel"]; title: string; description: string; logo?: string }> = [
    { key: "website", title: t("aiAgents.channel.website"), description: t("aiAgents.channel.websiteText") },
    { key: "telegram", title: "Telegram", description: t("aiAgents.channel.telegramText"), logo: "/integrations_logos/telegram.png" },
    { key: "whatsapp", title: "WhatsApp", description: t("aiAgents.channel.whatsappText"), logo: "/integrations_logos/whatsapp.png" },
    { key: "instagram", title: "Instagram", description: t("aiAgents.channel.instagramText"), logo: "/integrations_logos/instagram.png" },
  ];
  const activeChannel = setupChannel ? channelByName(setupChannel) : undefined;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {channelCards.map((item) => {
          const channel = channelByName(item.key);
          const connected = channel?.status === "active";
          return (
            <article key={item.key} className="min-h-[142px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <LogoMark logo={item.logo} label={item.title} />
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    className="h-9 min-w-[118px] rounded-xl px-4 text-sm"
                    disabled={!canManage || addChannel.isPending}
                    isLoading={addChannel.isPending && !channel}
                    onClick={() => {
                      if (!channel && item.key === "website") {
                        addChannel.mutate("website");
                        return;
                      }
                      setSetupChannel(item.key);
                    }}
                  >
                    {channel ? t("aiAgents.configure") : t("aiAgents.connect")}
                  </Button>
                  {channel ? (
                    <ToggleSwitch
                      checked={connected}
                      disabled={!canManage}
                      isLoading={toggleChannel.isPending}
                      label={`${item.title}: ${connected ? t("aiAgents.disable") : t("aiAgents.enable")}`}
                      tone="ai"
                      onChange={(checked) => toggleChannel.mutate({ channel, status: checked ? "active" : "paused" })}
                    />
                  ) : null}
                </div>
              </div>
              <div className="mt-4 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-midnight">{item.title}</h3>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-black ring-1", channelStatusClass(channel))}>
                    {channelStatus(channel, t)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold leading-5 text-slate-500">{item.description}</p>
                <FieldHint>{t(`aiAgents.hint.channel.${item.key}`)}</FieldHint>
              </div>
            </article>
          );
        })}
      </div>

      <Modal title={setupChannel ? t("aiAgents.connectionTitle", { title: channelCards.find((item) => item.key === setupChannel)?.title || "" }) : t("aiAgents.connection")} open={Boolean(setupChannel)} onClose={() => setSetupChannel(null)}>
        {setupChannel === "telegram" ? (
          <TelegramInlineSetup businessId={businessId} bots={bots} canManage={canManage} channel={activeChannel} />
        ) : setupChannel === "whatsapp" ? (
          <WhatsAppInlineSetup businessId={businessId} bots={bots} canManage={canManage} channel={activeChannel} />
        ) : setupChannel === "instagram" ? (
          <InstagramInlineSetup businessId={businessId} bots={bots} canManage={canManage} channel={activeChannel} />
        ) : setupChannel === "website" ? (
          <WebsiteSetup bot={bot} channel={activeChannel} />
        ) : null}
      </Modal>
    </>
  );
}

function WebsiteSetup({ bot, channel }: { bot: BotType; channel?: BotChannel }) {
  const { t } = useI18n();
  const widgetApiBase = import.meta.env.VITE_API_URL || window.location.origin;
  const snippet = channel ? `<script src=\"/widget/zani-widget.js\" data-zani-token=\"${channel.public_token}\" data-zani-api=\"${widgetApiBase}\"></script>` : "";
  return (
    <div className="space-y-4">
      <div className="rounded-card border border-slate-200 bg-white p-4">
        <h3 className="text-lg font-black text-midnight">{t("aiAgents.websiteSetupTitle")}</h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
          {t("aiAgents.websiteSetupText", { name: bot.name })}
        </p>
      </div>
      {channel ? (
        <pre className="max-h-56 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs font-semibold leading-6 text-white">{snippet}</pre>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
          {t("aiAgents.websiteSetupEmpty")}
        </div>
      )}
    </div>
  );
}
