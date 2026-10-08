import { Router } from 'express';
import { Ticket, TICKET_STATUSES, TICKET_CATEGORIES, TICKET_PRIORITIES } from '../models/Ticket.js';
import { Book } from '../models/Book.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { analyzeTicket, regenerateDraft } from '../services/aiService.js';

const router = Router();
router.use(requireAuth);

function ticketFilterFor(user, query) {
  const filter = {};
  if (user.role === 'author') {
    filter.author = user._id;
  }
  if (query.status && TICKET_STATUSES.includes(query.status)) filter.status = query.status;
  if (query.category && TICKET_CATEGORIES.includes(query.category)) filter.category = query.category;
  if (query.priority && TICKET_PRIORITIES.includes(query.priority)) filter.priority = query.priority;
  if (query.search) {
    filter.$or = [
      { subject: { $regex: query.search, $options: 'i' } },
      { ticketNo: { $regex: query.search, $options: 'i' } },
    ];
  }
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) {
      const from = new Date(query.from);
      if (!isNaN(from)) filter.createdAt.$gte = from;
    }
    if (query.to) {
      const to = new Date(query.to);
      if (!isNaN(to)) {
        to.setHours(23, 59, 59, 999); // include the whole day
        filter.createdAt.$lte = to;
      }
    }
    if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
  }
  return filter;
}

/** GET /api/tickets — list (authors: own only; admins: all + filters) */
router.get('/', async (req, res, next) => {
  try {
    const filter = ticketFilterFor(req.user, req.query);
    const tickets = await Ticket.find(filter)
      .populate('author', 'name email')
      .populate('book', 'title isbn')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ tickets });
  } catch (err) {
    next(err);
  }
});

/** GET /api/tickets/:id — detail (ownership enforced; internalNotes hidden from authors) */
router.get('/:id', async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('author', 'name email phone city')
      .populate('book')
      .lean();
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (req.user.role !== 'admin' && String(ticket.author._id) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not your ticket' });
    }
    if (req.user.role !== 'author') {
      // admins also get the author's other books for context
      const books = await Book.find({ author: ticket.author._id }).lean();
      ticket.authorBooks = books;
    } else {
      delete ticket.internalNotes;
      delete ticket.aiMeta;
    }
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/tickets — author creates a ticket.
 * AI analysis runs async (non-blocking): ticket is created immediately,
 * category/priority/draft attach when the AI finishes.
 */
router.post('/', requireRole('author'), async (req, res, next) => {
  try {
    const { bookId, subject, description } = req.body || {};
    if (!subject || subject.trim().length < 3) {
      return res.status(400).json({ error: 'Subject must be at least 3 characters' });
    }
    if (!description || description.trim().length < 10) {
      return res.status(400).json({ error: 'Description must be at least 10 characters' });
    }

    let book = null;
    if (bookId) {
      book = await Book.findById(bookId);
      if (!book || String(book.author) !== String(req.user._id)) {
        return res.status(400).json({ error: 'Invalid book selected' });
      }
    }

    const ticket = await Ticket.create({
      author: req.user._id,
      book: book?._id || null,
      subject: subject.trim(),
      description: description.trim(),
    });

    // Fire-and-forget AI analysis — never blocks ticket creation.
    analyzeTicket({
      authorName: req.user.name,
      book: book
        ? { title: book.title, isbn: book.isbn, status: book.status, copiesSold: book.copiesSold, royaltyEarned: book.royaltyEarned, royaltyPaid: book.royaltyPaid, royaltyPending: book.royaltyPending }
        : null,
      subject: ticket.subject,
      description: ticket.description,
    })
      .then(async (ai) => {
        // Don't overwrite admin's manual overrides made in the meantime
        const fresh = await Ticket.findById(ticket._id);
        if (!fresh) return;
        if (!fresh.categoryOverridden) fresh.category = ai.category;
        if (!fresh.priorityOverridden) fresh.priority = ai.priority;
        fresh.aiDraft = ai.draftReply;
        fresh.aiMeta = ai.aiMeta;
        await fresh.save();
        req.app.get('io')?.to(`ticket-${ticket._id}`).emit('ticket:updated', { ticketId: ticket._id });
        req.app.get('io')?.to('admins').emit('ticket:created', { ticketId: ticket._id, ticketNo: fresh.ticketNo });
      })
      .catch((e) => console.warn('[tickets] AI analysis failed silently:', e.message));

    // Notify admins of the new ticket right away
    req.app.get('io')?.to('admins').emit('ticket:created', { ticketId: ticket._id });

    res.status(201).json({ ticket: ticket.toObject() });
  } catch (err) {
    next(err);
  }
});

/** POST /api/tickets/:id/messages — author or admin adds a reply */
router.post('/:id/messages', async (req, res, next) => {
  try {
    const { text } = req.body || {};
    if (!text || text.trim().length < 1) {
      return res.status(400).json({ error: 'Message text is required' });
    }
    if (text.length > 5000) {
      return res.status(400).json({ error: 'Message too long (max 5000 chars)' });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (req.user.role !== 'admin' && String(ticket.author) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not your ticket' });
    }
    if (ticket.status === 'Closed') {
      return res.status(400).json({ error: 'Ticket is closed' });
    }

    ticket.messages.push({
      senderRole: req.user.role,
      senderName: req.user.name,
      text: text.trim(),
    });
    // Auto-move Open → In Progress when admin first replies
    if (req.user.role === 'admin' && ticket.status === 'Open') {
      ticket.status = 'In Progress';
    }
    await ticket.save();

    req.app.get('io')?.to(`ticket-${ticket._id}`).emit('ticket:message', {
      ticketId: ticket._id,
      message: ticket.messages[ticket.messages.length - 1],
    });

    res.status(201).json({ ticket });
  } catch (err) {
    next(err);
  }
});

export default router;
