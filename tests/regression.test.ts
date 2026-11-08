import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSuite, diffReports, compareRecordings, defineSuite, isJson, hasFields, forbid, createRedactor, stableStringify, suiteFromSpec } from '../src/index.ts';
import type { Recording } from '../src/index.ts';

const mkSuite = (app: (i: unknown) => string) =>
  defineSuite({
    name: 'support-bot',
    run: (input) => app(input),
    cases: [
      { id: 'refund', input: { q: 'refund for jane@example.com' }, metadata: { model: 'm1', promptVersion: 'v1' }, assertions: [isJson(), hasFields(['answer', 'action']), forbid({ competitor: /acme/i })] },
      { id: 'hours', input: { q: 'hours?' }, assertions: [isJson(), hasFields(['answer'])] },
    ],
  });

const good = (i: any) => JSON.stringify({ answer: `ok ${i.q}`, action: 'refund' });

test('record then replay is deterministic and byte-stable', async () => {
  const suite = mkSuite(good);
  const a = await runSuite(suite, { mode: 'record' });
  const b = await runSuite(suite, { mode: 'record' });
  assert.equal(stableStringify(a.recording), stableStringify(b.recording));
  const r1 = await runSuite(suite, { mode: 'replay', recording: a.recording });
  const r2 = await runSuite(suite, { mode: 'replay', recording: a.recording });
  assert.equal(stableStringify(r1.report), stableStringify(r2.report));
  assert.equal(r1.report.summary.cases.pass, 2);
});

test('replay never calls the application', async () => {
  const rec = (await runSuite(mkSuite(good), { mode: 'record' })).recording!;
  const exploding = mkSuite(() => { throw new Error('app must not run during replay'); });
  const { report } = await runSuite(exploding, { mode: 'replay', recording: rec });
  assert.equal(report.summary.cases.pass, 2);
});

test('recordings are redacted, including input hashes and outputs', async () => {
  const { recording } = await runSuite(mkSuite((i: any) => JSON.stringify({ answer: `hello ${i.q}`, action: 'x' })), { mode: 'record' });
  const text = stableStringify(recording);
  assert.ok(!text.includes('jane@example.com'));
  assert.ok(text.includes('[REDACTED:email]'));
  assert.ok(recording!.entries.every((e) => !('input' in e) && /^[0-9a-f]{64}$/.test(e.inputHash))); // raw input is never stored, only its hash
});

test('regression detection: pass -> fail and pass -> unevaluable, with fixes reported', async () => {
  const baseRec = (await runSuite(mkSuite(good), { mode: 'record' })).recording!;
  const base = (await runSuite(mkSuite(good), { mode: 'replay', recording: baseRec })).report;

  const bad = (i: any) => (i.q.startsWith('hours') ? 'Sorry, plain text now' : JSON.stringify({ answer: 'Try Acme instead', action: 'refund' }));
  const curRec = (await runSuite(mkSuite(bad), { mode: 'record' })).recording!;
  const cur = (await runSuite(mkSuite(bad), { mode: 'replay', recording: curRec })).report;

  const diff = diffReports(base, cur);
  const key = (c: any) => `${c.kind}:${c.caseId}:${c.assertionId ?? ''}`;
  const keys = diff.changes.map(key);
  assert.ok(keys.includes('regressed:refund:forbid(competitor)'));
  assert.ok(keys.includes('regressed:hours:is-json'));
  assert.ok(keys.includes('regressed:hours:has-fields(answer)')); // pass -> unevaluable
  assert.equal(diff.regressions, 3);
  assert.ok(keys.includes('output-changed:refund:'));
  assert.equal(diffReports(cur, base).changes.filter((c) => c.kind === 'fixed').length, 3);
});

test('output change with all assertions still passing is informational, not a regression', async () => {
  const mk = (s: string) => mkSuite(() => JSON.stringify({ answer: s, action: 'a' }));
  const r1 = await runSuite(mk('one'), { mode: 'record' });
  const r2 = await runSuite(mk('two'), { mode: 'record' });
  const d = diffReports((await runSuite(mk('one'), { recording: r1.recording! })).report, (await runSuite(mk('two'), { recording: r2.recording! })).report);
  assert.equal(d.regressions, 0);
  assert.ok(d.changes.every((c) => c.kind === 'output-changed'));
});

