# m2aitestkit

Provider-independent regression testing for AI application outputs.

**[Live preview, playground and docs →](https://www.m2toolkit.com/npm-packages/m2aitestkit)** · [npm](https://www.npmjs.com/package/m2aitestkit) · [Docs](https://www.m2toolkit.com/npm-packages/m2aitestkit#/docs/getting-started)

m2aitestkit does not call a model. You point it at what your application produced (live, or a saved recording) and it tells you, per assertion, whether the output **passed**, **failed**, or **could not be evaluated reliably**, and what changed since your last known-good run.

## The problem

Prompts, models, and retrieval change constantly, and the outputs your code depends on (JSON shape, required fields, tool calls, forbidden content) drift quietly. Teams end up with one of two bad options: tests that hit a paid, non-deterministic API on every CI run, or no tests.

m2aitestkit targets one workflow: **record a known-good output set once, commit it, and have CI fail on assertion-level regressions, offline, with no API key.**

What is specific here:

1. **Committed recordings.** Redacted, key-sorted, timestamp-free JSON that diffs cleanly in code review. Raw inputs are never stored, only a hash.
2. **Three outcomes, not two.** Malformed JSON, a crashing custom check, a dead evaluator, a stale or missing recording all produce `unevaluable`, never a silent pass. CI exits non-zero on it by default.
3. **Assertion-level baseline diff.** `pass -> fail` and `pass -> unevaluable` are regressions. Removed cases/assertions are always listed so a suite can't be weakened silently.
4. **Every assertion is labelled** `exact | structural | rule | heuristic | semantic | custom`, so a report never lets lexical overlap pass for correctness.

## Install

```bash
npm i -D m2aitestkit
npm i -D ajv        # optional: only needed for JSON Schema assertions
```

The package and the command are both `m2aitestkit`. After installing, run it with `npx m2aitestkit`.

Node 20+. ESM only. Zero runtime dependencies. `zod`, `valibot`, `arktype` or any [Standard Schema](https://standardschema.dev) validator works without extra install.

## Quick start

`support-bot.aitest.mjs`:

```js
import { defineSuite, isJson, hasFields, fieldConstraint, forbid, toolCalls } from 'm2aitestkit';

export default defineSuite({
  name: 'support-bot',
  run: async (input) => myApp(input),          // your code, any provider
  cases: [{
    id: 'refund-request',
    input: { question: 'Can I get a refund?' },
    metadata: { model: 'gpt-x', promptVersion: 'v3' },
    assertions: [
      isJson(),
      hasFields(['answer', 'refundAmount']),
      fieldConstraint('refundAmount', { min: 0, max: 100 }),
      forbid({ 'competitor-mention': /acme/i }),
      toolCalls({ allow: ['lookup_order'], forbid: ['issue_refund'] }),
    ],
  }],
});
```

```bash
npx m2aitestkit record .                 # calls run(), writes .m2aitestkit/recordings/support-bot.json (redacted)
npx m2aitestkit run . --update-baseline  # evaluate + save .m2aitestkit/baselines/support-bot.json
git add .m2aitestkit

# later, in CI (offline, no key):
npx m2aitestkit run .
```

Suite files are discovered as `*.aitest.json|js|mjs|ts|mts`. `.ts` suites need Node 22.18+ (type stripping) or a loader such as `tsx`.

## Structured-output testing

| Assertion | Kind | Notes |
|---|---|---|
| `isJson()` | structural | strict `JSON.parse`; opt in to ```` ```json ```` fences with `allowJsonFences` |
| `matchesSchema(schema)` | structural | JSON Schema (via optional `ajv`) or any Standard Schema validator |
| `hasFields([...])`, `onlyFields([...])` | structural | paths like `items[0].sku` |
| `fieldType(path, type)` | structural | `integer` is accepted where `number` is |
| `fieldConstraint(path, {min,max,minLength,maxLength,minItems,maxItems,enum,pattern})` | structural | |
| `equalsJson(v)`, `equalsText(s)` | exact | deep equality, key order ignored |
| `contains`, `matches`, `maxLength` | rule | |
| `forbid({label: string\|RegExp})` | rule | message names the rule, never the matched text |
| `toolCalls({allow,forbid,require,order,maxCalls,args})` | rule | |
| `restrictFormat(['html','markdown','url',...])`, `refusal(bool)` | heuristic | regex phrase matching; supply your own patterns |
| `similarTo(ref, threshold)` | heuristic | word overlap only |
| `custom(name, fn)` | custom | a throw means `unevaluable`, not `fail` |
| `semantic(evaluator, criteria)` | semantic | see below |

If the output is not valid JSON, JSON-dependent assertions are `unevaluable`; only `isJson()` reports the failure.

Outputs may be a string or `{ text, toolCalls?, metadata? }`.

### Without the CLI (vitest, jest, node:test, mocha)

```js
import { assertOutput, isJson, hasFields } from 'm2aitestkit';
test('summarizer', async () => {
  await assertOutput(await summarize(doc), [isJson(), hasFields(['summary'])]); // throws unless all pass
});
```

`assertOutput` only throws, so it needs no runner plugin. It is exercised in this repo under `node:test`; vitest/jest usage is the same call but is not covered by this repo's tests.

## Regression testing

Test cases hold input, assertions, optional metadata (`model`, `prompt`, `promptVersion`, anything), and optionally a saved `output`. Declarative JSON suites are supported for the built-in structural/rule assertions (see `examples/basic/invoice.aitest.json`).

```
$ m2aitestkit run .
Suite: support-bot  (mode: replay)
  FAIL        refund-request
      fail forbid(competitor-mention) <rule>: output matched disallowed rule(s): competitor-mention

Baseline: 1 regression(s), 2 change(s)
  REGRESSED      refund-request :: forbid(competitor-mention)  (pass -> fail)
  OUTPUT-CHANGED refund-request
```

- `REGRESSED` blocks CI. `OUTPUT-CHANGED` (stored output differs but assertions still pass) is informational.
- `--live` calls `run()` instead of replaying, for checking a real model before you re-record.
- Replay is deterministic: no timestamps, no durations, sorted keys. Two runs produce byte-identical JSON.

### Comparing prompt versions or models

```bash
m2aitestkit record . && cp .m2aitestkit/recordings/support-bot.json prompt-v3.json
# change the prompt, record again
m2aitestkit compare support-bot.aitest.mjs --a prompt-v3.json --b .m2aitestkit/recordings/support-bot.json
```

The report keeps three things apart: whether the text is **byte-identical**, **lexical overlap** (0..1), and **assertion transitions** A -> B. Only the last one says anything about requirements you wrote. Lexical overlap is not correctness: "The capital of France is Berlin" scores high against "...is Paris" (this is a unit test in the repo).

## Custom evaluators

Deterministic checks need no key and no evaluator. When you do want a judgment call, you supply the evaluator and m2aitestkit marks it:

```js
import { defineEvaluator, semantic } from 'm2aitestkit';

const toneJudge = defineEvaluator({
  name: 'tone-judge',
  usesExternalService: true,            // this sends the output to a hosted model; reports flag it
  async evaluate({ output, criteria }) {
    const verdict = await myLlmClient.judge(output.text, criteria);   // your client, your key
    return { pass: verdict.ok, score: verdict.score, reason: verdict.reason };
  },
});

assertions: [semantic(toneJudge, 'Reply is polite and does not promise a refund')]
```

m2aitestkit ships **no** model-backed evaluator. If an evaluator throws or times out, the result is `unevaluable`. LLM judges are non-deterministic and have their own biases: pin the model and temperature, record verdicts, and treat them as a signal to review, not ground truth.

## CI

```yaml
- run: npm ci
- run: npx m2aitestkit run . --format junit --output m2aitestkit.xml
```

| Exit | Meaning |
|---|---|
| 0 | all assertions passed, no regressions |
| 1 | an assertion failed, or a baseline regression |
| 2 | usage or load error (bad flag, missing file, invalid suite) |
| 3 | nothing failed but some assertions were `unevaluable` (`--allow-unevaluable` to accept) |

Formats: `pretty` (default), `json` (stable, machine-readable), `junit` (`unevaluable` -> `<error>`).

## Privacy model

- **No network access, no telemetry, no uploads.** The package makes no outbound calls. The only way data leaves the process is an evaluator or `run()` function *you* write.
- **Reports don't print inputs or outputs.** Built-in assertion messages state the path/rule that failed, not the value. Messages from your own `custom` checks and evaluators are user-authored; they are passed through the redactor but you decide what they say.
- **Recordings are redacted by default** (`record`, `--live`): emails, JWTs, bearer tokens, common API-key shapes, card-like and SSN-like numbers, phone numbers, plus your own `redact.patterns` / `redact.transform`. Raw inputs are not stored, only a SHA-256 of the redacted input. Redaction happens *before* evaluation, so what you test is what you committed.
- `--no-redact` disables built-ins; recordings are then verbatim.
- Report `outputHash` values are truncated hashes of redacted output.

Redaction is regex matching. It will miss names, addresses, and free-text PII. **Review recordings before committing them.**

## Limitations

- This checks **requirements you wrote down**. It does not establish correctness, factuality, or safety, and passing assertions are not a guarantee of safe behavior.
- `refusal()` and `restrictFormat()` are phrase/regex heuristics and will produce false positives and negatives. `similarTo()` and `compare`'s overlap are lexical.
- Replay tests recorded outputs, not today's model. A green replay says your *assertions and parsing* still hold on the recorded output; to detect model drift you must re-record or run `--live`.
- Live model output is non-deterministic. Record one sample per case, or run `--live` several times; there is no built-in repeat/flakiness statistics.
- Case ids and assertion names are identity for baseline matching; renaming one shows as removed + added.
- Single-turn input/output only. No built-in multi-turn or trace support; no UI.
- Redaction patterns are US/English-biased.
- No evaluation-accuracy claims are made; there is no benchmark dataset in this repo.

## Comparison with existing tools

Verified against vendor docs on 2026-10-30 (pages can change; check them).

| | Offline deterministic assertions | Evaluate pre-recorded outputs | Replay / cache | Notes |
|---|---|---|---|---|
| **promptfoo** | Yes: `is-json` (+schema), `contains-json`, `is-refusal`, tool-call assertions, `javascript`, ... | Yes: `--model-outputs` with deterministic assertion files | Local disk cache (default `~/.promptfoo/cache`, 14-day TTL); docs say key formats are implementation details that may change; no committed/exportable snapshot described | Much broader: many providers, red-teaming, model-graded assertions, web UI. [docs](https://www.promptfoo.dev/docs/configuration/expected-outputs/) · [caching](https://www.promptfoo.dev/docs/configuration/caching/) |
| **vitest-evals** | Yes: `StructuredOutputJudge`, `ToolCallJudge` | not verified | not verified | Vitest-only; also LLM-backed `FactualityJudge`. [repo](https://github.com/getsentry/vitest-evals) |
| **Evalite** | not verified | not verified | not verified | "TypeScript-native, local-first tool for testing LLM-powered apps"; README gave no detail on snapshots or regressions. [repo](https://github.com/mattpocock/evalite) |
| **DeepEval / RAGAS** | Mostly LLM-metric based (per third-party comparisons) | not verified | not verified | Python. Cost scales with LLM-judged metrics. |

**Where m2aitestkit is different, and where it isn't.** promptfoo can already assert on structured output and score saved outputs without a provider; if you use promptfoo, you do not *need* this for that. m2aitestkit's narrower claims are: a documented, stable, redacted, commit-friendly recording format; a `pass/fail/unevaluable` model enforced by exit codes; assertion-level baseline diffs; and a library-first API that works from any test runner. It is much smaller and far less featureful.

## Roadmap

1. Dogfood on one real app; collect false-positive reports on `refusal`/`restrictFormat`.
2. Multi-sample recordings with pass-rate thresholds per case.
3. Adapters that record from common SDK call shapes (OpenAI/Anthropic/AI SDK response objects -> `Output`).
4. Optional vitest/jest matchers (`expect(out).toPassM2AITestKit([...])`).
5. Redaction pattern packs per locale; `m2aitestkit doctor` to scan recordings for leftover PII.
6. A published, reproducible eval dataset before any accuracy claims are made about semantic evaluators.

## License

MIT
# aitestkit
