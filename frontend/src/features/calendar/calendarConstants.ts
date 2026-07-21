export const dayStartHour = 8;
export const dayEndHour = 21;
export const hourHeight = 72;
export const timelineHours = Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, index) => dayStartHour + index);
export const viewModes = ["day", "week", "month", "list"] as const;

export const localeByLanguage = {
  ru: "ru-RU",
  kk: "kk-KZ",
  en: "en-US",
};
