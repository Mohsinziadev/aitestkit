import { defineSuite, fieldConstraint, forbid, hasFields, isJson, toolCalls } from "m2aitestkit";

declare function supportBot(input: { question: string }): Promise<string>;

export default defineSuite({
  name: "support-bot",
  run: (input) => supportBot(input as { question: string }), // your code, any provider
  cases: [
    {
      id: "refund-request",
      input: { question: "Can I get a refund?" },
      metadata: { model: "gpt-x", promptVersion: "v3" },
      assertions: [
        isJson(),
        hasFields(["answer", "refundAmount"]),
        fieldConstraint("refundAmount", { min: 0, max: 100 }),
        forbid({ "competitor-mention": /acme/i }),
        toolCalls({ allow: ["lookup_order"], forbid: ["issue_refund"] }),
      ],
    },
  ],
});
