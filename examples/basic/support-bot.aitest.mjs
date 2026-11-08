// A suite with custom business rules. Run: npx m2aitestkit record examples/basic && npx m2aitestkit run examples/basic
import { defineSuite, isJson, hasFields, fieldConstraint, forbid, toolCalls, custom } from 'm2aitestkit';

// Stand-in for your real application (any provider, any framework).
async function supportBot({ question }) {
  return {
    text: JSON.stringify({ answer: `Thanks for asking: ${question}`, refundAmount: 25, currency: 'USD' }),
    toolCalls: [{ name: 'lookup_order', arguments: { id: 'A-1' } }],
  };
}

export default defineSuite({
  name: 'support-bot',
  run: supportBot,
  cases: [
    {
      id: 'refund-request',
      input: { question: 'Can I get a refund?' },
      metadata: { model: 'any-model', promptVersion: 'v3' },
      assertions: [
        isJson(),
        hasFields(['answer', 'refundAmount', 'currency']),
        fieldConstraint('refundAmount', { min: 0, max: 100 }),
        fieldConstraint('currency', { enum: ['USD', 'EUR'] }),
        forbid({ 'competitor-mention': /acme/i }),
        toolCalls({ allow: ['lookup_order'], forbid: ['issue_refund'] }),
        custom('refund-is-whole-cents', (ctx) => Number.isInteger(ctx.json.value.refundAmount * 100), { requiresJson: true }),
      ],
    },
  ],
});
