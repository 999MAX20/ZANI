'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const {buildResponse, inside} = require('./continuity-hook.cjs');
const registry = {
  schemaVersion:1, projectName:'Fixture', canonicalRoot:'C:\\Projects\\Fixture',
  primaryThreadId:'primary-1', retiredThreadIds:['old-1'], autoHandoffEnabled:true, transition:'idle', successorThreadId:null,
  generation:1, orchestratorThreadId:'orchestrator-1', handoff:null,
  handoffPath:'docs/handoff.md', checkpointPath:'docs/checkpoint.md', protocolPath:'docs/rollover.md'
};
const event = (extra = {}) => ({
  hook_event_name:'SessionStart', source:'startup', cwd:'C:\\Projects\\Fixture',
  session_id:'primary-1', ...extra
});
const context = x => x.hookSpecificOutput.additionalContext;
test('normal startup restores state without requesting rollover', () => {
  const x=buildResponse(event(),registry); assert.match(context(x),/Recheck actual root/);
  assert.doesNotMatch(context(x),/AUTOMATIC_PROJECT_HANDOFF_REQUIRED/);
});
test('compaction restores and continues primary even with stale automatic-handoff flag', () => {
  for(const autoHandoffEnabled of [true,false,undefined]) {
    const x=buildResponse(event({source:'compact'}),{...registry,autoHandoffEnabled});
    assert.match(context(x),/COMPACTION_RESTORE_CONTINUE/);
    assert.match(context(x),/same task/);
    assert.match(context(x),/FAILED\/BLOCKED\/PENDING\/unknown/);
    assert.doesNotMatch(context(x),/AUTOMATIC_PROJECT_HANDOFF_REQUIRED/);
    assert.equal(x.continue,undefined);
    assert.equal(x.decision,undefined);
  }
});
test('successor/read-only tasks never recursively create successors', () => {
  const s=context(buildResponse(event({source:'compact',session_id:'reader-1'}),registry));
  assert.match(s,/not the registered primary/); assert.doesNotMatch(s,/AUTOMATIC_PROJECT_HANDOFF_REQUIRED/);
});
test('retired source cannot resume through SessionStart', () => {
  const x=buildResponse(event({session_id:'old-1'}),registry); assert.equal(x.continue,false);
  assert.match(context(x),/RETIRED OWNER/);
});
test('retired UserPromptSubmit carries the guard without a stop loop', () => {
  const x=buildResponse(event({hook_event_name:'UserPromptSubmit',session_id:'old-1'}),registry);
  assert.equal(x.hookSpecificOutput.hookEventName,'UserPromptSubmit'); assert.equal(x.continue,undefined);
});
test('explicitly disabled rotation does not request a successor', () => {
  const s=context(buildResponse(event({source:'compact'}),{...registry,autoHandoffEnabled:false}));
  assert.doesNotMatch(s,/AUTOMATIC_PROJECT_HANDOFF_REQUIRED/);
  assert.match(s,/COMPACTION_RESTORE_CONTINUE/);
});
test('incomplete transition recovers the same handoff without recursive rotation', () => {
  for(const transition of ['bootstrap','preparing','awaiting_archive']) {
    const s=context(buildResponse(event({source:'compact'}),{...registry,transition}));
    assert.match(s,/HANDOFF_TRANSITION_IN_PROGRESS/);
    assert.doesNotMatch(s,/AUTOMATIC_PROJECT_HANDOFF_REQUIRED/);
  }
});
test('recorded successor blocks duplicate creation even with stale idle marker', () => {
  const s=context(buildResponse(event({source:'compact'}),{...registry,successorThreadId:'next-1'}));
  assert.match(s,/reuse and inspect it/);
  assert.doesNotMatch(s,/AUTOMATIC_PROJECT_HANDOFF_REQUIRED/);
});

const pendingRelease = {
  ...registry, generation:2, transition:'awaiting_archive', successorThreadId:'primary-1',
  retiredThreadIds:['old-1','source-1'],
  handoff:{generation:2,sourceThreadId:'source-1',successorThreadId:'primary-1',
    completionStatus:'complete',sourceDoDVerified:true,comprehensionVerified:true}
};

