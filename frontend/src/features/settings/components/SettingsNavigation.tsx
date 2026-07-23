import { ChevronDown } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { Surface } from "../../../components/ui/Card";
import { Select } from "../../../components/ui/Select";
import type { SettingsGroupKey } from "../settingsConfig";

type TranslatedSettingsSection = {
  id: string;
  label: string;
};

type TranslatedSettingsGroup = {
  key: SettingsGroupKey;
  label: string;
  sections: TranslatedSettingsSection[];
};

type SettingsNavigationProps = {
  activeSettingsSection: string;
  openSettingsGroups: Record<SettingsGroupKey, boolean>;
  setActiveSettingsSection: (sectionId: string) => void;
  setOpenSettingsGroups: Dispatch<
    SetStateAction<Record<SettingsGroupKey, boolean>>
  >;
  translatedSettingsGroups: TranslatedSettingsGroup[];
  translatedSettingsSections: TranslatedSettingsSection[];
  navigationTitle: string;
};

export function SettingsNavigation({
  activeSettingsSection,
  openSettingsGroups,
  setActiveSettingsSection,
  setOpenSettingsGroups,
  translatedSettingsGroups,
  translatedSettingsSections,
  navigationTitle,
}: SettingsNavigationProps) {
  return (
    <aside className="xl:sticky xl:top-20 xl:self-start">
      <Surface variant="outlined" padding="sm" className="shadow-soft">
        <Select
          className="min-h-10 rounded-control xl:hidden"
          value={activeSettingsSection}
          onChange={(event) => {
            setActiveSettingsSection(event.target.value);
            window.location.hash = event.target.value;
          }}
          options={translatedSettingsSections.map((section) => ({
            value: section.id,
            label: section.label,
          }))}
        />
        <div className="hidden xl:block">
          <div className="mb-2 px-2 py-1">
            <p className="text-sm font-bold text-zani-text">
              {navigationTitle}
            </p>
          </div>
          <nav className="space-y-1.5">
            {translatedSettingsGroups.map((groupItem) => {
              const groupOpen = openSettingsGroups[groupItem.key];
              const hasActiveSection = groupItem.sections.some(
                (section) => section.id === activeSettingsSection,
              );
              return (
                <div
                  key={groupItem.key}
                  className="rounded-control border border-zani-border bg-surface-card p-1"
                >
                  <button
                    type="button"
                    className="flex min-h-8 w-full items-center justify-between gap-3 rounded-control px-2.5 text-left text-[11px] font-semibold uppercase text-zani-faint transition hover:bg-surface-warm hover:text-zani-text"
                    onClick={() =>
                      setOpenSettingsGroups((current) => ({
                        ...current,
                        [groupItem.key]: !current[groupItem.key],
                      }))
                    }
                    aria-expanded={groupOpen}
                  >
                    <span>{groupItem.label}</span>
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${groupOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {groupOpen || hasActiveSection ? (
                    <div className="mt-1 space-y-1">
                      {groupItem.sections.map((section) => {
                        const active = section.id === activeSettingsSection;
                        return (
                          <a
                            key={section.id}
                            href={`#${section.id}`}
                            className={`block rounded-lg px-2.5 py-2 text-sm font-bold transition ${
                              active
                                ? "bg-brand-600 text-white shadow-sm"
                                : "text-zani-subtle hover:bg-surface-warm hover:text-zani-text"
                            }`}
                            onClick={() => setActiveSettingsSection(section.id)}
                          >
                            {section.label}
                          </a>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>
      </Surface>
    </aside>
  );
}
