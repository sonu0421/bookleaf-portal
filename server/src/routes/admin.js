import { Router } from 'express';
import { Ticket, TICKET_STATUSES, TICKET_CATEGORIES, TICKET_PRIORITIES } from '../models/Ticket.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { regenerateDraft } from '../services/aiService.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

/** PATCH /api/admin/tickets/:id — status, category/priority override, assign */
router.patch('/tickets/:id', async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const { status, category, priority, assignedTo } = req.body || {};

    if (status !== undefined) {
      if (!TICKET_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Use: ${TICKET_STATUSES.join(', ')}` });
      }
      ticket.status = status;
    }
    if (category !== undefined) {
      if (!TICKET_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }
      ticket.category = category;
      ticket.categoryOverridden = true; // admin knows better than the AI
    }
    if (priority !== undefined) {
      if (!TICKET_PRIORITIES.includes(priority)) {
        return res.status(400).json({ error: 'Invalid priority' });
      }
      ticket.priority = priority;
      ticket.priorityOverridden = true;
    }
    if (assignedTo !== undefined) {
      ticket.assignedTo = String(assignedTo).slice(0, 80) || null;
    }

    await ticket.save();
    req.app.get('io')?.to(`ticket-${ticket._id}`).emit('ticket:updated', { ticketId: ticket._id });

    res.json({ ticket });
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/tickets/:id/notes — internal note (never visible to author) */
router.post('/tickets/:id/notes', async (req, res, next) => {
  try {
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'Note text is required' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    ticket.internalNotes.push({ text: text.trim().slice(0, 2000), createdBy: req.user.name });
    await ticket.save();
    res.status(201).json({ ticket });
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/tickets/:id/regenerate-draft — fresh AI draft on demand */
router.post('/tickets/:id/regenerate-draft', async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('author', 'name').populate('book');
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const { draftReply, aiMeta } = await regenerateDraft({
      authorName: ticket.author.name,
      book: ticket.book
        ? { title: ticket.book.title, isbn: ticket.book.isbn, status: ticket.book.status, copiesSold: ticket.book.copiesSold, royaltyEarned: ticket.book.royaltyEarned, royaltyPaid: ticket.book.royaltyPaid, royaltyPending: ticket.book.royaltyPending }
        : null,
      subject: ticket.subject,
      description: ticket.description,
    });

    ticket.aiDraft = draftReply;
    ticket.aiMeta = aiMeta;
    await ticket.save();
    res.json({ aiDraft: ticket.aiDraft, aiMeta: ticket.aiMeta });
  } catch (err) {
    next(err);
  }
});

/** GET /api/admin/stats — queue overview for the admin dashboard */
router.get('/stats', async (req, res, next) => {
  try {
    const [byStatus, byPriority, total] = await Promise.all([
      Ticket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Ticket.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
      Ticket.countDocuments(),
    ]);
    // Oldest unresolved = needs attention first
    const oldestOpen = await Ticket.find({ status: { $in: ['Open', 'In Progress'] } })
      .sort({ createdAt: 1 })
      .limit(5)
      .populate('author', 'name')
      .select('ticketNo subject priority createdAt author')
      .lean();
    res.json({ total, byStatus, byPriority, oldestOpen });
  } catch (err) {
    next(err);
  }
});

export default router;
