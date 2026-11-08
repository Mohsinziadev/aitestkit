import { deepEqual } from './canonical.ts';
import { lexicalSimilarity, type Evaluator } from './evaluators.ts';
import { getPath } from './path.ts';
import type { Assertion, AssertionContext, AssertionKind, AssertionOutcome, ToolCall } from './types.ts';

const pass = (message?: string): AssertionOutcome => ({ status: 'pass', ...(message ? { message } : {}) });
const fail = (message: string): AssertionOutcome => ({ status: 'fail', message });
const unevaluable = (message: string): AssertionOutcome => ({ status: 'unevaluable', message });

function make(
  name: string,
  kind: AssertionKind,
  run: Assertion['run'],
  extra: Partial<Assertion> = {},
): Assertion {
  return { name, kind, run, ...extra };
}

function jsonValue(ctx: AssertionContext): unknown {
  return ctx.json.ok ? ctx.json.value : undefined;
}

// ---------------------------------------------------------------- structured output

export function isJson(): Assertion {
  return make('is-json', 'structural', (ctx) =>
    ctx.json.ok ? pass() : fail(`output is not valid JSON (${ctx.json.error})`),
  );
}

type StandardSchemaLike = {
  '~standard': { validate(v: unknown): { issues?: readonly { message: string; path?: readonly unknown[] }[] } | Promise<{ issues?: readonly { message: string; path?: readonly unknown[] }[] }> };
};

function isStandardSchema(s: unknown): s is StandardSchemaLike {
  return !!s && typeof s === 'object' && '~standard' in s;
}

/**
 * Validates parsed JSON against either a JSON Schema (requires the optional `ajv`
 * peer dependency) or any Standard Schema validator (zod >=3.24, valibot, arktype, ...).
 */
export function matchesSchema(schema: object): Assertion {
  const std = isStandardSchema(schema);
  return make(
    'matches-schema',
    'structural',
    async (ctx) => {
      const value = jsonValue(ctx);
      if (std) {
        const res = await schema['~standard'].validate(value);
        if (!res.issues?.length) return pass();
        return fail(res.issues.slice(0, 5).map((i) => `${formatIssuePath(i.path)}: ${i.message}`).join('; '));
      }
      let AjvCtor: new (o: object) => { compile(s: object): ((v: unknown) => boolean) & { errors?: { instancePath: string; message?: string }[] | null } };
      try {
        const mod: any = await import('ajv');
        AjvCtor = mod.default?.default ?? mod.default ?? mod.Ajv;
      } catch {
        return unevaluable("JSON Schema validation needs the optional peer dependency 'ajv' (npm i ajv)");
      }
      let validate;
      try {
        validate = new AjvCtor({ allErrors: true, strict: false }).compile(schema);
      } catch (e) {
        return unevaluable(`schema could not be compiled: ${(e as Error).message}`);
      }
      if (validate(value)) return pass();
      const errs = validate.errors ?? [];
      return fail(errs.slice(0, 5).map((e) => `${e.instancePath || '$'} ${e.message ?? 'invalid'}`).join('; '));
    },
    { requiresJson: true },
  );
}

function formatIssuePath(path?: readonly unknown[]): string {
  if (!path?.length) return '$';
  return '$.' + path.map((p) => (typeof p === 'object' && p && 'key' in p ? String((p as { key: unknown }).key) : String(p))).join('.');
}

export function hasFields(paths: string[], opts: { nonNull?: boolean } = {}): Assertion {
  return make(
    `has-fields(${paths.join(',')})`,
    'structural',
    (ctx) => {
      const root = jsonValue(ctx);
      const missing = paths.filter((p) => {
        const r = getPath(root, p);
        return !r.found || (opts.nonNull === true && r.value === null);
      });
      return missing.length ? fail(`missing required field(s): ${missing.join(', ')}`) : pass();
    },
    { requiresJson: true },
  );
}

