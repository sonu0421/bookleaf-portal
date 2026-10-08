/**
 * AI service — single LLM call per ticket that returns:
 *   { category, priority, draftReply }
 *
 * COST DESIGN (why one call, not three):
 * - Classification + priority + draft share the same context (KB + ticket).
 * - 1 call ≈ 900 input tokens + 400 output ≈ $0.0002 on llama-3.3-70b via Groq (free tier).
 * - Drafts regenerate ONLY on explicit admin request, never on page view.
 * - Token usage is logged per ticket (aiMeta) for cost visibility.
 *
 * GRACEFUL DEGRADATION:
 * - Any LLM failure (timeout, 429, 5xx, no key) → keyword fallback classifier
 *   + template draft. Ticket creation NEVER fails because of AI.
 */
import axios from 'axios';
import { env } from '../config/env.js';
import { KNOWLEDGE_BASE } from './knowledgeBase.js';
import { fallbackClassify, fallbackDraft } from './fallbackClassifier.js';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../models/Ticket.js';

const SYSTEM_PROMPT = `You are a senior support analyst at BookLeaf Publishing, a self-publishing company.
${KNOWLEDGE_BASE}

YOUR TASK: Analyze the author's support ticket below and return STRICT JSON (no markdown, no commentary):
{
  "category": "<one of: ${TICKET_CATEGORIES.join(' | ')}>",
  "priority": "<one of: ${TICKET_PRIORITIES.join(' | ')}>",
  "draftReply": "<a ready-to-send reply following the TONE guidelines, using the KNOWLEDGE BASE facts. Address the author by name. Be specific with numbers/dates from the ticket context when available. End with a clear next step. 120-220 words.>"
}

Priority guidance: Critical = money missing for months / legal threats / data corruption (wrong ISBN); High = overdue payments, confirmed errors, quality defects; Medium = status questions, update requests; Low = general info, bio/profile tweaks.

Draft reply rules: empathetic first line acknowledging the concern; never invent policy facts outside the knowledge base; if the query needs investigation, promise a 48-hour update; own BookLeaf's mistakes directly.`;

function buildUserMessage({ authorName, book, subject, description }) {
  const bookCtx = book
    ? `Book: "${book.title}" | ISBN: ${book.isbn || 'N/A'} | Status: ${book.status} | Copies sold: ${book.copiesSold} | Royalty earned: ₹${book.royaltyEarned} | Paid: ₹${book.royaltyPaid} | Pending: ₹${book.royaltyPending}`
    : 'Book: General / Account level (no specific book)';
  return `Author: ${authorName}\n${bookCtx}\nSubject: ${subject}\nQuery:\n${description}`;
}

function safeParseJson(text) {
  // Strip accidental markdown fences
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in LLM output');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function analyzeTicket({ authorName, book, subject, description }) {
  const startedAt = Date.now();

  // No key configured → straight to fallback (documented in README)
  if (!env.groqApiKey) {
    const fb = fallbackClassify(subject, description);
    return {
      ...fb,
      draftReply: fallbackDraft({ subject }, authorName, book?.title),
      aiMeta: { model: 'fallback-keyword', fallbackUsed: true, generatedAt: new Date() },
    };
  }

  try {
    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: env.groqModel,
        temperature: 0.3, // low = consistent classification
        max_tokens: 600, // cap output cost
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage({ authorName, book, subject, description }) },
        ],
      },
      {
        headers: { Authorization: `Bearer ${env.groqApiKey}` },
        timeout: 25000,
      }
    );

    const raw = res.data.choices?.[0]?.message?.content || '';
    const parsed = safeParseJson(raw);
    const usage = res.data.usage || {};

    // Validate enums — never trust raw LLM output blindly
    const category = TICKET_CATEGORIES.includes(parsed.category) ? parsed.category : 'General Inquiry';
    const priority = TICKET_PRIORITIES.includes(parsed.priority) ? parsed.priority : 'Medium';

    console.log(`[ai] ticket analyzed in ${Date.now() - startedAt}ms | tokens: ${usage.prompt_tokens}/${usage.completion_tokens}`);

    return {
      category,
      priority,
      draftReply: String(parsed.draftReply || '').slice(0, 3000),
      aiMeta: {
        model: env.groqModel,
        fallbackUsed: false,
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        generatedAt: new Date(),
      },
    };
  } catch (err) {
    console.warn('[ai] LLM failed, using fallback:', err.message);
    const fb = fallbackClassify(subject, description);
    return {
      ...fb,
      draftReply: fallbackDraft({ subject }, authorName, book?.title),
      aiMeta: { model: `${env.groqModel} (failed)`, fallbackUsed: true, generatedAt: new Date() },
    };
  }
}

/** Regenerate only the draft (admin clicked "Regenerate"). Reuses analyzeTicket. */
export async function regenerateDraft(ticketCtx) {
  const result = await analyzeTicket(ticketCtx);
  return { draftReply: result.draftReply, aiMeta: result.aiMeta };
}
