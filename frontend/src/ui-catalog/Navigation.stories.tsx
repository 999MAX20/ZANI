import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { useI18n } from "../lib/i18n";

function TabExample() {
  const { t } = useI18n();
  const [tab, setTab] = useState("all");
  const options = [{ value: "all", label: t("common.all"), count: 12 }, { value: "services", label: t("services.title"), count: 3 }];
  return (
    <section className="w-full max-w-xl">
      <Tabs value={tab} onChange={setTab} options={options} ariaLabel={t("services.title")} idPrefix="catalog" />
      {options.map((option) => (
        <div key={option.value} role="tabpanel" id={`catalog-panel-${option.value}`} aria-labelledby={`catalog-tab-${option.value}`} hidden={tab !== option.value} className="p-4" tabIndex={0}>
          {option.label}
        </div>
      ))}
    </section>
  );
}

function DialogExample({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <Button data-focus-return-id="catalog-dialog" onClick={() => setOpen(true)}>{t("common.edit")}</Button>
      <Modal title={t("services.title")} open={open} onClose={() => setOpen(false)} focusReturnId="catalog-dialog" size="sm">
        <div className="grid gap-4">
          <Input label={t("services.name")} defaultValue="Synthetic fixture" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => setOpen(false)}>{t("common.save")}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

const meta = { title: "Zani/Navigation" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const KeyboardTabs: Story = { render: () => <TabExample /> };
export const Dialog: Story = { render: () => <DialogExample /> };
export const OpenDialog: Story = { render: () => <DialogExample initiallyOpen /> };
