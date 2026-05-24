import fs from "node:fs";
import path from "node:path";

const i18nPath = path.resolve("src/lib/i18n.tsx");
const source = fs.readFileSync(i18nPath, "utf8");

function dictionaryBlock(name, nextName) {
  const start = source.indexOf(`const ${name}: Dictionary = {`);
  if (start === -1) throw new Error(`Dictionary ${name} not found.`);
  const end = nextName
    ? source.indexOf(`const ${nextName}: Dictionary = {`, start)
    : source.indexOf("const dictionaries", start);
  if (end === -1) throw new Error(`Dictionary ${name} end not found.`);
  return source.slice(start, end);
}

function parseDictionary(block) {
  return Object.fromEntries(
    [...block.matchAll(/"([^"]+)":\s*"((?:\\.|[^"])*)"/g)].map((match) => [match[1], match[2]]),
  );
}

const dictionaries = {
  ru: parseDictionary(dictionaryBlock("ru", "kk")),
  kk: parseDictionary(dictionaryBlock("kk", "en")),
  en: parseDictionary(dictionaryBlock("en")),
};

const allKeys = new Set(Object.values(dictionaries).flatMap((dictionary) => Object.keys(dictionary)));
const failures = [];

for (const [language, dictionary] of Object.entries(dictionaries)) {
  const missing = [...allKeys].filter((key) => !(key in dictionary));
  if (missing.length) {
    failures.push(`${language}: missing ${missing.length} keys: ${missing.slice(0, 20).join(", ")}`);
  }
}

if (failures.length) {
  console.error(`i18n dictionary parity failed:\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`i18n dictionary parity OK: ${allKeys.size} keys across ru/kk/en.`);
