import type { Translate } from "../types";

export function DealsHeader({ t }: { t: Translate }) {
  return (
    <header className="mb-4">
      <div>
        <h1 className="text-[26px] font-black leading-tight tracking-normal text-slate-950 md:text-[30px]">{t("deals.title")}</h1>
        <p className="mt-1 max-w-2xl text-[13px] font-semibold leading-5 text-slate-500">{t("deals.description")}</p>
      </div>
    </header>
  );
}
