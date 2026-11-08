import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CLI = resolve('dist/cli.js');
const INDEX = resolve('dist/index.js');
const sh = (cwd: string, ...args: string[]) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: { PATH: process.env.PATH ?? '' } });
  return { code: r.status, out: r.stdout, err: r.stderr };
};
const tmp = () => mkdtempSync(join(tmpdir(), 'm2aitestkit-'));
const writeSuite = (dir: string, output: string, name = 'demo') =>
  writeFileSync(join(dir, `${name}.aitest.json`), JSON.stringify({
    name,
    cases: [{ id: 'c1', input: 'q', output, assertions: [{ type: 'is-json' }, { type: 'required-fields', fields: ['answer'] }, { type: 'forbid', rules: { secret: 'hunter2' } }] }],
  }));

test('exit 0 when everything passes', () => {
  const d = tmp(); writeSuite(d, '{"answer":"hi"}');
  const r = sh(d, 'run', '.');
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /3 passed/);
});

test('exit 1 on failed assertion, and the report does not echo output values', () => {
  const d = tmp(); writeSuite(d, '{"answer":"my password is hunter2 and jane@example.com"}');
  const r = sh(d, 'run', '.');
  assert.equal(r.code, 1);
  assert.match(r.out, /secret/);
  assert.ok(!r.out.includes('hunter2') && !r.out.includes('jane@example.com'));
  const j = sh(d, 'run', '.', '--format', 'json');
  assert.ok(!j.out.includes('hunter2') && !j.out.includes('jane@example.com'));
});

test('exit 3 for unevaluable-only (malformed JSON), 0 with --allow-unevaluable... but is-json itself fails', () => {
  const d = tmp();
  writeFileSync(join(d, 'x.aitest.json'), JSON.stringify({ name: 'x', cases: [{ id: 'c', input: 1, output: '{bad', assertions: [{ type: 'required-fields', fields: ['a'] }] }] }));
  assert.equal(sh(d, 'run', '.').code, 3);
  assert.equal(sh(d, 'run', '.', '--allow-unevaluable').code, 0);
  writeSuite(d, '{bad', 'y');
  assert.equal(sh(d, 'run', '.', '--allow-unevaluable').code, 1); // is-json fail
});

test('exit 2 on usage and load errors', () => {
  const d = tmp();
  assert.equal(sh(d, 'bogus').code, 2);
  assert.equal(sh(d, 'run', 'missing-dir').code, 2);
  assert.equal(sh(d, 'run', '.', '--format', 'xml').code, 2);
  writeFileSync(join(d, 'bad.aitest.json'), '{not json');
  assert.equal(sh(d, 'run', '.').code, 2);
  assert.equal(sh(d).code, 2);
  assert.equal(sh(d, '--help').code, 0);
});

test('baseline workflow: update, then block a regression in CI', () => {
  const d = tmp(); writeSuite(d, '{"answer":"hi"}');
  assert.equal(sh(d, 'run', '.', '--update-baseline').code, 0);
  assert.ok(existsSync(join(d, '.m2aitestkit/baselines/demo.json')));
  assert.equal(sh(d, 'run', '.').code, 0);
  writeSuite(d, '{"nothing":"here"}');
  const r = sh(d, 'run', '.');
  assert.equal(r.code, 1);
  assert.match(r.out, /REGRESSED\s+c1 :: has|REGRESSED\s+c1 :: required|REGRESSED/);
  assert.match(r.out, /1 regression/);
});

test('JSON output is machine-readable and byte-stable across runs; junit is well-formed', () => {
  const d = tmp(); writeSuite(d, '{"answer":"hi"}');
  const a = sh(d, 'run', '.', '--format', 'json').out;
  const b = sh(d, 'run', '.', '--format', 'json').out;
  assert.equal(a, b);
  assert.equal(JSON.parse(a).reports[0].report.summary.assertions.pass, 3);
  const x = sh(d, 'run', '.', '--format', 'junit').out;
  assert.match(x, /^<\?xml/); assert.match(x, /<testsuite name="demo" tests="3" failures="0" errors="0">/);
  sh(d, 'run', '.', '--format', 'json', '--output', 'out.json');
  assert.equal(JSON.parse(readFileSync(join(d, 'out.json'), 'utf8')).reports.length, 1);
});

const appSuite = (d: string, reply: string, file = 'app.aitest.mjs') =>
  writeFileSync(join(d, file), `
import { defineSuite, isJson, hasFields } from ${JSON.stringify(INDEX)};
export default defineSuite({
  name: 'app',
  run: () => ${JSON.stringify(reply)},
  cases: [{ id: 'c', input: { email: 'jane@example.com' }, assertions: [isJson(), hasFields(['answer'])] }],
});`);

test('record then replay offline: recording is redacted and replay does not call the app', () => {
  const d = tmp();
  appSuite(d, '{"answer":"contact bob@corp.com"}');
  assert.equal(sh(d, 'record', '.').code, 0);
  const rec = readFileSync(join(d, '.m2aitestkit/recordings/app.json'), 'utf8');
  assert.ok(!rec.includes('bob@corp.com') && !rec.includes('jane@example.com'));
  // change the app so that a live call would now fail; replay must still pass
  appSuite(d, 'not json at all');
  assert.equal(sh(d, 'run', '.').code, 0);
  assert.equal(sh(d, 'run', '.', '--live').code, 1);
});

test('--no-redact keeps raw values; compare reports regressions between two recordings', () => {
  const d = tmp();
  appSuite(d, '{"answer":"bob@corp.com"}');
  sh(d, 'record', '.', '--no-redact');
  assert.ok(readFileSync(join(d, '.m2aitestkit/recordings/app.json'), 'utf8').includes('bob@corp.com'));
  writeFileSync(join(d, 'a.json'), readFileSync(join(d, '.m2aitestkit/recordings/app.json')));
  appSuite(d, '{"nope":1}');
  sh(d, 'record', '.');
  writeFileSync(join(d, 'b.json'), readFileSync(join(d, '.m2aitestkit/recordings/app.json')));
  const r = sh(d, 'compare', 'app.aitest.mjs', '--a', 'a.json', '--b', 'b.json');
  assert.equal(r.code, 1, r.out + r.err);
  assert.match(r.out, /do not measure correctness/);
  assert.match(r.out, /REGRESSED/);
  assert.equal(sh(d, 'compare', 'app.aitest.mjs', '--a', 'a.json', '--b', 'a.json').code, 0);
});

test('CI: runs in an environment with no API keys and writes nothing outside the working dir', () => {
  const d = tmp(); writeSuite(d, '{"answer":"hi"}');
  const r = spawnSync(process.execPath, [CLI, 'run', '.', '--update-baseline'], { cwd: d, encoding: 'utf8', env: {} });
  assert.equal(r.status, 0);
  assert.deepEqual(readdirSync(d).sort(), ['.m2aitestkit', 'demo.aitest.json']);
});

test('shipped examples run', () => {
  const ex = resolve('examples/basic');
  const d = tmp();
  const r = spawnSync(process.execPath, [CLI, 'record', ex, '--recordings-dir', join(d, 'rec')], { cwd: d, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const run = spawnSync(process.execPath, [CLI, 'run', ex, '--recordings-dir', join(d, 'rec')], { cwd: d, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const nt = spawnSync(process.execPath, ['--test', join(ex, 'node-test.example.mjs')], { encoding: 'utf8' });
  assert.equal(nt.status, 0, nt.stdout);
});
