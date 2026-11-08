# Programmatic API

```js
import {
  defineSuite, runSuite, evaluateOutput, assertOutput,
  diffReports, compareRecordings,
  createRedactor, defineEvaluator,
  suiteFromSpec, loadSuite, loadRecording, loadReport, stableStringify,
  formatPretty, formatJUnit, formatComparison,
} from 'm2aitestkit';
```

Every assertion constructor from [Assertions](assertions.md) is exported too. The package ships its own types.

## Running a suite

```js
const { report, recording } = await runSuite(suite, { mode: 'record' });
const { report: replayed } = await runSuite(suite, { mode: 'replay', recording });
```

`RunOptions`: `mode` (`'replay'` by default), `recording`, `redactor`. A `recording` is only returned in `record` mode.

The report has this shape (`version: 1`):

```ts
{
  suite: string; mode: 'replay' | 'record' | 'live';
  summary: { cases: Counts; assertions: Counts };   // Counts = { pass, fail, unevaluable }
  cases: {
    id: string; status: Status; outputHash: string | null;
    assertions: { id; name; kind; status; message?; score?; usesExternalService? }[];
  }[];
}
```

## Evaluating one output

```js
const results = await evaluateOutput(assertions, { text: '{"a":1}' }, input);
```

`assertOutput(output, assertions, { input, allowJsonFences })` does the same and throws `M2AITestKitAssertionError` unless every result is `pass`. The error carries `results`.

## Diffing

```js
const diff = diffReports(baselineReport, currentReport);
// { changes: [{ kind, caseId, assertionId?, from?, to? }], regressions: number }
```

`kind` is one of `regressed`, `fixed`, `status-changed`, `added`, `removed`, `output-changed`. `compareRecordings(suite, a, b)` evaluates one suite against two recordings and adds exact-match and lexical-overlap columns.

## Redaction

```js
const redactor = createRedactor({
  patterns: [{ name: 'order-id', pattern: /ORD-\d{6}/g }],
  transform: (s) => s,
});
```

Set `redact` on a suite to apply it to the CLI. `builtins: false` turns the built-in patterns off. See [Privacy & Redaction](privacy.md).

## Loading from disk

`loadSuite(file)` reads a `.json` suite, or imports a JS or TS file whose default export is a suite or a function returning one. These helpers use the filesystem, so they run in Node only.
