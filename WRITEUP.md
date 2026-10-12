# Approach Note — BookLeaf Author Support Portal

## What I focused on

I started with the AI layer since it's worth 25% of the evaluation, the most of any single criterion. The main call I made early: one LLM call per ticket that returns the category, priority, and draft reply together. All three need the same context (knowledge base + ticket details), so making three separate calls would have tripled the cost and latency for no real benefit.

For the API, I kept it strict on access control. Authors can only see their own tickets, enforced in the database queries themselves, not just hidden in the UI. Internal notes are stripped out before sending data to authors, so even a frontend bug can't leak them.

## Trade-offs

**Groq over OpenAI.** I used Groq's free tier (model set via `GROQ_MODEL` env var, default `openai/gpt-oss-120b`) because it's fast and has JSON mode. The downside is relying on a smaller provider, so I kept all the AI logic in one file (`aiService.js`). Switching models later is just a config change, no code change.

**AI runs in the background.** The ticket gets saved first, and classification happens a few seconds later. This means authors never wait for the LLM, but an admin might briefly see a new ticket with default category/priority before the AI result comes in. I thought the responsiveness was worth it.

**Keyword fallback instead of retry queues.** If Groq is down, the system falls back to a simple keyword classifier right away instead of queueing for retry. Support tickets shouldn't stop working because an API is having a bad day. The admin UI shows a badge when the fallback was used, so it's clear the result didn't come from the AI.

**Functional UI over polished UI.** The brief said not to over-invest in visual polish, so I put the effort into the ticket workflow: filters, category overrides, draft editing, and real-time updates.

## If I were taking this to production

- **RAG for the knowledge base.** Right now the KB is a static prompt. As it grows, I'd switch to embeddings and retrieve only the relevant articles per ticket to keep token costs flat.
- **Learn from overrides.** Every time an admin corrects the AI's category or priority, that's labeled training data. I'd use it to improve the classifier over time.
- **Confidence threshold.** If the model isn't confident, route to a human first instead of showing a weak draft. A bad auto-draft hurts trust more than no draft at all.
- **Notifications.** Email/SMS for authors who aren't online, plus SLA timers that escalate when critical tickets sit too long.
- **Audit log.** Track who changed status, category, and priority on each ticket, and add analytics on resolution times.
