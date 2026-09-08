import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  createFb010Matrix,
  fb010CriticalJourneys,
  fb010FailureStates,
  fb010MerchantRoles,
  fb010ViewportProjects,
} from "../e2e/certification/failure-certification-registry.mjs";
import { routeActionRegistry } from "../e2e/certification/route-action-registry.mjs";
import { apiModulePolicies } from "../e2e/fallback/fallback-registry.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const expectedStateIds = [
  "success",
  "empty",
  "validation",
  "permission",
  "not_found",
  "conflict",
  "rate_limit",
  "offline",
  "temporary",
  "provider",
  "session_expiry",
  "unexpected",
];

const expectedViewportProjects = ["desktop-chromium", "mobile-chromium"];

function sameValues(actual, expected) {
  return (
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === [...expected].sort()[index])
  );
}

function evidencePath(rootDir, evidence) {
  return evidence.startsWith("apps/")
    ? path.join(path.resolve(rootDir, ".."), evidence)
    : path.join(rootDir, evidence);
}

export function verifyFailureCertification({ rootDir = frontendDir } = {}) {
  const errors = [];
  const routeIds = new Set(routeActionRegistry.map((entry) => entry.id));
  const roleSet = new Set(fb010MerchantRoles);
  const stateIds = fb010FailureStates.map((state) => state.id);
  const journeyIds = new Set();

  if (fb010CriticalJourneys.length !== 10) {
    errors.push(`expected 10 critical journeys, found ${fb010CriticalJourneys.length}`);
  }
  if (!sameValues(stateIds, expectedStateIds)) {
    errors.push(`failure states differ from FB-010: ${stateIds.join(", ")}`);
  }
  if (!sameValues(fb010ViewportProjects, expectedViewportProjects)) {
    errors.push(`viewport projects must be desktop and mobile: ${fb010ViewportProjects.join(", ")}`);
  }

  for (const state of fb010FailureStates) {
    if (!state.expectedSurface || !state.recovery) {
      errors.push(`state ${state.id} is missing a surface or recovery contract`);
    }
  }

  for (const journey of fb010CriticalJourneys) {
    if (journeyIds.has(journey.id)) errors.push(`duplicate journey id: ${journey.id}`);
    journeyIds.add(journey.id);

    if (!journey.roles.length) errors.push(`${journey.id} has no applicable roles`);
    if (!sameValues(journey.viewports, expectedViewportProjects)) {
      errors.push(`${journey.id} does not cover desktop and mobile`);
    }
    for (const role of journey.roles) {
      if (!roleSet.has(role)) errors.push(`${journey.id} uses unknown role ${role}`);
    }
    for (const routeId of journey.routeIds) {
      if (!routeIds.has(routeId)) errors.push(`${journey.id} references unknown route ${routeId}`);
    }
    for (const apiModule of journey.apiModules) {
      if (!(apiModule in apiModulePolicies)) {
        errors.push(`${journey.id} references unknown API module ${apiModule}`);
      }
    }
    for (const evidence of [...journey.browserEvidence, ...journey.backendEvidence]) {
      if (!fs.existsSync(evidencePath(rootDir, evidence))) {
        errors.push(`${journey.id} references missing evidence ${evidence}`);
      }
    }
  }

  const coveredRoles = new Set(fb010CriticalJourneys.flatMap((journey) => journey.roles));
  for (const role of fb010MerchantRoles) {
    if (!coveredRoles.has(role)) errors.push(`no critical journey covers role ${role}`);
  }

  const matrix = createFb010Matrix();
  const matrixIds = new Set(matrix.map((cell) => cell.id));
  const expectedCells = fb010CriticalJourneys.reduce(
    (count, journey) => count + journey.roles.length * expectedViewportProjects.length * expectedStateIds.length,
    0,
  );
  if (matrix.length !== expectedCells) {
    errors.push(`matrix has ${matrix.length} cells, expected ${expectedCells}`);
  }
  if (matrixIds.size !== matrix.length) errors.push("matrix contains duplicate cell ids");

  for (const cell of matrix) {
    if (!cell.browserEvidence.includes("e2e/failure-certification.spec.ts")) {
      errors.push(`${cell.id} is missing the FB-010 browser evidence`);
    }
    if (!cell.backendEvidence.includes("apps/core/tests_tenant_isolation.py")) {
      errors.push(`${cell.id} is missing tenant-isolation evidence`);
    }
  }

  if (errors.length) {
    throw new Error(`FB-010 failure certification registry is invalid:\n- ${errors.join("\n- ")}`);
  }

  return {
    journeys: fb010CriticalJourneys.length,
    roles: fb010MerchantRoles.length,
    states: fb010FailureStates.length,
    viewports: fb010ViewportProjects.length,
    cells: matrix.length,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const result = verifyFailureCertification();
  console.log(
    `FB-010 registry OK: ${result.cells} cells across ${result.journeys} journeys, ` +
      `${result.roles} merchant roles, ${result.states} states and ${result.viewports} viewports.`,
  );
}
