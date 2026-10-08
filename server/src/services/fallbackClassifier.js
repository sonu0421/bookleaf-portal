/**
 * Rule-based fallback classifier — used when the LLM API is unavailable.
 * Keyword scoring per category + priority heuristics. Deterministic, zero cost.
 */
import { TICKET_CATEGORIES } from '../models/Ticket.js';

const CATEGORY_KEYWORDS = {
  'Royalty & Payments': ['royalty', 'royalties', 'payment', 'paid', 'payout', 'money', 'earn', 'earning', 'rupee', 'rs', '₹', 'bank', 'transfer', 'quarter'],
  'ISBN & Metadata Issues': ['isbn', 'metadata', 'title wrong', 'author name', 'description', 'cover', 'imprint', 'duplicate'],
  'Printing & Quality': ['print', 'printing', 'quality', 'misprint', 'blurry', 'binding', 'pages', 'color', 'defect', 'damaged', 'reprint'],
  'Distribution & Availability': ['amazon', 'flipkart', 'unavailable', 'out of stock', 'listing', 'store', 'distribution', 'available', 'sync'],
  'Book Status & Production Updates': ['status', 'production', 'typesetting', 'proofreading', 'editing', 'publish', 'published', 'delay', 'when will', 'stage', 'manuscript'],
  'General Inquiry': ['hello', 'hi', 'general', 'question', 'help', 'account', 'bio', 'profile'],
};

const PRIORITY_RULES = [
  { priority: 'Critical', keywords: ['not received', '6 months', 'months', 'fraud', 'legal', 'court', 'urgent', 'immediately', 'wrong isbn', 'duplicate isbn'] },
  { priority: 'High', keywords: ['delay', 'overdue', 'error', 'wrong', 'missing', 'broken', 'terrible', 'refund', 'complaint'] },
  { priority: 'Medium', keywords: ['update', 'change', 'when', 'status', 'how', 'request'] },
];

export function fallbackClassify(subject, description) {
  const text = `${subject} ${description}`.toLowerCase();

  let bestCategory = 'General Inquiry';
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((s, kw) => s + (text.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }

  let priority = 'Low';
  for (const rule of PRIORITY_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      priority = rule.priority;
      break; // first (highest) match wins
    }
  }

  return { category: bestCategory, priority, confidence: bestScore > 0 ? 'keyword-match' : 'default' };
}

export function fallbackDraft(ticket, authorName, bookTitle) {
  const lines = [
    `Dear ${authorName},`,
    '',
    `Thank you for reaching out about "${ticket.subject}".`,
    '',
    'We have received your query and our team is looking into it. ' +
      'Based on our standard process, we will get back to you with a detailed update within 48 hours.',
    '',
    bookTitle ? `This is regarding your book "${bookTitle}".` : 'This is regarding your account.',
    '',
    'If you have any additional details or documents to share, please reply to this ticket.',
    '',
    'Warm regards,',
    'BookLeaf Support Team',
  ];
  return lines.join('\n');
}

export { TICKET_CATEGORIES };
