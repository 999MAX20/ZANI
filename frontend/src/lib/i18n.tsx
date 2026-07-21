import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "ru" | "kk" | "en";
type Dictionary = Record<string, string>;

const LANGUAGE_KEY = "ai_smb_language";

const dictionaryCache: Partial<Record<Language, Dictionary>> = {};
const errorBoundaryDictionary: Record<Language, Dictionary> = {
  ru: {
    "errorBoundary.unknown": "Неизвестная ошибка",
    "errorBoundary.eyebrow": "Ошибка",
    "errorBoundary.title": "Что-то пошло не так",
    "errorBoundary.text": "Обновите страницу или вернитесь в рабочую область.",
    "errorBoundary.reload": "Обновить",
    "errorBoundary.home": "В рабочую область",
  },
  kk: {
    "errorBoundary.unknown": "Белгісіз қате",
    "errorBoundary.eyebrow": "Қате",
    "errorBoundary.title": "Бірдеңе дұрыс болмады",
    "errorBoundary.text": "Бетті жаңартыңыз немесе жұмыс аймағына оралыңыз.",
    "errorBoundary.reload": "Жаңарту",
    "errorBoundary.home": "Жұмыс аймағына",
  },
  en: {
    "errorBoundary.unknown": "Unknown error",
    "errorBoundary.eyebrow": "Error",
    "errorBoundary.title": "Something went wrong",
    "errorBoundary.text": "Refresh the page or return to the workspace.",
    "errorBoundary.reload": "Refresh",
    "errorBoundary.home": "Go to workspace",
  },
};

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

async function loadDictionary(language: Language): Promise<Dictionary> {
  if (dictionaryCache[language]) return dictionaryCache[language];
  if (language === "kk") return import("./i18n/kk").then((module) => module.kk);
  if (language === "en") return import("./i18n/en").then((module) => module.en);
  return import("./i18n/ru").then((module) => module.ru);
}

export function translate(language: Language, key: string, vars?: Record<string, string | number>) {
  const template = dictionaryCache[language]?.[key] || errorBoundaryDictionary[language]?.[key] || errorBoundaryDictionary.ru[key] || key;
  if (!vars) return template;
  return Object.entries(vars).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), template);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);
  const [dictionary, setDictionary] = useState<Dictionary | null>(() => dictionaryCache[getInitialLanguage()] || null);

  useEffect(() => {
    let cancelled = false;
    loadDictionary(language).then((loadedDictionary) => {
      dictionaryCache[language] = loadedDictionary;
      if (!cancelled) setDictionary(loadedDictionary);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    function setLanguage(nextLanguage: Language) {
      localStorage.setItem(LANGUAGE_KEY, nextLanguage);
      setDictionary(dictionaryCache[nextLanguage] || null);
      setLanguageState(nextLanguage);
    }

    return {
      language,
      setLanguage,
      t: (key: string, vars?: Record<string, string | number>) => translate(language, key, vars),
    };
  }, [language]);

  if (!dictionary) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-bold text-slate-500">
        Zani
      </div>
    );
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
