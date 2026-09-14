import { useEffect, type ReactNode } from "react";
import type { Preview } from "@storybook/react-vite";
import { catalogModes } from "./modes";
import { I18nProvider, useI18n, type Language } from "../src/lib/i18n";
import "@fontsource-variable/manrope";
import "../src/styles.css";

function CatalogLocale({ language, children }: { language: Language; children: ReactNode }) {
  const { language: current, setLanguage } = useI18n();
  useEffect(() => {
    document.documentElement.lang = language;
    if (language !== current) setLanguage(language);
  }, [current, language, setLanguage]);
  if (current !== language) return null;
  return <main data-catalog-ready={language} className="min-h-screen bg-zani-bg p-4 text-zani-text">{children}</main>;
}

const preview: Preview = {
  initialGlobals: { locale: "ru" },
  globalTypes: {
    locale: {
      description: "Zani locale",
      toolbar: { icon: "globe", items: ["ru", "kk", "en"], dynamicTitle: true },
    },
  },
  decorators: [(Story, context) => (
    <I18nProvider>
      <CatalogLocale language={(context.globals.locale || "ru") as Language}>
        <Story />
      </CatalogLocale>
    </I18nProvider>
  )],
  parameters: { layout: "fullscreen", a11y: { test: "error" }, chromatic: { modes: catalogModes } },
};

export default preview;
