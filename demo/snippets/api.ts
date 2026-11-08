import { assertOutput, hasFields, isJson } from "m2aitestkit";

declare function summarize(doc: string): Promise<string>;

// Works under node:test, vitest, jest or mocha: it only throws.
await assertOutput(await summarize("…"), [isJson(), hasFields(["summary"])]);
