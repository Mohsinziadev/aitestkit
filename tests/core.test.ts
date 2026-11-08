import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  isJson, matchesSchema, hasFields, fieldType, fieldConstraint, onlyFields, equalsJson, forbid, toolCalls,
  refusal, restrictFormat, custom, semantic, similarTo, defineEvaluator, evaluateOutput, assertOutput,
  M2AITestKitAssertionError, createRedactor, type Assertion,
} from '../src/index.ts';

const run = async (text: string | object, assertions: Assertion[], extra: object = {}) =>
  evaluateOutput(assertions, typeof text === 'string' ? { text, ...extra } : (text as never), undefined);
const statuses = (rs: { status: string }[]) => rs.map((r) => r.status);

test('valid structured output passes', async () => {
  const rs = await run('{"name":"Ada","age":36,"tags":["a"]}', [
    isJson(), hasFields(['name', 'tags[0]']), fieldType('age', 'integer'),
    fieldConstraint('age', { min: 0, max: 150 }), onlyFields(['name', 'age', 'tags']),
  ]);
  assert.deepEqual(statuses(rs), ['pass', 'pass', 'pass', 'pass', 'pass']);
});

test('malformed JSON fails is-json and makes dependent checks unevaluable, not pass', async () => {
  const rs = await run('{"name": "Ada",', [isJson(), hasFields(['name']), matchesSchema({ type: 'object' })]);
  assert.deepEqual(statuses(rs), ['fail', 'unevaluable', 'unevaluable']);
});

test('missing fields and wrong types fail with messages that omit values', async () => {
  const rs = await run('{"age":"secret-value"}', [hasFields(['name', 'age']), fieldType('age', 'number')]);
  assert.deepEqual(statuses(rs), ['fail', 'fail']);
  assert.match(rs[0]!.message!, /name/);
  for (const r of rs) assert.doesNotMatch(r.message!, /secret-value/);
});

test('constraints: range, enum, pattern, length', async () => {
  const rs = await run('{"n":200,"c":"purple","s":"abc"}', [
    fieldConstraint('n', { max: 150 }),
    fieldConstraint('c', { enum: ['red', 'blue'] }),
    fieldConstraint('s', { pattern: /^\d+$/ }),
    fieldConstraint('s', { minLength: 2, maxLength: 5 }),
  ]);
  assert.deepEqual(statuses(rs), ['fail', 'fail', 'fail', 'pass']);
});

test('JSON Schema via ajv', async () => {
  const schema = { type: 'object', required: ['id'], properties: { id: { type: 'integer' } }, additionalProperties: false };
  const rs = await run('{"id":"x","extra":1}', [matchesSchema(schema)]);
  assert.equal(rs[0]!.status, 'fail');
  assert.equal((await run('{"id":1}', [matchesSchema(schema)]))[0]!.status, 'pass');
});

test('Standard Schema (zod) validator', async () => {
  const s = z.object({ id: z.number().int(), tags: z.array(z.string()) });
  assert.equal((await run('{"id":1,"tags":["a"]}', [matchesSchema(s)]))[0]!.status, 'pass');
  const bad = await run('{"id":1.5,"tags":[1]}', [matchesSchema(s)]);
  assert.equal(bad[0]!.status, 'fail');
});

test('invalid schema is unevaluable, not a pass or fail of the output', async () => {
  const rs = await run('{}', [matchesSchema({ type: 'not-a-type' })]);
  assert.equal(rs[0]!.status, 'unevaluable');
});

test('exact JSON equality ignores key order', async () => {
  assert.equal((await run('{"b":1,"a":2}', [equalsJson({ a: 2, b: 1 })]))[0]!.status, 'pass');
});

test('custom assertions: boolean, outcome, and thrown error', async () => {
  const rs = await run('{"total":10,"items":[4,5]}', [
    custom('sum-matches', (ctx) => { const v = ctx.json.ok ? (ctx.json.value as any) : null; return v.total === v.items.reduce((a: number, b: number) => a + b, 0); }, { requiresJson: true }),
    custom('explicit', () => ({ status: 'fail', message: 'nope' })),
    custom('crashes', () => { throw new Error('boom'); }),
  ]);
  assert.deepEqual(statuses(rs), ['fail', 'fail', 'unevaluable']);
  assert.match(rs[2]!.message!, /boom/);
});

