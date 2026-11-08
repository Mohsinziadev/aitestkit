import { canonicalize, sha256 } from './canonical.ts';
import { createRedactor, noRedaction, type Redactor } from './redact.ts';
import type {
  Assertion,
  AssertionContext,
  AssertionOutcome,
  AssertionResult,
  CaseResult,
  Counts,
  JsonParse,
  Output,
  OutputLike,
  Recording,
  RecordingEntry,
  RunMode,
  RunReport,
  Status,
  Suite,
  TestCase,
} from './types.ts';

export function normalizeOutput(o: OutputLike): Output {
  return typeof o === 'string' ? { text: o } : o;
}

export function parseJson(text: string, allowFences: boolean): JsonParse {
  let src = text.trim();
  if (allowFences) {
    const m = src.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
    if (m) src = m[1]!;
  }
  try {
    return { ok: true, value: JSON.parse(src) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function inputHash(input: unknown, redactor: Redactor): string {
  return sha256(canonicalize(redactor.value(input)));
}

export function outputHash(output: Output, redactor: Redactor): string {
  return sha256(canonicalize(redactor.output(output))).slice(0, 16);
}

export async function evaluateAssertion(
  a: Assertion,
  ctx: AssertionContext,
  redactor: Redactor = noRedaction,
): Promise<Omit<AssertionResult, 'id'>> {
  const base = {
    name: a.name,
    kind: a.kind,
    ...(a.usesExternalService ? { usesExternalService: true } : {}),
  };
  if (a.requiresJson && !ctx.json.ok) {
    return { ...base, status: 'unevaluable', message: 'output is not valid JSON, so this check could not run' };
  }
  try {
    const r = await a.run(ctx);
    const o: AssertionOutcome = typeof r === 'boolean' ? { status: r ? 'pass' : 'fail' } : r;
    return {
      ...base,
      status: o.status,
      ...(o.message ? { message: redactor.string(o.message) } : {}),
      ...(o.score !== undefined ? { score: o.score } : {}),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ...base, status: 'unevaluable', message: redactor.string(`assertion threw: ${msg}`) };
  }
}

export function evaluateOutput(
  assertions: Assertion[],
  output: Output,
  input: unknown,
  opts: { allowJsonFences?: boolean; redactor?: Redactor } = {},
): Promise<AssertionResult[]> {
  const ctx: AssertionContext = { output, input, json: parseJson(output.text, opts.allowJsonFences ?? false) };
  return Promise.all(assertions.map((a) => evaluateAssertion(a, ctx, opts.redactor))).then(withIds);
}

function withIds(rs: Omit<AssertionResult, 'id'>[]): AssertionResult[] {
  const seen = new Map<string, number>();
  return rs.map((r) => {
    const n = (seen.get(r.name) ?? 0) + 1;
    seen.set(r.name, n);
    return { id: n === 1 ? r.name : `${r.name}#${n}`, ...r };
  });
}

function rollup(statuses: Status[]): Status {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('unevaluable')) return 'unevaluable';
  return 'pass';
}

export function count(statuses: Status[]): Counts {
  const c: Counts = { pass: 0, fail: 0, unevaluable: 0 };
  for (const s of statuses) c[s]++;
  return c;
}

export interface RunOptions {
  mode?: RunMode;
  recording?: Recording;
  /** Redact stored/evaluated outputs and hashes. Defaults to the suite's `redact` options, with builtins. */
  redactor?: Redactor;
}

export interface RunResult {
  report: RunReport;
  /** Present in `record` mode. */
  recording?: Recording;
}

export async function runSuite(suite: Suite, opts: RunOptions = {}): Promise<RunResult> {
  const mode = opts.mode ?? 'replay';
  const redactor = opts.redactor ?? createRedactor(suite.redact);
  const byId = new Map(opts.recording?.entries.map((e) => [e.caseId, e]));
  const ids = new Set<string>();
  const entries: RecordingEntry[] = [];
  const cases: CaseResult[] = [];

  for (const tc of suite.cases) {
    if (ids.has(tc.id)) throw new Error(`duplicate case id "${tc.id}" in suite "${suite.name}"`);
    ids.add(tc.id);
    const resolved = await resolveOutput(suite, tc, mode, byId.get(tc.id), redactor);
    if (resolved.output && mode === 'record') {
      entries.push({
        caseId: tc.id,
        inputHash: inputHash(tc.input, redactor),
        output: resolved.output,
        ...(tc.metadata ? { metadata: tc.metadata } : {}),
      });
    }
    let results: AssertionResult[];
    if (resolved.output) {
      results = await evaluateOutput(tc.assertions, resolved.output, tc.input, {
        allowJsonFences: suite.allowJsonFences ?? false,
        redactor,
      });
    } else {
      results = withIds(
        tc.assertions.map((a) => ({
          name: a.name,
          kind: a.kind,
          status: 'unevaluable' as const,
          message: resolved.reason,
          ...(a.usesExternalService ? { usesExternalService: true } : {}),
        })),
      );
    }
    cases.push({
      id: tc.id,
      status: results.length ? rollup(results.map((r) => r.status)) : resolved.output ? 'pass' : 'unevaluable',
      outputHash: resolved.output ? outputHash(resolved.output, redactor) : null,
      ...(tc.metadata ? { metadata: tc.metadata } : {}),
      assertions: results,
    });
  }

  const report: RunReport = {
    version: 1,
    suite: suite.name,
    mode,
    summary: {
      cases: count(cases.map((c) => c.status)),
      assertions: count(cases.flatMap((c) => c.assertions.map((a) => a.status))),
    },
    cases,
  };
  return { report, ...(mode === 'record' ? { recording: { version: 1 as const, suite: suite.name, entries } } : {}) };
}

async function resolveOutput(
  suite: Suite,
  tc: TestCase,
  mode: RunMode,
  rec: RecordingEntry | undefined,
  redactor: Redactor,
): Promise<{ output?: Output; reason?: string }> {
  if (mode === 'replay') {
    if (rec) {
      // Accept a hash of the raw input too: recordings made with --no-redact must still replay.
      if (rec.inputHash !== inputHash(tc.input, redactor) && rec.inputHash !== inputHash(tc.input, noRedaction)) {
        return { reason: 'recording is stale: the case input changed since it was recorded (re-run record)' };
      }
      return { output: rec.output };
    }
    if (tc.output !== undefined) return { output: redactor.output(normalizeOutput(tc.output)) };
    return { reason: 'no recording or saved output for this case (run record)' };
  }
  if (!suite.run) return { reason: `mode "${mode}" needs suite.run to call the application` };
  try {
    const out = await suite.run(tc.input, { caseId: tc.id, ...(tc.metadata ? { metadata: tc.metadata } : {}) });
    return { output: redactor.output(normalizeOutput(out)) };
  } catch (e) {
    return { reason: redactor.string(`application threw: ${e instanceof Error ? e.message : String(e)}`) };
  }
}
