import { ChevronDown, Languages } from "lucide-react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

const languageOptions = [
  { value: "ru", label: "RU" },
  { value: "kk", label: "KK" },
  { value: "en", label: "EN" },
] as const;

export function LanguageSelector({ className }: { className?: string }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <label
      className={cn(
        "relative inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/85 px-3 text-sm font-black text-slate-600 shadow-sm",
        className,
      )}
      aria-label={t("common.language")}
    >
      <Languages size={16} className="shrink-0 text-brand-600" />
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as typeof language)}
        className="w-full min-w-[3.25rem] cursor-pointer appearance-none bg-transparent pr-5 text-sm font-black text-midnight outline-none"
      >
        {languageOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 shrink-0 text-slate-400" />
    </label>
  );
}
