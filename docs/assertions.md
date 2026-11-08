# Assertions

Import any of these from `m2aitestkit`. Each carries a kind, shown in every report.

## Structured output

| Assertion | Kind | Notes |
|---|---|---|
| `isJson()` | structural | Strict `JSON.parse`. Set `allowJsonFences` on the suite to accept a ```` ```json ```` fence. |
| `matchesSchema(schema)` | structural | JSON Schema (needs the optional `ajv`) or any Standard Schema validator. |
| `hasFields([...], { nonNull })` | structural | Paths such as `items[0].sku`. |
| `onlyFields([...])` | structural | Fails on fields you didn't list. |
| `fieldType(path, type)` | structural | `integer` is accepted where `number` is. |
| `fieldConstraint(path, c)` | structural | `min`, `max`, `minLength`, `maxLength`, `minItems`, `maxItems`, `enum`, `pattern`. |
| `equalsJson(v)` | exact | Deep equality, key order ignored. |
| `equalsText(s, { trim })` | exact | |

## Text rules

| Assertion | Kind | Notes |
|---|---|---|
| `contains(s, { ignoreCase })` | rule | |
| `matches(regex)` | rule | |
| `maxLength(n)` | rule | |
| `forbid({ label: string \| RegExp })` | rule | Strings match case-insensitively. The failure names the rule, never the matched text. |
| `toolCalls({ allow, forbid, require, order, maxCalls, args })` | rule | `args` takes per-tool validators. |

## Heuristics

| Assertion | Kind | Notes |
|---|---|---|
| `restrictFormat(['html','markdown','url','code-fence','non-ascii'])` | heuristic | Regex detection. |
| `refusal(expected, { patterns })` | heuristic | Phrase matching. Supply your own patterns. |
| `similarTo(reference, threshold)` | heuristic | Word-set overlap only. It can't tell a correct answer from a fluent wrong one. |

## Your own

```js
import { custom, semantic, defineEvaluator } from 'm2aitestkit';

custom('refund-is-whole-cents', (ctx) => Number.isInteger(ctx.json.value.refundAmount * 100), { requiresJson: true });
```

A thrown error in a `custom` check makes it `unevaluable`, not `fail`: a crashing check proves nothing about the output.

```js
const toneJudge = defineEvaluator({
  name: 'tone-judge',
  usesExternalService: true,            // sends the output to a hosted model; reports flag it
  async evaluate({ output, criteria }) {
    const verdict = await myLlmClient.judge(output.text, criteria);   // your client, your key
    return { pass: verdict.ok, score: verdict.score, reason: verdict.reason };
  },
});

assertions: [semantic(toneJudge, 'Reply is polite and does not promise a refund')]
```

m2aitestkit ships no model-backed evaluator. If an evaluator throws or times out, the result is `unevaluable`. Model judges are non-deterministic and have their own biases: pin the model and temperature, record verdicts, and treat them as a signal to review, not ground truth.

## Declarative JSON suites

Files named `*.aitest.json` support the built-in structural and rule assertions through a JSON form:

```json
{
  "name": "invoice-extractor",
  "cases": [{
    "id": "simple-invoice",
    "input": "Invoice #1001 from Initech, total $120.50",
    "output": "{\"invoiceNumber\":\"1001\",\"total\":120.5}",
    "assertions": [
      { "type": "is-json" },
      { "type": "required-fields", "fields": ["invoiceNumber", "total"] },
      { "type": "field-type", "field": "total", "is": "number" },
      { "type": "forbid", "rules": { "no-markdown": { "pattern": "\\*\\*" } } }
    ]
  }]
}
```

Types: `is-json`, `schema`, `required-fields`, `only-fields`, `field-type`, `field-constraint`, `equals-json`, `equals-text`, `contains`, `matches`, `max-length`, `forbid`, `restrict-format`, `refusal`, `tool-calls`, `similar-to`. Semantic and custom assertions need a JS or TS suite. The playground on the home page uses this format.
