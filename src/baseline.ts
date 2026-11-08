import type { CaseResult, Recording, RunReport, Status } from './types.ts';
import { lexicalSimilarity } from './evaluators.ts';
import { runSuite } from './runner.ts';
import type { Suite } from './types.ts';

export type ChangeKind = 'regressed' | 'fixed' | 'status-changed' | 'added' | 'removed' | 'output-changed';

export interface Change {
  kind: ChangeKind;
  caseId: string;
  assertionId?: string;
  from?: Status;
  to?: Status;
}

export interface Diff {
  changes: Change[];
  /** pass -> fail or pass -> unevaluable. These are what CI should block on. */
  regressions: number;
}

/**
 * Assertion-level diff between a saved baseline report and a new one.
 * `output-changed` is informational: the stored output differs but may still satisfy
 * every assertion. `removed` means a case or assertion that existed in the baseline is
 * gone, which can silently weaken a suite, so it is always listed.
 */
export function diffReports(base: RunReport, cur: RunReport): Diff {
  const changes: Change[] = [];
  const baseCases = new Map(base.cases.map((c) => [c.id, c]));
  const curCases = new Map(cur.cases.map((c) => [c.id, c]));

  for (const c of cur.cases) {
    const b = baseCases.get(c.id);
    if (!b) {
      changes.push({ kind: 'added', caseId: c.id });
      continue;
    }
    diffCase(b, c, changes);
  }
  for (const b of base.cases) if (!curCases.has(b.id)) changes.push({ kind: 'removed', caseId: b.id });
  return { changes, regressions: changes.filter((c) => c.kind === 'regressed').length };
}

function diffCase(b: CaseResult, c: CaseResult, out: Change[]): void {
  const bm = new Map(b.assertions.map((a) => [a.id, a]));
  const cm = new Map(c.assertions.map((a) => [a.id, a]));
  for (const a of c.assertions) {
    const prev = bm.get(a.id);
    if (!prev) {
      out.push({ kind: 'added', caseId: c.id, assertionId: a.id, to: a.status });
    } else if (prev.status !== a.status) {
      const kind: ChangeKind = prev.status === 'pass' ? 'regressed' : a.status === 'pass' ? 'fixed' : 'status-changed';
      out.push({ kind, caseId: c.id, assertionId: a.id, from: prev.status, to: a.status });
    }
  }
  for (const a of b.assertions) if (!cm.has(a.id)) out.push({ kind: 'removed', caseId: c.id, assertionId: a.id, from: a.status });
  if (b.outputHash !== c.outputHash) out.push({ kind: 'output-changed', caseId: c.id });
}

export interface ComparisonCase {
  id: string;
  /** Output text identical byte-for-byte. */
  exactTextMatch: boolean | null;
  /** Word-overlap 0..1. Lexical only; says nothing about correctness. */
  lexicalSimilarity: number | null;
  metadataA?: unknown;
  metadataB?: unknown;
}

export interface Comparison {
  suite: string;
  cases: ComparisonCase[];
  reportA: RunReport;
  reportB: RunReport;
  /** Changes going from A to B. */
  diff: Diff;
}

/** Evaluates the same assertions against two recordings (two prompts or models) and diffs the results. */
export async function compareRecordings(suite: Suite, a: Recording, b: Recording): Promise<Comparison> {
  const [ra, rb] = await Promise.all([
    runSuite(suite, { mode: 'replay', recording: a }),
    runSuite(suite, { mode: 'replay', recording: b }),
  ]);
  const ea = new Map(a.entries.map((e) => [e.caseId, e]));
  const eb = new Map(b.entries.map((e) => [e.caseId, e]));
  const cases: ComparisonCase[] = suite.cases.map((tc) => {
    const x = ea.get(tc.id);
    const y = eb.get(tc.id);
    const both = x && y;
    return {
      id: tc.id,
      exactTextMatch: both ? x.output.text === y.output.text : null,
      lexicalSimilarity: both ? lexicalSimilarity(x.output.text, y.output.text) : null,
      ...(x?.metadata ? { metadataA: x.metadata } : {}),
      ...(y?.metadata ? { metadataB: y.metadata } : {}),
    };
  });
  return { suite: suite.name, cases, reportA: ra.report, reportB: rb.report, diff: diffReports(ra.report, rb.report) };
}
