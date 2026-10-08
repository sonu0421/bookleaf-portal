/**
 * Seeds MongoDB with the BookLeaf sample dataset.
 * - 10 authors → User docs (role: author), password: "password123"
 * - 18 books  → Book docs linked to their author
 * - 1 admin   → admin@bookleaf.com / "admin123"
 * Run: npm run seed
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Book } from '../models/Book.js';
import { Ticket } from '../models/Ticket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = '/home/hatch/workspace/user/files/bookleaf_sample_data__full_stack___2___1___1.json';

const AUTHOR_PASSWORD = 'password123';
const ADMIN_EMAIL = 'admin@bookleaf.com';
const ADMIN_PASSWORD = 'admin123';

function toDate(v) {
  return v ? new Date(v) : null;
}

async function main() {
  await mongoose.connect(env.mongoUri);
  console.log('[seed] connected');

  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);

  // Wipe previous seed (tickets reference users/books)
  await Ticket.deleteMany({});
  await Book.deleteMany({});
  await User.deleteMany({});
  console.log('[seed] cleared collections');

  const passwordHash = await User.hashPassword(AUTHOR_PASSWORD);

  for (const a of data.authors) {
    const user = await User.create({
      name: a.name,
      email: a.email,
      passwordHash,
      role: 'author',
      phone: a.phone,
      city: a.city,
      joinedDate: toDate(a.joined_date),
      authorId: a.author_id,
    });

    for (const b of a.books) {
      await Book.create({
        author: user._id,
        bookId: b.book_id,
        title: b.title,
        isbn: b.isbn || '',
        genre: b.genre || '',
        publicationDate: toDate(b.publication_date),
        status: b.status || 'Published & Live',
        mrp: b.mrp ?? null,
        royaltyPerCopy: b.author_royalty_per_copy ?? null,
        copiesSold: b.total_copies_sold ?? 0,
        royaltyEarned: b.total_royalty_earned ?? 0,
        royaltyPaid: b.royalty_paid ?? 0,
        royaltyPending: b.royalty_pending ?? 0,
        lastRoyaltyPayoutDate: toDate(b.last_royalty_payout_date),
        printPartner: b.print_partner ?? null,
        availableOn: b.available_on ?? [],
      });
    }
    console.log(`[seed] author ${a.name} (${a.books.length} books)`);
  }

  await User.create({
    name: 'BookLeaf Admin',
    email: ADMIN_EMAIL,
    passwordHash: await User.hashPassword(ADMIN_PASSWORD),
    role: 'admin',
  });

  const counts = {
    users: await User.countDocuments(),
    books: await Book.countDocuments(),
  };
  console.log('[seed] done:', counts);
  console.log(`[seed] admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`[seed] author login example: priya.sharma@email.com / ${AUTHOR_PASSWORD}`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('[seed] failed:', e.message);
  process.exit(1);
});
