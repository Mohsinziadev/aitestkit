export * from './types.ts';
export * from './assertions.ts';
export { defineEvaluator, lexicalSimilarity, type Evaluator, type EvaluatorVerdict } from './evaluators.ts';
export { createRedactor, BUILTIN_PATTERNS, noRedaction, type Redactor } from './redact.ts';
export { runSuite, evaluateOutput, normalizeOutput, parseJson, type RunOptions, type RunResult } from './runner.ts';
export { diffReports, compareRecordings, type Diff, type Change, type Comparison } from './baseline.ts';
export { assertOutput, M2AITestKitAssertionError } from './expect.ts';
export { suiteFromSpec, assertionFromSpec, type SuiteSpec, type AssertionSpec } from './spec.ts';
export { loadSuite, loadRecording, loadReport, stableStringify } from './files.ts';
export { formatPretty, formatJUnit, formatComparison } from './report.ts';

import type { Suite } from './types.ts';
/** Identity helper that gives suite files type checking. */
export function defineSuite(s: Suite): Suite {
  return s;
}
