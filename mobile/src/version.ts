export function compareAppVersions(left: string, right: string) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] || 0;
    const rightPart = rightParts[index] || 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

export function isAppVersionSupported(currentVersion: string, minSupportedVersion: string) {
  if (!minSupportedVersion) return true;
  return compareAppVersions(currentVersion, minSupportedVersion) >= 0;
}

function parseVersion(value: string) {
  return String(value || "")
    .split(".")
    .map((part) => Number.parseInt(part.replace(/\D+/g, ""), 10))
    .filter((part) => Number.isFinite(part));
}
