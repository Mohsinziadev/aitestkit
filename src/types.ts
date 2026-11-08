export type Status = 'pass' | 'fail' | 'unevaluable';

/**
 * How much weight an assertion can bear.
 * - exact: byte/deep equality against a stored expectation
 * - structural: JSON shape, schema, types, fields
 * - rule: deterministic application rule (forbidden content, tool constraints, ...)
 * - heuristic: deterministic but approximate (refusal phrasing, lexical similarity)
 * - semantic: judged by a user-supplied evaluator (may be a model; may be non-deterministic)
 * - custom: arbitrary user code
 */
export type AssertionKind = 'exact' | 'structural' | 'rule' | 'heuristic' | 'semantic' | 'custom';

export interface ToolCall {
  name: string;
  arguments?: unknown;
}

export interface Output {
  text: string;
  toolCalls?: ToolCall[];
  metadata?: Record<string, unknown>;
}

export type OutputLike = string | Output;

export type JsonParse = { ok: true; value: unknown } | { ok: false; error: string };

export interface AssertionContext {
  output: Output;
  input: unknown;
  /** Lazily parsed JSON view of `output.text`. */
  json: JsonParse;
}

export interface AssertionOutcome {
  status: Status;
  /** Human-readable reason. Built-ins never echo output values here. */
  message?: string;
  score?: number;
}

export interface Assertion {
  name: string;
  kind: AssertionKind;
  /** If true and the output is not valid JSON, the assertion is `unevaluable` rather than run. */
  requiresJson?: boolean;
  /** True when evaluating may send data outside the process (e.g. a hosted model). */
  usesExternalService?: boolean;
  run(ctx: AssertionContext): AssertionOutcome | boolean | Promise<AssertionOutcome | boolean>;
}

export interface CaseMetadata {
  model?: string;
  prompt?: string;
  promptVersion?: string;
  [key: string]: unknown;
}

export interface TestCase {
  id: string;
  input: unknown;
  /** Saved response used for deterministic replay when no recording exists. */
  output?: OutputLike;
  assertions: Assertion[];
  metadata?: CaseMetadata;
  tags?: string[];
}

export interface RunContext {
  caseId: string;
  metadata?: CaseMetadata;
}

export interface Suite {
  name: string;
  cases: TestCase[];
  /** Calls the application under test. Only needed for `record` / `live` modes. */
  run?: (input: unknown, ctx: RunContext) => Promise<OutputLike> | OutputLike;
  redact?: RedactOptions;
  /** Accept JSON wrapped in a ```json fence. Default: strict. */
  allowJsonFences?: boolean;
}

export interface RedactPattern {
  name: string;
  pattern: RegExp;
  replacement?: string;
}

export interface RedactOptions {
  /** Include built-in patterns (emails, tokens, card/SSN-like numbers, ...). Default true. */
  builtins?: boolean;
  patterns?: RedactPattern[];
  /** Final custom pass over every string. */
  transform?: (s: string) => string;
}

export interface AssertionResult {
  id: string;
  name: string;
  kind: AssertionKind;
  status: Status;
  message?: string;
  score?: number;
  usesExternalService?: boolean;
}

export interface CaseResult {
  id: string;
  status: Status;
  outputHash: string | null;
  metadata?: CaseMetadata;
  assertions: AssertionResult[];
}

export interface Counts {
  pass: number;
  fail: number;
  unevaluable: number;
}

export interface RunReport {
  version: 1;
  suite: string;
  mode: RunMode;
  summary: { cases: Counts; assertions: Counts };
  cases: CaseResult[];
}

export type RunMode = 'replay' | 'record' | 'live';

export interface RecordingEntry {
  caseId: string;
  inputHash: string;
  output: Output;
  metadata?: CaseMetadata;
}

export interface Recording {
  version: 1;
  suite: string;
  entries: RecordingEntry[];
}
