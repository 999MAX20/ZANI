import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { fb010CriticalJourneys } from "../e2e/certification/failure-certification-registry.mjs";
import { pilotMerchantJourneys } from "../e2e/certification/merchant-journey-registry.mjs";
import { routeActionRegistry } from "../e2e/certification/route-action-registry.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(scriptDir, "..", "..");
const expectedJourneyIds = fb010CriticalJourneys.map((journey) => journey.id);
const allowedStatuses = new Set(["PASS", "BLOCKED", "EXCLUDED"]);

function verifyEvidence(errors, journey, evidence, kind) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    errors.push(`${journey.id} has no ${kind} evidence`);
    return;
  }
  for (const item of evidence) {
    if (!item?.file || !item?.marker) {
      errors.push(`${journey.id} has incomplete ${kind} evidence`);
      continue;
    }
    const evidencePath = path.join(repoDir, item.file);
    if (!fs.existsSync(evidencePath)) {
      errors.push(`${journey.id} references missing evidence file ${item.file}`);
      continue;
    }
    const source = fs.readFileSync(evidencePath, "utf8");
    if (!source.includes(item.marker)) {
      errors.push(`${journey.id} evidence marker is missing from ${item.file}: ${item.marker}`);
    }
  }
}

export function verifyMerchantJourneyCertification() {
  const errors = [];
  const registeredRouteIds = new Set(routeActionRegistry.map((entry) => entry.id));
  const journeyIds = pilotMerchantJourneys.map((journey) => journey.id);

  if (new Set(journeyIds).size !== journeyIds.length) {
    errors.push("merchant journey registry contains duplicate ids");
  }
  if (journeyIds.length !== expectedJourneyIds.length) {
    errors.push(`expected ${expectedJourneyIds.length} journeys, found ${journeyIds.length}`);
  }
  for (const id of expectedJourneyIds) {
    if (!journeyIds.includes(id)) errors.push(`missing journey ${id}`);
  }
  for (const id of journeyIds) {
    if (!expectedJourneyIds.includes(id)) errors.push(`unexpected journey ${id}`);
  }

  for (const journey of pilotMerchantJourneys) {
    if (!journey.title) errors.push(`${journey.id} has no title`);
    if (!allowedStatuses.has(journey.status)) {
      errors.push(`${journey.id} has invalid status ${journey.status}`);
    }
    if (!journey.roles?.length) errors.push(`${journey.id} has no roles`);
    if (!journey.persistenceEntities?.length) {
      errors.push(`${journey.id} has no persistence entities`);
    }
    if (!journey.routeIds?.length) errors.push(`${journey.id} has no route ids`);
    for (const routeId of journey.routeIds || []) {
      if (!registeredRouteIds.has(routeId)) {
        errors.push(`${journey.id} references unknown route id ${routeId}`);
      }
    }
    verifyEvidence(errors, journey, journey.browserEvidence, "browser");
    verifyEvidence(errors, journey, journey.backendEvidence, "backend");
  }

  const passing = pilotMerchantJourneys.filter((journey) => journey.status === "PASS").length;
  if (passing !== pilotMerchantJourneys.length) {
    errors.push(`only ${passing}/${pilotMerchantJourneys.length} journeys are marked PASS`);
  }
  if (errors.length) {
    throw new Error(`Merchant journey certification is invalid:\n- ${errors.join("\n- ")}`);
  }
  return { journeys: pilotMerchantJourneys.length, passing };
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (invokedPath === import.meta.url) {
  const result = verifyMerchantJourneyCertification();
  console.log(
    `Merchant journey certification OK: ${result.passing}/${result.journeys} journeys have browser, backend and persistence evidence.`,
  );
}