/** Top-level object must not contain keys outside `allowed`. */
export function onlyFields(allowed: string[]): Assertion {
  return make(
    `only-fields(${allowed.join(',')})`,
    'structural',
    (ctx) => {
      const v = jsonValue(ctx);
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('output JSON is not an object');
      const extra = Object.keys(v).filter((k) => !allowed.includes(k));
      return extra.length ? fail(`unexpected field(s): ${extra.join(', ')}`) : pass();
    },
    { requiresJson: true },
  );
}

export type JsonType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';

function typeOf(v: unknown): JsonType | 'undefined' {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  if (typeof v === 'string' || typeof v === 'boolean' || typeof v === 'object') return typeof v as JsonType;
  return 'undefined';
}

export function fieldType(path: string, expected: JsonType | JsonType[]): Assertion {
  const allowed = Array.isArray(expected) ? expected : [expected];
  return make(
    `field-type(${path}:${allowed.join('|')})`,
    'structural',
    (ctx) => {
      const r = getPath(jsonValue(ctx), path);
      if (!r.found) return fail(`field ${path} is missing`);
      const t = typeOf(r.value);
      const ok = allowed.some((a) => a === t || (a === 'number' && t === 'integer'));
      return ok ? pass() : fail(`field ${path} has type ${t}, expected ${allowed.join(' or ')}`);
    },
    { requiresJson: true },
  );
}

export interface FieldConstraint {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  enum?: unknown[];
  pattern?: RegExp;
}

export function fieldConstraint(path: string, c: FieldConstraint): Assertion {
  return make(
    `field-constraint(${path})`,
    'structural',
    (ctx) => {
      const r = getPath(jsonValue(ctx), path);
      if (!r.found) return fail(`field ${path} is missing`);
      const v = r.value;
      const problems: string[] = [];
      if (typeof v === 'number') {
        if (c.min !== undefined && v < c.min) problems.push(`below min ${c.min}`);
        if (c.max !== undefined && v > c.max) problems.push(`above max ${c.max}`);
      }
      if (typeof v === 'string') {
        if (c.minLength !== undefined && v.length < c.minLength) problems.push(`shorter than ${c.minLength}`);
        if (c.maxLength !== undefined && v.length > c.maxLength) problems.push(`longer than ${c.maxLength}`);
        if (c.pattern && !new RegExp(c.pattern.source, c.pattern.flags.replace(/[gy]/g, '')).test(v)) problems.push(`does not match ${c.pattern}`);
      }
      if (Array.isArray(v)) {
        if (c.minItems !== undefined && v.length < c.minItems) problems.push(`fewer than ${c.minItems} items`);
        if (c.maxItems !== undefined && v.length > c.maxItems) problems.push(`more than ${c.maxItems} items`);
      }
      if (c.enum && !c.enum.some((e) => deepEqual(e, v))) problems.push('not one of the allowed values');
      if (
        (c.min !== undefined || c.max !== undefined) && typeof v !== 'number' ||
        (c.minLength !== undefined || c.maxLength !== undefined || c.pattern) && typeof v !== 'string' ||
        (c.minItems !== undefined || c.maxItems !== undefined) && !Array.isArray(v)
      ) {
        problems.push(`constraint does not apply to type ${typeOf(v)}`);
      }
      return problems.length ? fail(`field ${path}: ${problems.join('; ')}`) : pass();
    },
    { requiresJson: true },
  );
}

// ---------------------------------------------------------------- exact matches

export function equalsJson(expected: unknown): Assertion {
  return make(
    'equals-json',
    'exact',
    (ctx) => (deepEqual(jsonValue(ctx), expected) ? pass() : fail('output JSON differs from expected value')),
    { requiresJson: true },
  );
}

