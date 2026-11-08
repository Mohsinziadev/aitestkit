import { diffReports, formatPretty, runSuite, suiteFromSpec, type AssertionSpec, type Diff, type RunReport } from "m2aitestkit";

export type Input = {
  /** What was sent to the model. Only a hash of it is ever stored. */
  input: string;
  /** The known-good output you recorded and committed. */
  baseline: string;
  /** What the application produces now, after a prompt, model or retrieval change. */
  current: string;
  assertions: AssertionSpec[];
};

export type Evaluation = { baseline: RunReport; current: RunReport; diff: Diff; text: string };

/** The same functions the CLI uses: replay each output against the assertions, then diff the two runs. */
export async function evaluate({ input, baseline, current, assertions }: Input): Promise<Evaluation> {
  const replay = async (output: string): Promise<RunReport> => {
    const suite = suiteFromSpec({ name: "demo", cases: [{ id: "reply", input, output, assertions }] });
    return (await runSuite(suite, { mode: "replay" })).report;
  };
  const before = await replay(baseline);
  const after = await replay(current);
  const diff = diffReports(before, after);
  return { baseline: before, current: after, diff, text: formatPretty(after, diff) };
}
