import { Router } from 'express';
import { Book } from '../models/Book.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/books — author's own books.
 * Admins: ?authorId=<id> to view any author's books (for ticket context).
 */
router.get('/', async (req, res, next) => {
  try {
    let authorId = req.user._id;
    if (req.user.role === 'admin' && req.query.authorId) {
      authorId = req.query.authorId;
    } else if (req.user.role !== 'admin' && req.query.authorId) {
      return res.status(403).json({ error: 'Authors can only view their own books' });
    }

    const books = await Book.find({ author: authorId }).sort({ title: 1 }).lean();
    res.json({ books });
  } catch (err) {
    next(err);
  }
});

/** GET /api/books/:id — single book (must belong to the author, unless admin) */
router.get('/:id', async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id).lean();
    if (!book) return res.status(404).json({ error: 'Book not found' });
    if (req.user.role !== 'admin' && String(book.author) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not your book' });
    }
    res.json({ book });
  } catch (err) {
    next(err);
  }
});

export default router;
