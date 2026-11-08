# Core Concepts

## Three outcomes

Every assertion ends in exactly one of three states.

| Status | Meaning |
|---|---|
| `pass` | The assertion ran and the output satisfied it. |
| `fail` | The assertion ran and the output violated it. |
| `unevaluable` | The check could not run reliably. It is **not** a pass. |

`unevaluable` covers malformed JSON for a JSON-dependent assertion, a custom check that throws, an evaluator that crashes or times out, and a recording that is missing or stale. CI exits non-zero on it by default (exit code 3), so a broken check can't turn the build green. Pass `--allow-unevaluable` to accept it.

If the output is not valid JSON, only `isJson()` reports the failure. Every other JSON-dependent assertion is `unevaluable`, so one broken reply doesn't produce a wall of identical failures.

## Assertion kinds

Every assertion is labelled with how much weight it can bear. Reports carry the label, so a heuristic is never read as proof.

| Kind | What it is |
|---|---|
| `exact` | Deep or byte equality against a stored expectation. |
| `structural` | JSON shape, schema, fields, types and ranges. |
| `rule` | A deterministic application rule: forbidden content, length caps, tool-call constraints. |
| `heuristic` | Deterministic but approximate: refusal phrasing, format detection, lexical similarity. |
| `semantic` | Judged by an evaluator you supply. May be a model, may be non-deterministic. |
| `custom` | Your own function. |

## Suites, cases and assertions

A **suite** has a name, an optional `run` function that calls your application, and a list of **cases**. A case has an `id`, an `input`, optional `metadata` (`model`, `prompt`, `promptVersion`, anything), an optional saved `output`, and its **assertions**.

Case ids and assertion names are identity for baseline matching. Renaming one shows up as one removed and one added.

## Modes

| Mode | What happens |
|---|---|
| `record` | Calls `run()` for each case and saves redacted outputs. |
| `replay` (default) | Evaluates saved outputs. Never calls your application. |
| `live` (`--live`) | Calls `run()` and evaluates the result, without recording it. |

Replay is deterministic: no timestamps, no durations and sorted keys, so two runs give byte-identical JSON.

## Outputs

An output is a string, or `{ text, toolCalls?, metadata? }`. Tool calls are `{ name, arguments? }`.

## Baselines

A baseline is the report of a run you accepted. Later runs are diffed against it **per assertion**:

- `pass → fail` and `pass → unevaluable` are **regressions** and block CI.
- `fail → pass` is reported as fixed.
- Cases and assertions that disappeared are always listed, so a suite can't be weakened silently.
- `output-changed` means the stored output differs while assertions still pass. It is informational.
