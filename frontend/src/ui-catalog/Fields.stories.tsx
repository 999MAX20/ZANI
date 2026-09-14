import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Switch } from "../components/ui/Switch";
import { useI18n } from "../lib/i18n";

function Fields({ invalid = false }: { invalid?: boolean }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [selected, setSelected] = useState("all");
  const [checked, setChecked] = useState(false);
  return (
    <section aria-label="Field states" className="grid w-full max-w-lg gap-4 rounded-card border border-zani-border bg-surface-card p-4">
      <Input label={t("services.name")} value={text} onChange={(event) => setText(event.target.value)} error={invalid ? t("services.nameRequired") : undefined} />
      <Input label={`${t("services.name")} (disabled)`} disabled value="Synthetic fixture" />
      <Input label={`${t("services.name")} (readonly)`} readOnly value="Synthetic fixture" />
      <Select
        label={t("services.title")}
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        options={[{ value: "all", label: t("common.all") }, { value: "long", label: `${t("services.title")} — ${t("common.loadingWorkspace")}` }]}
      />
      <div className="flex min-h-11 items-center gap-3">
        <span>{t("services.title")}</span>
        <Switch checked={checked} onChange={setChecked} label={t("services.title")} />
      </div>
      <output data-testid="field-state">{`${text}|${selected}|${checked}`}</output>
    </section>
  );
}

const meta = { title: "Zani/Fields", component: Fields } satisfies Meta<typeof Fields>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Validation: Story = { args: { invalid: true } };
