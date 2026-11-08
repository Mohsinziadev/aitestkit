import type { AssertionSpec } from "m2aitestkit";
import { evaluate } from "../snippets/playground/evaluate";

export type Preset = {
  id: string;
  label: string;
  note: string;
  input: string;
  baseline: string;
  current: string;
  assertions: AssertionSpec[];
};

export const PRESETS: Preset[] = [
  {
    id: "drift",
    label: "A prompt tweak drops a field",
    note: "The new output is still valid JSON, but vendor is gone and total became a string. Two assertions that passed in the baseline now fail, so CI blocks.",
    input: "Extract the invoice: Invoice #1001 from Initech, total $120.50",
    baseline: `{"invoiceNumber":"1001","vendor":"Initech","total":120.5}`,
    current: `{"invoiceNumber":"1001","total":"$120.50"}`,
    assertions: [
      { type: "is-json" },
      { type: "required-fields", fields: ["invoiceNumber", "vendor", "total"] },
      { type: "field-type", field: "total", is: "number" },
      { type: "forbid", rules: { "no-markdown": { pattern: "\\*\\*" } } },
    ],
  },
  {
    id: "fences",
    label: "Output wrapped in a code fence",
    note: "The model started wrapping JSON in a Markdown fence. The JSON checks report unevaluable, not pass and not fail, because the output could not be parsed. Set allowJsonFences on the suite if that is acceptable.",
    input: "Extract the invoice: Invoice #1001 from Initech, total $120.50",
    baseline: `{"invoiceNumber":"1001","vendor":"Initech","total":120.5}`,
    current: "Here is the invoice:\n```json\n{\"invoiceNumber\":\"1001\",\"vendor\":\"Initech\",\"total\":120.5}\n```",
    assertions: [
      { type: "is-json" },
      { type: "required-fields", fields: ["invoiceNumber", "vendor", "total"] },
      { type: "field-type", field: "total", is: "number" },
    ],
  },
  {
    id: "leak",
    label: "A reply leaks a competitor",
    note: "Free text, so the checks are rules: forbidden content, a length cap and a phrase. The failure message names the rule, never the offending text.",
    input: "Which plan should I pick?",
    baseline: "The Team plan fits most groups and includes priority support.",
    current: "Honestly, Acme does this better, but the Team plan is fine if you must.",
    assertions: [
      { type: "forbid", rules: { "competitor-mention": { pattern: "acme", flags: "i" } } },
      { type: "max-length", value: 120 },
      { type: "contains", value: "Team plan" },
    ],
  },
  {
    id: "stable",
    label: "A safe rewording",
    note: "The wording changed, so the output hash changed, but every assertion still passes. That shows as an informational output-changed line and the gate stays green.",
    input: "Which plan should I pick?",
    baseline: "The Team plan fits most groups and includes priority support.",
    current: "Most groups pick the Team plan; it includes priority support.",
    assertions: [
      { type: "forbid", rules: { "competitor-mention": { pattern: "acme", flags: "i" } } },
      { type: "max-length", value: 120 },
      { type: "contains", value: "Team plan" },
    ],
  },
];

const first = PRESETS[0]!;

/** The hero card and the playground's first state: computed by the library, once, when the module loads. */
export const hero = await evaluate({ input: first.input, baseline: first.baseline, current: first.current, assertions: first.assertions });
