import { useEffect, useMemo, useState } from "react";

import { settingsGroupOrder, type SettingsGroupKey, type SettingsSectionConfig } from "../settingsConfig";

export function useSettingsSectionNavigation(allowedSettingsSections: SettingsSectionConfig[]) {
  const [activeSettingsSection, setActiveSettingsSection] = useState(() => window.location.hash.replace("#", "") || "business-profile");
  const [openSettingsGroups, setOpenSettingsGroups] = useState<Record<SettingsGroupKey, boolean>>({
    business: true,
    team: true,
    communication: true,
    setup: true,
    advanced: false,
  });
  const allowedSettingsSectionIds = useMemo(() => new Set(allowedSettingsSections.map((section) => section.id)), [allowedSettingsSections]);

  useEffect(() => {
    function handleHashChange() {
      setActiveSettingsSection(window.location.hash.replace("#", "") || "business-profile");
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "instant" }), 0);
    }

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (!allowedSettingsSections.length) return;
    if (allowedSettingsSectionIds.has(activeSettingsSection)) return;
    const nextSection = allowedSettingsSections[0].id;
    setActiveSettingsSection(nextSection);
    if (window.location.hash.replace("#", "") !== nextSection) {
      window.location.hash = nextSection;
    }
  }, [activeSettingsSection, allowedSettingsSectionIds, allowedSettingsSections]);

  const settingsSectionClass = (id: string, className = "mb-5 scroll-mt-24") => `${className} ${activeSettingsSection === id && allowedSettingsSectionIds.has(id) ? "" : "hidden"}`;

  return {
    activeSettingsSection,
    allowedSettingsSectionIds,
    openSettingsGroups,
    setActiveSettingsSection,
    setOpenSettingsGroups,
    settingsGroupOrder,
    settingsSectionClass,
  };
}
