import { createContext, useContext, useMemo, useState } from "react";

import { en } from "./i18n/en";
import { kk } from "./i18n/kk";
import { ru } from "./i18n/ru";

export type Language = "ru" | "kk" | "en";
type Dictionary = Record<string, string>;

const LANGUAGE_KEY = "ai_smb_language";


const dictionaries: Record<Language, Dictionary> = { ru, kk, en };

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLanguage(): Language {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  return saved === "en" || saved === "ru" || saved === "kk" ? saved : "ru";
}

export function translate(language: Language, key: string, vars?: Record<string, string | number>) {
  const template = dictionaries[language][key] || dictionaries.ru[key] || dictionaries.en[key] || key;
  if (!vars) return template;
  return Object.entries(vars).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), template);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const value = useMemo<I18nContextValue>(() => {
    function setLanguage(nextLanguage: Language) {
      localStorage.setItem(LANGUAGE_KEY, nextLanguage);
      setLanguageState(nextLanguage);
    }

    return {
      language,
      setLanguage,
      t: (key: string, vars?: Record<string, string | number>) => translate(language, key, vars),
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