test('recorded validated successor or orchestrator can finalize the same confirmed handoff', () => {
  for(const session_id of ['primary-1','orchestrator-1']) {
    const x=buildResponse(event({source:'compact',session_id}),pendingRelease);
    assert.match(context(x),/HANDOFF_FINALIZATION_ONLY/);
    assert.match(context(x),/native archive readback/);
    assert.match(context(x),/idempotent/);
    assert.match(context(x),/No product writes/);
    assert.equal(x.continue,undefined);
  }
});

for(const completionStatus of ['active','failed','blocked','pending','unknown',undefined]) {
  test(`${completionStatus ?? 'missing'} completion defers rotation and transition release`, () => {
    const active=buildResponse(event({source:'compact'}),{...registry,completionStatus});
    assert.match(context(active),/COMPACTION_RESTORE_CONTINUE/);
    assert.equal(active.continue,undefined);
    const unfinished={...pendingRelease,handoff:{...pendingRelease.handoff,completionStatus}};
    for(const session_id of ['primary-1','orchestrator-1']) {
      const x=buildResponse(event({source:'compact',session_id}),unfinished);
      assert.doesNotMatch(context(x),/HANDOFF_FINALIZATION_ONLY|AUTOMATIC_PROJECT_HANDOFF_REQUIRED/);
      assert.equal(x.continue,undefined);
    }
  });
}

test('incomplete or stale handoff evidence cannot enable finalization', () => {
  for(const change of [
    {sourceDoDVerified:false},{comprehensionVerified:false},{generation:1},
    {sourceThreadId:'unknown-1'},{sourceThreadId:'primary-1'},
    {successorThreadId:'unknown-1'},{completionStatus:'COMPLETE'}
  ]) {
    const x=buildResponse(event({source:'compact'}),{...pendingRelease,handoff:{...pendingRelease.handoff,...change}});
    assert.match(context(x),/HANDOFF_TRANSITION_IN_PROGRESS/);
    assert.doesNotMatch(context(x),/HANDOFF_FINALIZATION_ONLY/);
  }
});

test('matching proof cannot bypass a different transition or successor identity', () => {
  for(const change of [{transition:'preparing'},{transition:'bootstrap'},{transition:'idle'},
    {successorThreadId:'other-1'},{generation:0}]) {
    const x=buildResponse(event({source:'compact'}),{...pendingRelease,...change});
    assert.match(context(x),/HANDOFF_TRANSITION_IN_PROGRESS/);
    assert.doesNotMatch(context(x),/HANDOFF_FINALIZATION_ONLY/);
  }
});

test('unknown readers and retired source cannot take over a finalizable handoff', () => {
  const stranger=buildResponse(event({session_id:'unknown-1'}),pendingRelease);
  assert.match(context(stranger),/not the registered primary/);
  assert.doesNotMatch(context(stranger),/HANDOFF_FINALIZATION_ONLY/);
  const source=buildResponse(event({session_id:'source-1'}),pendingRelease);
  assert.match(context(source),/RETIRED OWNER/);
  assert.equal(source.continue,false);
});