test('removed cases/assertions are surfaced so suites cannot be weakened silently', async () => {
  const full = (await runSuite(mkSuite(good), { mode: 'live' })).report;
  const weaker = { ...full, cases: [{ ...full.cases[0]!, assertions: full.cases[0]!.assertions.slice(0, 1) }] };
  const kinds = diffReports(full, weaker).changes.map((c) => c.kind);
  assert.ok(kinds.includes('removed'));
});

test('stale and missing recordings are unevaluable, never silently passing', async () => {
  const rec = (await runSuite(mkSuite(good), { mode: 'record' })).recording!;
  const changedInput = defineSuite({ name: 'support-bot', cases: [{ id: 'refund', input: { q: 'DIFFERENT' }, assertions: [isJson()] }, { id: 'brand-new', input: 1, assertions: [isJson()] }] });
  const { report } = await runSuite(changedInput, { recording: rec });
  assert.deepEqual(report.cases.map((c) => c.status), ['unevaluable', 'unevaluable']);
  assert.match(report.cases[0]!.assertions[0]!.message!, /stale/);
  assert.match(report.cases[1]!.assertions[0]!.message!, /no recording/);
});

test('application errors in record mode become unevaluable', async () => {
  const { report } = await runSuite(mkSuite(() => { throw new Error('upstream 500'); }), { mode: 'record' });
  assert.equal(report.summary.cases.unevaluable, 2);
});

test('saved responses on cases give deterministic tests with no recording', async () => {
  const suite = defineSuite({ name: 's', cases: [{ id: 'c', input: 'x', output: '{"a":1}', assertions: [hasFields(['a'])] }] });
  assert.equal((await runSuite(suite)).report.summary.cases.pass, 1);
});

test('duplicate case ids are rejected', async () => {
  const suite = defineSuite({ name: 's', cases: [{ id: 'c', input: 1, output: '1', assertions: [] }, { id: 'c', input: 2, output: '2', assertions: [] }] });
  await assert.rejects(() => runSuite(suite), /duplicate case id/);
});

test('compare: same assertions across two prompt versions, text drift separated from assertion results', async () => {
  const suite = mkSuite(good);
  const a = (await runSuite(mkSuite((i: any) => JSON.stringify({ answer: 'Refund issued today', action: 'refund' })), { mode: 'record' })).recording! as Recording;
  const b = (await runSuite(mkSuite(() => JSON.stringify({ answer: 'Refund issued today', action: 'refund' }).replace('today', 'now')), { mode: 'record' })).recording!;
  const cmp = await compareRecordings(suite, a, b);
  assert.equal(cmp.cases[0]!.exactTextMatch, false);
  assert.ok(cmp.cases[0]!.lexicalSimilarity! > 0.5);
  assert.equal(cmp.diff.regressions, 0);
});

test('declarative JSON suites build the same assertions', async () => {
  const suite = suiteFromSpec({
    name: 'json-suite',
    cases: [{ id: 'c', input: 'q', output: '{"age":5}', assertions: [{ type: 'is-json' }, { type: 'field-type', field: 'age', is: 'integer' }, { type: 'field-constraint', field: 'age', max: 3 }] }],
  });
  const { report } = await runSuite(suite);
  assert.deepEqual(report.cases[0]!.assertions.map((a) => a.status), ['pass', 'pass', 'fail']);
  assert.throws(() => suiteFromSpec({ name: 'x', cases: [{ id: 'c', input: 1, assertions: [{ type: 'semantic' } as never] }] }), /JS\/TS suite/);
});

test('redactor option applies to suite-level custom patterns', async () => {
  const suite = defineSuite({ name: 's', redact: { patterns: [{ name: 'acct', pattern: /ACCT\d+/g }] }, run: () => 'acct ACCT12345', cases: [{ id: 'c', input: 'ACCT999', assertions: [] }] });
  const { recording } = await runSuite(suite, { mode: 'record' });
  assert.ok(!stableStringify(recording).includes('ACCT12345'));
  void createRedactor;
});
