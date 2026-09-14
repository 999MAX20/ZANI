import { useState } from "react";
import { Plus } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, type ButtonVariant } from "../components/ui/Button";
import { useI18n } from "../lib/i18n";

const variants: ButtonVariant[] = ["primary", "secondary", "ghost", "outline", "warning", "danger", "ai", "icon"];

function ButtonStates() {
  const { t } = useI18n();
  const [clicks, setClicks] = useState(0);
  return (
    <section aria-label="Button states" className="grid gap-4">
      <output data-testid="click-count" aria-label="Test clicks">{clicks}</output>
      {variants.map((variant) => (
        <section key={variant} data-testid={`variant-${variant}`} className="rounded-card border border-zani-border bg-surface-card p-4">
          <h2 className="mb-3 text-sm font-semibold">{variant}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant={variant} onClick={() => setClicks((value) => value + 1)} aria-label={variant === "icon" ? t("common.save") : undefined}>
              {variant === "icon" ? <Plus size={18} aria-hidden="true" /> : t("common.save")}
            </Button>
            <Button variant={variant} disabled>{t("common.save")}</Button>
            <Button variant={variant} isLoading>{t("common.save")}</Button>
          </div>
        </section>
      ))}
    </section>
  );
}

function LongLabel() {
  const { t } = useI18n();
  return (
    <div className="w-full max-w-sm">
      <Button className="w-full">
        <Plus aria-hidden="true" size={18} className="shrink-0" />
        <span>{`${t("common.save")} — ${t("services.title")} — ${t("common.loadingWorkspace")}`}</span>
      </Button>
    </div>
  );
}

const meta = { title: "Zani/Buttons", component: Button } satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const States: Story = { render: () => <ButtonStates /> };
export const LongLocalizedLabel: Story = { render: () => <LongLabel /> };
