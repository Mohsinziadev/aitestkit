import type { Output } from './types.ts';

/**
 * A semantic evaluator judges an output against criteria you wrote.
 * It may be a local function, a classifier, or a hosted LLM. m2aitestkit ships no
 * model-backed evaluator and never calls one unless you pass it in. Set
 * `usesExternalService: true` when evaluate() sends data off the machine so that
 * reports flag it.
 */
export interface Evaluator {
  name: string;
  usesExternalService: boolean;
  evaluate(args: { output: Output; input: unknown; criteria: string }): Promise<EvaluatorVerdict> | EvaluatorVerdict;
}

export interface EvaluatorVerdict {
  pass: boolean;
  score?: number;
  reason?: string;
}

export function defineEvaluator(e: Evaluator): Evaluator {
  return e;
}

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

/**
 * Jaccard overlap of word sets, 0..1. A cheap, offline, deterministic *lexical*
 * measure. It cannot tell a correct answer from a fluent wrong one.
 */
export function lexicalSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}