export function equalsText(expected: string, opts: { trim?: boolean } = {}): Assertion {
  const n = (s: string) => (opts.trim ? s.trim() : s);
  return make('equals-text', 'exact', (ctx) =>
    n(ctx.output.text) === n(expected) ? pass() : fail('output text differs from expected text'),
  );
}

// ---------------------------------------------------------------- text rules

export function contains(needle: string, opts: { ignoreCase?: boolean } = {}): Assertion {
  return make(`contains(${JSON.stringify(needle)})`, 'rule', (ctx) => {
    const [h, n] = opts.ignoreCase ? [ctx.output.text.toLowerCase(), needle.toLowerCase()] : [ctx.output.text, needle];
    return h.includes(n) ? pass() : fail(`output does not contain required text ${JSON.stringify(needle)}`);
  });
}

export function matches(pattern: RegExp): Assertion {
  return make(`matches(${pattern})`, 'rule', (ctx) =>
    new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, '')).test(ctx.output.text)
      ? pass()
      : fail(`output does not match ${pattern}`),
  );
}

export function maxLength(n: number): Assertion {
  return make(`max-length(${n})`, 'rule', (ctx) =>
    ctx.output.text.length <= n ? pass() : fail(`output is ${ctx.output.text.length} characters, limit is ${n}`),
  );
}

/**
 * Application-specific disallowed content. Keys are labels; values are strings
 * (case-insensitive substring) or RegExps. Failure messages name the rule, never
 * the matched text, so reports do not leak the offending content.
 */
export function forbid(rules: Record<string, string | RegExp>): Assertion {
  return make(`forbid(${Object.keys(rules).join(',')})`, 'rule', (ctx) => {
    const hit = Object.entries(rules)
      .filter(([, r]) =>
        typeof r === 'string'
          ? ctx.output.text.toLowerCase().includes(r.toLowerCase())
          : new RegExp(r.source, r.flags.replace(/[gy]/g, '')).test(ctx.output.text),
      )
      .map(([label]) => label);
    return hit.length ? fail(`output matched disallowed rule(s): ${hit.join(', ')}`) : pass();
  });
}

