import { Languages } from "lucide-react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

const languageOptions = [
  { value: "ru", label: "RU" },
  { value: "kk", label: "KK" },
  { value: "en", label: "EN" },
] as const;

export function LanguageSelector({ className }: { className?: string }) {
  const { language, setLanguage } = useI18n();

  return (
    <div
      className={cn(
        "inline-flex h-11 items-center gap-1 rounded-full border border-slate-200/70 bg-white/80 p-1 text-sm font-black text-slate-600 shadow-sm",
        className,
      )}
      aria-label="Language"
      role="group"
    >
      <Languages size={16} className="mx-2 text-brand-600" />
      {languageOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            "h-8 rounded-full px-2.5 text-xs transition",
            language === option.value ? "bg-midnight text-white shadow-soft" : "text-slate-500 hover:bg-slate-100 hover:text-midnight",
          )}
          onClick={() => setLanguage(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
