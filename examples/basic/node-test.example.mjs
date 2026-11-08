// Works the same in vitest/jest: assertOutput just throws. Run: node --test examples/basic/node-test.example.mjs
import { test } from 'node:test';
import { assertOutput, isJson, hasFields, forbid } from 'm2aitestkit';

test('summarizer returns structured output', async () => {
  const output = '{"summary":"Short.","keywords":["a"]}'; // replace with: await mySummarizer(input)
  await assertOutput(output, [isJson(), hasFields(['summary', 'keywords']), forbid({ pii: /\d{3}-\d{2}-\d{4}/ })]);
});