const FORMATS = {
  html: /<\/?[a-z][a-z0-9-]*(\s[^<>]*)?>/i,
  markdown: /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s)|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)/,
  url: /\bhttps?:\/\/\S+/i,
  'code-fence': /```/,
  'non-ascii': /[^\x00-\x7F]/,
} as const;

export type FormatName = keyof typeof FORMATS;

/** Data-format restrictions, e.g. no HTML in a field that gets rendered as text. Regex heuristics. */
export function restrictFormat(forbidden: FormatName[]): Assertion {
  return make(`restrict-format(${forbidden.join(',')})`, 'heuristic', (ctx) => {
    const hit = forbidden.filter((f) => FORMATS[f].test(ctx.output.text));
    return hit.length ? fail(`output contains restricted format(s): ${hit.join(', ')}`) : pass();
  });
}

const REFUSAL_PATTERNS = [
  /\bI (?:can(?:no|')t|cannot|am unable to|won't|will not) (?:help|assist|comply|provide|do that|answer)/i,
  /\bI'm (?:sorry|unable|not able)\b.*\b(?:can't|cannot|unable|not able)\b/i,
  /\bI (?:must )?(?:decline|refuse)\b/i,
  /\bnot (?:something|able) I can (?:help|assist)\b/i,
];

/**
 * Checks whether the output *looks like* a refusal using phrase patterns. Heuristic:
 * supply your own `patterns` that match your application's refusal template, or
 * check a structured field with hasFields/equalsJson instead.
 */
export function refusal(expected: boolean, opts: { patterns?: RegExp[] } = {}): Assertion {
  const pats = opts.patterns ?? REFUSAL_PATTERNS;
  return make(`refusal(${expected})`, 'heuristic', (ctx) => {
    const looks = pats.some((p) => new RegExp(p.source, p.flags.replace(/[gy]/g, '')).test(ctx.output.text));
    return looks === expected
      ? pass()
      : fail(expected ? 'output does not look like a refusal' : 'output looks like a refusal');
  });
}

// ---------------------------------------------------------------- tool calls

export interface ToolCallRules {
  /** If set, only these tools may be called. */
  allow?: string[];
  forbid?: string[];
  require?: string[];
  maxCalls?: number;
  /** Tools must appear in this relative order (other calls may be interleaved). */
  order?: string[];
  /** Per-tool argument validators; return true, or a string describing the problem. */
  args?: Record<string, (args: unknown) => boolean | string>;
}

export function toolCalls(rules: ToolCallRules): Assertion {
  return make('tool-calls', 'rule', (ctx) => {
    const calls: ToolCall[] = ctx.output.toolCalls ?? [];
    const names = calls.map((c) => c.name);
    const problems: string[] = [];
    if (rules.allow) {
      const bad = names.filter((n) => !rules.allow!.includes(n));
      if (bad.length) problems.push(`tool(s) not allowed: ${[...new Set(bad)].join(', ')}`);
    }
    if (rules.forbid) {
      const bad = names.filter((n) => rules.forbid!.includes(n));
      if (bad.length) problems.push(`forbidden tool(s) called: ${[...new Set(bad)].join(', ')}`);
    }
    if (rules.require) {
      const miss = rules.require.filter((n) => !names.includes(n));
      if (miss.length) problems.push(`required tool(s) not called: ${miss.join(', ')}`);
    }
    if (rules.maxCalls !== undefined && calls.length > rules.maxCalls) {
      problems.push(`${calls.length} tool calls, limit is ${rules.maxCalls}`);
    }
    if (rules.order) {
      let i = 0;
      for (const n of names) if (n === rules.order[i]) i++;
      if (i < rules.order.length) problems.push(`tools not called in order: ${rules.order.join(' -> ')}`);
    }
    if (rules.args) {
      for (const call of calls) {
        const check = rules.args[call.name];
        if (!check) continue;
        const r = check(call.arguments);
        if (r !== true) problems.push(`arguments of ${call.name}: ${typeof r === 'string' ? r : 'rejected'}`);
      }
    }
    return problems.length ? fail(problems.join('; ')) : pass();
  });
}

// ---------------------------------------------------------------- custom + semantic

/**
 * Business rules. Return boolean, or an outcome object. A thrown error makes the
 * assertion `unevaluable` (not `fail`): a crashing check proves nothing about the output.
 */
export function custom(name: string, fn: Assertion['run'], opts: { requiresJson?: boolean } = {}): Assertion {
  return make(name, 'custom', fn, opts.requiresJson ? { requiresJson: true } : {});
}

/**
 * Delegates to a user-supplied evaluator. If the evaluator talks to an external
 * service, say so via `evaluator.usesExternalService`.
 */
export function semantic(evaluator: Evaluator, criteria: string): Assertion {
  return make(
    `semantic(${evaluator.name})`,
    'semantic',
    async (ctx) => {
      const v = await evaluator.evaluate({ output: ctx.output, input: ctx.input, criteria });
      return {
        status: v.pass ? 'pass' : 'fail',
        ...(v.reason ? { message: v.reason } : {}),
        ...(v.score !== undefined ? { score: v.score } : {}),
      };
    },
    { usesExternalService: evaluator.usesExternalService },
  );
}

/**
 * Offline lexical overlap with a reference text. Useful as a drift alarm between
 * prompt versions; NOT evidence of correctness.
 */
export function similarTo(reference: string, threshold: number): Assertion {
  return make(`similar-to(>=${threshold})`, 'heuristic', (ctx) => {
    const score = lexicalSimilarity(ctx.output.text, reference);
    return {
      status: score >= threshold ? 'pass' : 'fail',
      score,
      message: `lexical similarity ${score.toFixed(2)} (threshold ${threshold}); word overlap only`,
    };
  });
}
