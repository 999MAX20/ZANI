'use strict';
// Read-only event adapter: no transcript, network, Git, process or state writes.
const fs = require('node:fs');
const path = require('node:path');

function normalized(value) {
  return path.win32.normalize(value.replace(/^\\\\\?\\/u, '')).toLowerCase();
}
function inside(root, cwd) {
  const relative = path.win32.relative(normalized(root), normalized(cwd));
  return relative !== '..' && !relative.startsWith('..\\') && !path.win32.isAbsolute(relative);
}
function validId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/u.test(value);
}
function canFinalizeRecordedHandoff(id, registry) {
  const handoff = registry.handoff;
  return registry.transition === 'awaiting_archive' && handoff &&
    Number.isSafeInteger(registry.generation) && registry.generation > 0 &&
    handoff.generation === registry.generation &&
    validId(handoff.sourceThreadId) && validId(handoff.successorThreadId) &&
    handoff.sourceThreadId !== handoff.successorThreadId &&
    handoff.successorThreadId === registry.successorThreadId &&
    handoff.successorThreadId === registry.primaryThreadId &&
    (registry.retiredThreadIds || []).includes(handoff.sourceThreadId) &&
    handoff.completionStatus === 'complete' && handoff.sourceDoDVerified === true &&
    handoff.comprehensionVerified === true &&
    (id === handoff.successorThreadId ||
      (validId(registry.orchestratorThreadId) && id === registry.orchestratorThreadId));
}
function result(eventName, context, stop = false) {
  const out = {hookSpecificOutput: {hookEventName: eventName, additionalContext: context}};
  if (stop) {
    out.continue = false;
    out.stopReason = 'This task is a retired project owner. Use the current primary task.';
    out.systemMessage = out.stopReason;
  }
  return out;
}
function buildResponse(event, registry) {
  const eventName = event.hook_event_name;
  if (!['SessionStart', 'UserPromptSubmit'].includes(eventName)) return {};
  if (registry.schemaVersion !== 1 || !validId(event.session_id) ||
      typeof event.cwd !== 'string' || typeof registry.canonicalRoot !== 'string' ||
      !inside(registry.canonicalRoot, event.cwd)) {
    return result(eventName, 'Project handoff metadata could not be validated. Stop project writes; verify canonical root, AGENTS.md and .codex/project-session.json. Do not create a successor or infer ownership.');
  }
  const id = event.session_id;
  const intro = 'Project ' + registry.projectName + '. Session ' + id + '. Read AGENTS.md, ' +
    registry.handoffPath + ', ' + registry.checkpointPath + ' and ' + registry.protocolPath +
    '. Recheck actual root, branch, HEAD, dirty ownership and evidence. Project folder grouping is not proof of shared memory. ';
  if ((registry.retiredThreadIds || []).includes(id)) {
    return result(eventName, intro + 'RETIRED OWNER. No product or Git writes. Continue in primary task ' + registry.primaryThreadId + '.',
      eventName === 'SessionStart');
  }
  if (canFinalizeRecordedHandoff(id, registry)) {
    return result(eventName, intro +
      'HANDOFF_FINALIZATION_ONLY. No product writes. You are the recorded validated successor or orchestrator for this same generation. ' +
      'Recheck completed source DoD, required checks/review/publication/actual CI and comprehension evidence; registry flags alone are not proof. ' +
      'Require native archive readback for the recorded source before an idempotent metadata-only release: clear the pending successor/transition and record the release once. ' +
      'Do not depend on the archived source resuming, create another task, archive a different task, increment generation again or infer a new work scope. ' +
      'Missing evidence or archive confirmation keeps the existing transition frozen. After release, wait for separately authorized work.');
  }
  if (id !== registry.primaryThreadId) {
    return result(eventName, intro + 'You are not the registered primary owner. Read-only comprehension/audit only unless the current user explicitly changes ownership. Do not rotate this task, create another primary, start product work or archive another task.');
  }
  if (registry.transition !== 'idle' || registry.successorThreadId) {
    return result(eventName, intro + 'HANDOFF_TRANSITION_IN_PROGRESS. No product writes and no new independent rollover. Read the existing transition and checkpoint; recover only that same handoff. If a successor is already recorded, reuse and inspect it, never create a duplicate. During initial bootstrap the orchestrator retains control; perform only the requested read-only comprehension.');
  }
  if (eventName === 'SessionStart' && event.source === 'compact') {
    return result(eventName, intro +
      'COMPACTION_RESTORE_CONTINUE. Restore the checkpoint, verify Git and evidence, then continue the same task within its existing authorization. ' +
      'Compaction and a nearly full context window never request creation, transfer or archival of tasks. Do not disable engine compaction. ' +
      'Defer any handoff until the entire agreed DoD, checks/review, required publication and actual CI are complete, operations have finished, and successor comprehension is verified. ' +
      'FAILED/BLOCKED/PENDING/unknown are unfinished: preserve the checkpoint and attempt limits, report the blocker, and never rotate to bypass it or split the agreed scope retroactively. ' +
      'This read-only hook neither verifies completion nor authorizes a handoff; do not bypass trust or replay completed work.');
  }
  return result(eventName, intro +
    'Maintain the existing task checkpoint after meaningful milestones and before handoff; do not wait for a full context window. ' +
    'On compaction or a nearly full context window, restore and continue in this task; never create, transfer or archive tasks for that reason. ' +
    'Handoff is deferred until the entire agreed DoD, checks/review, required publication/actual CI and operations are complete, followed by verified comprehension. ' +
    'FAILED/BLOCKED/PENDING/unknown never count as completion. Do not split the agreed scope to bypass this gate. ' +
    'One writer, unchanged task scope and acceptance criteria; no auto-next-phase. Preserve valid checks and failed-attempt counts. ' +
    'Only the recorded primary owns implementation; latest explicit stop/read-only instructions override automatic continuation.');
}
if (require.main === module) {
  try {
    const input = fs.readFileSync(0, 'utf8');
    if (input.length > 1024 * 1024) throw new Error('Hook payload too large');
    const event = JSON.parse(input);
    const registry = JSON.parse(fs.readFileSync(path.join(__dirname, 'project-session.json'), 'utf8'));
    process.stdout.write(JSON.stringify(buildResponse(event, registry)));
  } catch {
    process.stdout.write(JSON.stringify({
      systemMessage: 'Project continuity hook failed to read validated metadata. No files or tasks were changed. Check .codex/project-session.json; compaction never authorizes a handoff.'
    }));
  }
}
module.exports = {buildResponse, inside};
