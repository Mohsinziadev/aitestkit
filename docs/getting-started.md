# Getting Started

m2aitestkit does not call a model. You point it at what your application produced, live or from a saved recording, and it reports per assertion whether the output **passed**, **failed** or **could not be evaluated reliably**, and what changed since your last known-good run.

## Install

```bash
npm i -D m2aitestkit
npm i -D ajv        # optional: only for JSON Schema assertions
```

The package and the command are both `m2aitestkit`. After installing, run it with `npx m2aitestkit`.

Node 20 or newer. ESM only. There are no runtime dependencies. `zod`, `valibot`, `arktype` or any [Standard Schema](https://standardschema.dev) validator works with `matchesSchema` without an extra install.

## Write a suite

Create `support-bot.aitest.mjs`. Suite files are discovered as `*.aitest.json`, `*.aitest.js`, `*.aitest.mjs`, `*.aitest.ts` and `*.aitest.mts`.

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

`.ts` suites need Node 22.18 or newer (type stripping) or a loader such as `tsx`.

## Record a known-good run

```bash
npx m2aitestkit record .                 # calls run(), writes .m2aitestkit/recordings/support-bot.json (redacted)
npx m2aitestkit run . --update-baseline  # evaluate and save .m2aitestkit/baselines/support-bot.json
git add .m2aitestkit
```

`record` is the only step that calls your application. The recording is redacted before it is evaluated or written, and it stores a hash of the input, never the input itself.

## Gate CI

```bash
npx m2aitestkit run .
```

This replays the committed recording offline, with no API key, and diffs the result against the baseline. See [CLI & CI](cli.md) for exit codes and report formats.

## Without the CLI

Inside any test runner, `assertOutput` evaluates one output and throws unless every assertion passes:

```js
import { assertOutput, isJson, hasFields } from 'm2aitestkit';

test('summarizer', async () => {
  await assertOutput(await summarize(doc), [isJson(), hasFields(['summary'])]);
});
```

It is exercised in this repository under `node:test`. vitest, jest and mocha usage is the same call but is not covered by this repository's tests.

## Next

- [Core Concepts](concepts.md) for the three outcomes and the assertion kinds
- [Assertions](assertions.md) for every built-in check
- [Recordings & Baselines](recordings.md) for the regression workflow
