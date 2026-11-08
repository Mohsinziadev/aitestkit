import { normalizeOutput, evaluateOutput } from './runner.ts';
import type { Assertion, AssertionResult, OutputLike } from './types.ts';

export class M2AITestKitAssertionError extends Error {
  results: AssertionResult[];
  constructor(results: AssertionResult[]) {
    const lines = results
      .filter((r) => r.status !== 'pass')
      .map((r) => `  [${r.status}] ${r.id}${r.message ? ': ' + r.message : ''}`);
    super(`${lines.length} of ${results.length} AI output assertion(s) did not pass:\n${lines.join('\n')}`);
    this.name = 'M2AITestKitAssertionError';
    this.results = results;
  }
}

/**
 * Runner-agnostic assertion for vitest, jest, node:test, mocha...: throws unless every
 * assertion passes. `unevaluable` counts as not passing.
 *
 *   await assertOutput(await myApp(input), [isJson(), hasFields(['answer'])]);
 */
export async function assertOutput(
  output: OutputLike,
  assertions: Assertion[],
  opts: { input?: unknown; allowJsonFences?: boolean } = {},
): Promise<AssertionResult[]> {
  const results = await evaluateOutput(assertions, normalizeOutput(output), opts.input, {
    allowJsonFences: opts.allowJsonFences ?? false,
  });
  if (results.some((r) => r.status !== 'pass')) throw new M2AITestKitAssertionError(results);
  return results;
}
