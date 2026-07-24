import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const assetsDir = path.resolve(
  process.env.BUNDLE_ASSETS_DIR || "dist/assets",
);
const warningLimitKb = 500;
const appShellLimitKb = 400;

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

if (!fs.existsSync(assetsDir)) {
  console.error("Bundle assets not found. Run `npm run build` before `npm run check:bundle`.");
  process.exit(1);
}

const chunks = fs
  .readdirSync(assetsDir)
  .filter((file) => file.endsWith(".js"))
  .map((file) => {
    const absolutePath = path.join(assetsDir, file);
    const source = fs.readFileSync(absolutePath);
    return {
      file,
      size: source.length,
      gzipSize: zlib.gzipSync(source).length,
    };
  })
  .sort((a, b) => b.size - a.size);

const largest = chunks.slice(0, 12);
const oversized = chunks.filter((chunk) => chunk.size > warningLimitKb * 1024);
const appShellChunks = chunks.filter((chunk) =>
  chunk.file.startsWith("app-shell-"),
);

console.log("Largest JS chunks after production build:");
for (const chunk of largest) {
  console.log(`- ${chunk.file}: ${formatKb(chunk.size)} / gzip ${formatKb(chunk.gzipSize)}`);
}

if (oversized.length) {
  console.warn(`Bundle warning: ${oversized.length} JS chunk(s) exceed ${warningLimitKb} kB before gzip.`);
  for (const chunk of oversized) {
    console.warn(`- ${chunk.file}: ${formatKb(chunk.size)} / gzip ${formatKb(chunk.gzipSize)}`);
  }
} else {
  console.log(`Bundle check OK: no JS chunks exceed ${warningLimitKb} kB before gzip.`);
}

if (appShellChunks.length !== 1) {
  console.error(
    `App shell budget failed: expected exactly one app-shell-* JS chunk, found ${appShellChunks.length}.`,
  );
  for (const chunk of appShellChunks) {
    console.error(
      `- ${chunk.file}: ${formatKb(chunk.size)} / gzip ${formatKb(chunk.gzipSize)}`,
    );
  }
  process.exitCode = 1;
} else if (appShellChunks[0].size > appShellLimitKb * 1024) {
  const chunk = appShellChunks[0];
  console.error(
    `App shell budget failed: ${chunk.file} exceeds ${appShellLimitKb} kB before gzip.`,
  );
  console.error(
    `- ${chunk.file}: ${formatKb(chunk.size)} / gzip ${formatKb(chunk.gzipSize)}`,
  );
  process.exitCode = 1;
} else {
  const chunk = appShellChunks[0];
  console.log(
    `App shell budget OK: ${chunk.file} is within ${appShellLimitKb} kB before gzip.`,
  );
}
