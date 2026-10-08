# Approach Note — BookLeaf Author Support Portal

## What I prioritised

**The AI pipeline first, UI second.** The assignment weights AI integration at 25% — the single largest criterion — so I designed the LLM layer before writing any frontend code. The key decision: **one LLM call per ticket** that returns classification + priority + draft together, instead of three separate calls. They share identical context (knowledge base + ticket), so splitting them would triple cost and latency for zero quality gain.

**Correctness over cleverness in the API.** Strict RBAC (authors physically cannot read other authors' tickets — enforced in query filters, not just hidden in UI), meaningful validation errors, and internal notes stripped at the serialisation layer so a frontend bug can never leak them.

## Trade-offs I made

1. **Groq (Llama 3.3 70B) over OpenAI.** Free tier, very low latency, JSON mode. The trade-off is vendor dependence on a younger provider; the AI service is isolated in one module (`aiService.js`) so swapping to `gpt-4o-mini` is a config change, not a rewrite.
2. **Fire-and-forget AI analysis.** Tickets save synchronously; classification attaches seconds later. Authors never stare at an LLM spinner, but admins may briefly see "General Inquiry / Medium" on a brand-new ticket. I judged responsiveness worth it.
3. **Keyword fallback instead of queue-and-retry.** If the LLM is down, the system degrades to a deterministic classifier immediately rather than queueing for retry. Support can't stop because an API is having a bad hour — but the fallback is visibly badged in the admin UI so nobody mistakes it for an AI draft.
4. **Functional UI, not pixel-perfect.** Per the brief's explicit guidance, I invested in the ticket workflow (filters, overrides, draft editing, real-time) over visual polish.

## How I'd evolve this to production

- **Retrieval over stuffing:** as the KB grows, replace the static prompt with RAG (embed KB articles, retrieve top-3 per ticket) to hold token costs flat.
- **Human-in-the-loop learning:** log every admin override of category/priority; use that as labelled data to fine-tune or few-shot-calibrate the classifier monthly.
- **Confidence gating:** below a confidence threshold, route to a human first instead of showing a draft — bad auto-drafts erode trust faster than no drafts.
- **Notifications:** email/SMS for offline authors; SLA timers with escalation when Critical tickets age past threshold.
- **Audit & analytics:** immutable activity log per ticket; dashboard on resolution times and AI accuracy (override rate) to prove ROI to leadership.
