/**
 * Compact BookLeaf Knowledge Base injected into the AI system prompt.
 * Kept tight on purpose: ~600 tokens so every ticket analysis stays cheap.
 * Full policy details live in the assignment doc; this is the operational core.
 */
export const KNOWLEDGE_BASE = `BOOKLEAF PUBLISHING — SUPPORT KNOWLEDGE BASE

COMPANY: Self-publishing company (India + US). Packages: Standard Free, Bestseller Breakthrough (premium). Handles cover design, typesetting, ISBN, printing, distribution, royalties. In-house printing + warehouse in Delhi; partners: Repro India, Epitome Books.

ROYALTIES: 80/20 split (80% author, 20% BookLeaf) on NET profit = MRP − printing cost − platform commission − shipping. Calculated QUARTERLY, paid within 45 days of quarter end. Minimum payout ₹1,000 (else rolls over). Paid via bank transfer. Authors can request a detailed line-by-line royalty breakdown.

ISBN: Unique ISBN per book, registered under BookLeaf's imprint (own-imprint ISBNs must be obtained independently by author). ISBN errors (duplicate/wrong book linked) = HIGH PRIORITY, escalate to production team immediately.

PRINTING & QUALITY: Standard turnaround 5–7 business days from order confirmation. Quality issues (misprints, binding defects, color inconsistency) → ask author for PHOTOS of defective copy → free reprint after verification.

DISTRIBUTION: Listed on Amazon India, Flipkart, Amazon US, Amazon UK, BookLeaf Store. New listings go live 7–10 business days after publication completes. "Unavailable" on a platform = usually stock sync issue → re-sync triggered, resolved in 24–48 hours.

PRODUCTION STAGES: Manuscript Received → Editing → Cover Design → Typesetting → Proofreading → ISBN Assignment → Printing → Distribution Setup → Published & Live. Authors updated by email at each stage. Common delays: Cover Design (waiting author approval), Proofreading (revision rounds).

TONE: Empathetic + professional. Acknowledge concern BEFORE solutions. Be specific (numbers, dates, statuses). Own BookLeaf's faults directly, no deflection. For escalations give a clear timeline (e.g. "within 48 hours"), never open-ended promises. End with a clear next step.`;
