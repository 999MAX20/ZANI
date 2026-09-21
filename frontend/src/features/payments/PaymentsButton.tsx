import { useState } from "react";
import { WalletCards } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { hasPermission } from "../../lib/permissions";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../auth/AuthProvider";
import { PaymentsJournal } from "./PaymentsJournal";

export function PaymentsButton({ client }: { client: { id: number; full_name: string } }) {
  const { business } = useActiveBusiness();
  const { user } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!hasPermission(user, business?.id, "payments") || !hasPermission(user, business?.id, "clients")) return null;
  return <>
    <Button type="button" variant="secondary" onClick={() => setOpen(true)} data-testid="client-payments-open"><WalletCards size={18} aria-hidden />{t("payments.title")}</Button>
    {open && <PaymentsJournal key={`${business?.id}-${client.id}`} client={{ id: client.id, label: client.full_name }} onClose={() => setOpen(false)} />}
  </>;
}
