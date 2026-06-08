import { Plus } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import type { Translate } from "../types";

export function DealsHeader({ onCreate, t }: { onCreate: () => void; t: Translate }) {
  return (
    <header className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-midnight md:text-3xl">{t("deals.salesTitle")}</h1>
        <p className="mt-1 max-w-2xl text-base leading-6 text-slate-600">{t("deals.salesDescription")}</p>
      </div>
      <Button className="w-full sm:w-auto" onClick={onCreate}>
        <Plus size={18} /> {t("deals.create")}
      </Button>
    </header>
  );
}
