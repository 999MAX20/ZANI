import { Languages } from "lucide-react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

export function LanguageSelector({ className }: { className?: string }) {
  const { language, setLanguage } = useI18n();

  return (
    <label className={cn("inline-flex h-10 items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 text-sm font-semibold text-slate-700 shadow-sm", className)}>
      <Languages size={16} className="text-brand-600" />
      <select
        className="min-w-0 bg-transparent text-sm font-semibold outline-none"
        value={language}
        onChange={(event) => setLanguage(event.target.value as "ru" | "en")}
        aria-label="Language"
      >
        <option value="ru">RU</option>
        <option value="en">EN</option>
      </select>
    </label>
  );
}
