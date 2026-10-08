import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookId: { type: String, required: true, unique: true }, // e.g. BK001
    title: { type: String, required: true, trim: true },
    isbn: { type: String, default: '' },
    genre: { type: String, default: '' },
    publicationDate: { type: Date, default: null },
    status: { type: String, default: 'Published & Live' },
    mrp: { type: Number, default: null },
    royaltyPerCopy: { type: Number, default: null },
    copiesSold: { type: Number, default: 0 },
    royaltyEarned: { type: Number, default: 0 },
    royaltyPaid: { type: Number, default: 0 },
    royaltyPending: { type: Number, default: 0 },
    lastRoyaltyPayoutDate: { type: Date, default: null },
    printPartner: { type: String, default: null },
    availableOn: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const Book = mongoose.model('Book', bookSchema);
