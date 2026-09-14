import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CrmEntityHeader, CrmEntityTabs } from "../components/crm/drawers/shell";
import { EntityDecisionSnapshot, EmptyBlock } from "../components/crm/drawers/shared";
import { crmDrawerTabs } from "../components/crm/drawers/config";
import type { CrmCardTab } from "../components/crm/drawers/types";
import { Drawer } from "../components/ui/Overlay";
import { Button } from "../components/ui/Button";
import { LoadingState } from "../components/ui/StateViews";
import { useI18n } from "../lib/i18n";
import type { CrmCardPayload } from "../types";

const emptyRelated: CrmCardPayload = {
  client: null, lead: null, deal: null, appointment: null,
  leads: [], deals: [], appointments: [], tasks: [], conversations: [], timeline: [],
  notes: [], tags: [], attachments: [], consents: [], custom_fields: [],
};

function DrawerExample({ loading = false }: { loading?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<CrmCardTab>("overview");
  const close = () => setOpen(false);
  return (
    <>
      <Button data-testid="catalog-drawer-trigger" onClick={() => setOpen(true)}>{t("common.open")}</Button>
      <Drawer open={open} onClose={close} size="complex" titleId="catalog-crm-title">
        <CrmEntityHeader data={emptyRelated} entity={{ type: "client", id: 0 }} titleId="catalog-crm-title" onClose={close} />
        <CrmEntityTabs data={emptyRelated} active={tab} onChange={setTab} />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-7" data-testid="catalog-drawer-content">
          {loading ? <LoadingState /> : tab === "overview" ? <EntityDecisionSnapshot data={emptyRelated} /> : (
            <EmptyBlock title={t(crmDrawerTabs.find((item) => item.id === tab)!.labelKey)} text={t("table.emptyDescription")} />
          )}
        </div>
      </Drawer>
    </>
  );
}

const meta = { title: "Zani/CrmDrawer", component: DrawerExample } satisfies Meta<typeof DrawerExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const EmptyRelated: Story = {};
export const Loading: Story = { args: { loading: true } };
