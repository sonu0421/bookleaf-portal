import mongoose from 'mongoose';

export const TICKET_CATEGORIES = [
  'Royalty & Payments',
  'ISBN & Metadata Issues',
  'Printing & Quality',
  'Distribution & Availability',
  'Book Status & Production Updates',
  'General Inquiry',
];

export const TICKET_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
export const TICKET_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

const messageSchema = new mongoose.Schema(
  {
    senderRole: { type: String, enum: ['author', 'admin'], required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true, maxlength: 5000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const internalNoteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, maxlength: 2000 },
    createdBy: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketNo: { type: String, unique: true, index: true }, // BLF-0001
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', default: null }, // null = General / Account level
    subject: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 5000 },

    // AI classification (admin-overridable)
    category: { type: String, enum: TICKET_CATEGORIES, default: 'General Inquiry' },
    categoryOverridden: { type: Boolean, default: false },
    priority: { type: String, enum: TICKET_PRIORITIES, default: 'Medium' },
    priorityOverridden: { type: Boolean, default: false },

    status: { type: String, enum: TICKET_STATUSES, default: 'Open', index: true },
    assignedTo: { type: String, default: null }, // admin name

    messages: { type: [messageSchema], default: [] }, // visible to author
    internalNotes: { type: [internalNoteSchema], default: [] }, // admin-only

    // Latest AI-drafted reply (admin edits before sending)
    aiDraft: { type: String, default: '' },
    aiMeta: {
      model: { type: String, default: '' },
      fallbackUsed: { type: Boolean, default: false },
      promptTokens: { type: Number, default: 0 },
      completionTokens: { type: Number, default: 0 },
      generatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

// Human-readable ticket numbers: BLF-0001, BLF-0002, ...
ticketSchema.pre('save', async function () {
  if (!this.ticketNo) {
    const count = await this.constructor.countDocuments();
    this.ticketNo = `BLF-${String(count + 1).padStart(4, '0')}`;
  }
});

export const Ticket = mongoose.model('Ticket', ticketSchema);
