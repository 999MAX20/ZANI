import { Languages } from "lucide-react";

import { Select } from "../ui/Select";
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
    <div
      className={cn(
        "zani-language-selector relative inline-flex min-h-10 items-center gap-2 rounded-control border border-zani-border bg-surface-card px-2.5 shadow-sm transition focus-within:border-brand-200 focus-within:ring-4 focus-within:ring-brand-100",
        className,
      )}
    >
      <Languages size={16} className="zani-language-selector__icon shrink-0 text-brand-600" aria-hidden="true" />
      <Select
        className="zani-language-selector__control min-h-8 w-[5.25rem] border-0 bg-transparent px-1.5 py-1 text-sm shadow-none hover:bg-surface-muted"
        value={language}
        onChange={(event) => setLanguage(event.target.value as typeof language)}
        aria-label={t("common.language")}
        options={[...languageOptions]}
      />
    </div>
  );
}
