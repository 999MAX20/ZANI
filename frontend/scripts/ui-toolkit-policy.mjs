export function uploadPrerequisites(env) {
  if (!env.CHROMATIC_PROJECT_TOKEN?.trim()) {
    throw new Error("Set CHROMATIC_PROJECT_TOKEN in .env.chromatic.local; never send it in chat or use a VITE_ prefix.");
  }
  if (env.ZANI_ALLOW_VISUAL_UPLOAD !== "synthetic-only") {
    throw new Error("Review the synthetic-only catalogue, then explicitly set ZANI_ALLOW_VISUAL_UPLOAD=synthetic-only.");
  }
}

export function toolingEnvironment(env) {
  const allowed = new Set(["PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "SYSTEMDRIVE", "CI"]);
  return {
    ...Object.fromEntries(Object.entries(env).filter(([name]) => allowed.has(name.toUpperCase()))),
    STORYBOOK_DISABLE_TELEMETRY: "1",
    DO_NOT_TRACK: "1",
  };
}
