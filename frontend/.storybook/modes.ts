// Names are stable Chromatic baseline identifiers. No paid browser modes.
export const catalogModes = Object.fromEntries(
  ["ru", "kk", "en"].flatMap((locale) => [
    [`${locale} desktop`, { locale, viewport: { width: 1440, height: 1000 } }],
    [`${locale} mobile`, { locale, viewport: { width: 390, height: 844 } }],
  ]),
);
