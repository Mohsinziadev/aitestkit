import * as A from './assertions.ts';
import type { Assertion, Suite, TestCase, OutputLike, CaseMetadata } from './types.ts';

/** JSON-serializable assertion description, for saved test-case files. */
export type AssertionSpec =
  | { type: 'is-json' }
  | { type: 'schema'; schema: object }
  | { type: 'required-fields'; fields: string[]; nonNull?: boolean }
  | { type: 'only-fields'; fields: string[] }
  | { type: 'field-type'; field: string; is: A.JsonType | A.JsonType[] }
  | { type: 'field-constraint'; field: string; min?: number; max?: number; minLength?: number; maxLength?: number; minItems?: number; maxItems?: number; enum?: unknown[]; pattern?: string }
  | { type: 'equals-json'; value: unknown }
  | { type: 'equals-text'; value: string; trim?: boolean }
  | { type: 'contains'; value: string; ignoreCase?: boolean }
  | { type: 'matches'; pattern: string; flags?: string }
  | { type: 'max-length'; value: number }
  | { type: 'forbid'; rules: Record<string, string | { pattern: string; flags?: string }> }
  | { type: 'restrict-format'; formats: A.FormatName[] }
  | { type: 'refusal'; expected: boolean; patterns?: string[] }
  | { type: 'tool-calls'; allow?: string[]; forbid?: string[]; require?: string[]; maxCalls?: number; order?: string[] }
  | { type: 'similar-to'; reference: string; threshold: number };

export interface SuiteSpec {
  name: string;
  allowJsonFences?: boolean;
  cases: {
    id: string;
    input: unknown;
    output?: OutputLike;
    assertions: AssertionSpec[];
    metadata?: CaseMetadata;
    tags?: string[];
  }[];
}

export function assertionFromSpec(s: AssertionSpec): Assertion {
  const t = (s as { type?: string }).type;
  switch (s.type) {
    case 'is-json': return A.isJson();
    case 'schema': return A.matchesSchema(s.schema);
    case 'required-fields': return A.hasFields(s.fields, { nonNull: s.nonNull === true });
    case 'only-fields': return A.onlyFields(s.fields);
    case 'field-type': return A.fieldType(s.field, s.is);
    case 'field-constraint': {
      const { field, type: _t, pattern, ...rest } = s;
      return A.fieldConstraint(field, { ...rest, ...(pattern ? { pattern: new RegExp(pattern) } : {}) });
    }
    case 'equals-json': return A.equalsJson(s.value);
    case 'equals-text': return A.equalsText(s.value, { trim: s.trim === true });
    case 'contains': return A.contains(s.value, { ignoreCase: s.ignoreCase === true });
    case 'matches': return A.matches(new RegExp(s.pattern, s.flags));
    case 'max-length': return A.maxLength(s.value);
    case 'forbid':
      return A.forbid(
        Object.fromEntries(Object.entries(s.rules).map(([k, v]) => [k, typeof v === 'string' ? v : new RegExp(v.pattern, v.flags)])),
      );
    case 'restrict-format': return A.restrictFormat(s.formats);
    case 'refusal': return A.refusal(s.expected, s.patterns ? { patterns: s.patterns.map((p) => new RegExp(p, 'i')) } : {});
    case 'tool-calls': {
      const { type: _t, ...rules } = s;
      return A.toolCalls(rules);
    }
    case 'similar-to': return A.similarTo(s.reference, s.threshold);
    default:
      throw new Error(
        `unknown assertion type "${t}" in a JSON suite. Semantic and custom assertions need a JS/TS suite file.`,
      );
  }
}

export function suiteFromSpec(spec: SuiteSpec): Suite {
  if (!spec || typeof spec.name !== 'string' || !Array.isArray(spec.cases)) {
    throw new Error('suite must have a string "name" and a "cases" array');
  }
  return {
    name: spec.name,
    ...(spec.allowJsonFences ? { allowJsonFences: true } : {}),
    cases: spec.cases.map((c): TestCase => {
      if (typeof c.id !== 'string' || !Array.isArray(c.assertions)) throw new Error('each case needs a string "id" and an "assertions" array');
      return {
        id: c.id,
        input: c.input,
        ...(c.output !== undefined ? { output: c.output } : {}),
        ...(c.metadata ? { metadata: c.metadata } : {}),
        ...(c.tags ? { tags: c.tags } : {}),
        assertions: c.assertions.map(assertionFromSpec),
      };
    }),
  };
}
