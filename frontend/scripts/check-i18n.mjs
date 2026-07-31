import fs from "node:fs";
import path from "node:path";

function dictionaryBlock(name) {
  const source = fs.readFileSync(path.resolve(`src/lib/i18n/${name}.ts`), "utf8");
  const start = source.indexOf(`export const ${name}: Record<string, string> = {`);
  if (start === -1) throw new Error(`Dictionary ${name} not found.`);
  const end = source.lastIndexOf("};");
  if (end === -1) throw new Error(`Dictionary ${name} end not found.`);
  return source.slice(start, end);
}

function parseDictionary(block) {
  return Object.fromEntries(
    [...block.matchAll(/^\s*"([^"]+)":/gm)].map((match) => [match[1], true]),
  );
}

const dictionaries = {
  ru: parseDictionary(dictionaryBlock("ru")),
  kk: parseDictionary(dictionaryBlock("kk")),
  en: parseDictionary(dictionaryBlock("en")),
};

const allKeys = new Set(Object.values(dictionaries).flatMap((dictionary) => Object.keys(dictionary)));
const failures = [];

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

for (const [language, dictionary] of Object.entries(dictionaries)) {
  const missing = [...allKeys].filter((key) => !(key in dictionary));
  if (missing.length) {
    failures.push(`${language}: missing ${missing.length} keys: ${missing.slice(0, 20).join(", ")}`);
  }
}

const referencedKeys = new Set();
for (const file of sourceFiles(path.resolve("src"))) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/\bt\(\s*["'`]([^"'`]+)["'`]/g)) {
    if (!match[1].includes("${")) referencedKeys.add(match[1]);
  }
}
const missingRuntimeKeys = [...referencedKeys].filter((key) => !(key in dictionaries.ru));
if (missingRuntimeKeys.length) {
  failures.push(`runtime: missing ${missingRuntimeKeys.length} referenced keys: ${missingRuntimeKeys.slice(0, 30).join(", ")}`);
}

if (failures.length) {
  console.error(`i18n dictionary parity failed:\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`i18n dictionary and runtime references OK: ${allKeys.size} keys across ru/kk/en.`);