test('evaluator errors are unevaluable and flagged external', async () => {
  const broken = defineEvaluator({ name: 'hosted-judge', usesExternalService: true, evaluate: () => { throw new Error('503'); } });
  const ok = defineEvaluator({ name: 'local', usesExternalService: false, evaluate: () => ({ pass: true, score: 0.9 }) });
  const rs = await run('hello', [semantic(broken, 'is polite'), semantic(ok, 'is polite')]);
  assert.deepEqual(statuses(rs), ['unevaluable', 'pass']);
  assert.equal(rs[0]!.usesExternalService, true);
  assert.equal(rs[1]!.usesExternalService, undefined);
  assert.equal(rs[0]!.kind, 'semantic');
});

test('disallowed content reports the rule name, not the matched text', async () => {
  const rs = await run('call me at the competitor Acme', [forbid({ 'no-competitors': /acme/i })]);
  assert.equal(rs[0]!.status, 'fail');
  assert.match(rs[0]!.message!, /no-competitors/);
  assert.doesNotMatch(rs[0]!.message!, /Acme/);
});

test('tool-call constraints', async () => {
  const out = { text: '', toolCalls: [{ name: 'search', arguments: { q: 'x' } }, { name: 'delete_user', arguments: { id: 1 } }] };
  const rs = await run(out as never, [
    toolCalls({ forbid: ['delete_user'] }),
    toolCalls({ allow: ['search'] }),
    toolCalls({ require: ['search'], order: ['search', 'delete_user'], maxCalls: 2 }),
    toolCalls({ args: { search: (a: any) => (typeof a?.q === 'string' ? true : 'q must be a string') } }),
    toolCalls({ require: ['send_email'] }),
  ]);
  assert.deepEqual(statuses(rs), ['fail', 'fail', 'pass', 'pass', 'fail']);
});

test('refusal and format restrictions are labelled heuristic', async () => {
  const rs = await run("I'm sorry, but I can't help with that request.", [refusal(true), refusal(false), restrictFormat(['html', 'markdown'])]);
  assert.deepEqual(statuses(rs), ['pass', 'fail', 'pass']);
  assert.equal(rs[0]!.kind, 'heuristic');
  assert.equal((await run('<b>hi</b> **x**', [restrictFormat(['html'])]))[0]!.status, 'fail');
});

test('lexical similarity is kind heuristic and cannot detect a fluent wrong answer', async () => {
  const rs = await run('The capital of France is Berlin', [similarTo('The capital of France is Paris', 0.6)]);
  assert.equal(rs[0]!.kind, 'heuristic');
  assert.equal(rs[0]!.status, 'pass'); // documented limitation: high overlap, wrong answer
});

test('provider independence: nothing needs env keys or network', async () => {
  const saved = { ...process.env };
  for (const k of Object.keys(process.env)) if (/KEY|TOKEN|SECRET/i.test(k)) delete process.env[k];
  try {
    const rs = await run('{"ok":true}', [isJson(), hasFields(['ok'])]);
    assert.deepEqual(statuses(rs), ['pass', 'pass']);
  } finally { Object.assign(process.env, saved); }
});

test('assertOutput throws with a readable error, usable from any runner', async () => {
  await assertOutput('{"a":1}', [hasFields(['a'])]);
  await assert.rejects(() => assertOutput('nope', [isJson(), hasFields(['a'])]), (e: unknown) => {
    assert.ok(e instanceof M2AITestKitAssertionError);
    assert.match(e.message, /2 of 2/);
    return true;
  });
});

test('JSON fences are rejected by default and accepted when opted in', async () => {
  const fenced = '```json\n{"a":1}\n```';
  assert.equal((await evaluateOutput([isJson()], { text: fenced }, null))[0]!.status, 'fail');
  assert.equal((await evaluateOutput([isJson()], { text: fenced }, null, { allowJsonFences: true }))[0]!.status, 'pass');
});

test('redaction: builtins, custom patterns, deep values', () => {
  const r = createRedactor({ patterns: [{ name: 'order', pattern: /ORD-\d+/g }] });
  const s = r.string('mail jane@example.com key sk-abcdefghijklmnop1234 ssn 123-45-6789 card 4111 1111 1111 1111 ORD-998');
  for (const leak of ['jane@example.com', 'sk-abcdefghijklmnop1234', '123-45-6789', '4111 1111 1111 1111', 'ORD-998']) assert.ok(!s.includes(leak), leak);
  assert.deepEqual(r.value({ a: ['x@y.io'], n: 3 }), { a: ['[REDACTED:email]'], n: 3 });
  assert.equal(createRedactor({ builtins: false }).string('x@y.io'), 'x@y.io');
});
