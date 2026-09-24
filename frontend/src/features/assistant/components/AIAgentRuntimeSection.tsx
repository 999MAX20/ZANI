import { StatusNotice } from "../../../components/ui/StatusNotice";
import { useI18n } from "../../../lib/i18n";
import type { Bot } from "../../../types";
import type { OnboardingStep } from "../aiAgentsTypes";
import { OnboardingProgress } from "./AIAgentsShared";
import { AIAgentPreview } from "./AIAgentPreview";

export function TestAndLaunchSection({ bot, onboardingSteps, launchReady, dirty, canTest }: {
  bot: Bot; onboardingSteps: OnboardingStep[]; launchReady: boolean; dirty: boolean; canTest: boolean;
}) {
  const { t } = useI18n();
  return <div className="space-y-5">
    <StatusNotice compact tone={launchReady ? "success" : "warning"}
      title={t(launchReady ? "aiAgents.hint.launchReady" : "aiAgents.activationBlocked")}
      description={t("aiSetup.launchHelp")} />
    <OnboardingProgress steps={onboardingSteps} />
    <AIAgentPreview key={`${bot.id}-${bot.updated_at}`} botId={bot.id} blocked={dirty || !bot.readiness?.profile_ready} canTest={canTest} />
  </div>;
}