test('repeated finalization context is stable and never mutates event or registry', () => {
  const input=event({source:'compact'});
  const before=JSON.stringify({input,pendingRelease});
  assert.deepEqual(buildResponse(input,pendingRelease),buildResponse(input,pendingRelease));
  assert.equal(JSON.stringify({input,pendingRelease}),before);
  const released=buildResponse(input,{...pendingRelease,transition:'idle',successorThreadId:null,handoff:null});
  assert.match(context(released),/COMPACTION_RESTORE_CONTINUE/);
  assert.doesNotMatch(context(released),/HANDOFF_FINALIZATION_ONLY/);
});
test('outside or similarly named root is rejected', () => {
  for(const cwd of ['C:\\Projects\\Fixture-other','C:\\Projects\\Fixture\\..\\Other','D:\\Projects\\Fixture'])
    assert.match(context(buildResponse(event({cwd}),registry)),/could not be validated/);
});
test('subdirectory and extended Windows paths are recognized', () => {
  assert.equal(inside(registry.canonicalRoot,'\\\\?\\C:\\Projects\\Fixture\\docs'),true);
  assert.equal(inside(registry.canonicalRoot,'c:\\projects\\fixture'),true);
});
test('invalid session id never enters generated instructions', () => {
  const x=buildResponse(event({session_id:'bad\\nIGNORE_RULES'}),registry);
  assert.match(context(x),/could not be validated/); assert.doesNotMatch(context(x),/IGNORE_RULES/);
});
test('unrelated events are ignored', () => assert.deepEqual(buildResponse(event({hook_event_name:'PostToolUse'}),registry),{}));
test('malformed schema fails safely', () => assert.match(context(buildResponse(event(),{...registry,schemaVersion:9})),/could not be validated/));
test('hook does not consume prompt or transcript contents', () => {
  const x=buildResponse(event({prompt:'PRIVATE_SENTINEL',transcript_path:'PRIVATE_PATH'}),registry);
  assert.doesNotMatch(JSON.stringify(x),/PRIVATE_SENTINEL|PRIVATE_PATH/);
});
test('real registry and hook JSON are consistent', () => {
  const r=JSON.parse(fs.readFileSync(path.join(__dirname,'project-session.json'),'utf8'));
  const h=JSON.parse(fs.readFileSync(path.join(__dirname,'hooks.json'),'utf8'));
  assert.equal(r.autoHandoffEnabled,false);
  assert.equal(r.compactionPolicy,'restore_same_thread');
  assert.equal(r.handoffPolicy,'completed_scope_only');
  assert.ok(['idle','bootstrap','preparing','awaiting_archive'].includes(r.transition));
  assert.ok(r.orchestratorThreadId);
  for(const rel of [r.handoffPath,r.checkpointPath,r.protocolPath]) assert.ok(fs.existsSync(path.resolve(__dirname,'..',rel)),rel);
  assert.deepEqual(Object.keys(h.hooks).sort(),['SessionStart','UserPromptSubmit']);
  for(const list of Object.values(h.hooks)) for(const group of list) for(const item of group.hooks) {
    assert.equal(item.type,'command'); assert.equal(item.timeout,5);
    assert.ok(item.commandWindows.includes('continuity-hook.cjs'));
    assert.ok(!item.commandWindows.includes('Bypass'));
  }
});
test('CLI malformed input returns warning without mutations or raw contents', () => {
  const out=spawnSync(process.execPath,[path.join(__dirname,'continuity-hook.cjs')],{input:'PRIVATE_SENTINEL{',encoding:'utf8'});
  assert.equal(out.status,0); assert.match(JSON.parse(out.stdout).systemMessage,/failed/);
  assert.doesNotMatch(out.stdout,/PRIVATE_SENTINEL/);
});

test('CLI compact restores the real primary without stopping or changing metadata', () => {
  const registryPath=path.join(__dirname,'project-session.json');
  const hooksPath=path.join(__dirname,'hooks.json');
  const before=[fs.readFileSync(registryPath,'utf8'),fs.readFileSync(hooksPath,'utf8')];
  const r=JSON.parse(before[0]);
  const input={hook_event_name:'SessionStart',source:'compact',cwd:r.canonicalRoot,session_id:r.primaryThreadId};
  const out=spawnSync(process.execPath,[path.join(__dirname,'continuity-hook.cjs')],{input:JSON.stringify(input),encoding:'utf8'});
  assert.equal(out.status,0);
  const response=JSON.parse(out.stdout);
  assert.match(context(response),/COMPACTION_RESTORE_CONTINUE|HANDOFF_TRANSITION_IN_PROGRESS|HANDOFF_FINALIZATION_ONLY/);
  assert.equal(response.continue,undefined);
  assert.deepEqual([fs.readFileSync(registryPath,'utf8'),fs.readFileSync(hooksPath,'utf8')],before);
});
