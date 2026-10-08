# BookLeaf — Author Support & Communication Portal

Support portal for BookLeaf Publishing. Authors can view their books with royalty figures, raise support tickets, and chat with the support team in real time. Admins get a ticket queue with AI-assisted classification, priority scoring, and draft replies.

**Live Demo:** https://bookleaf-portal-one.vercel.app
**Stack:** React (Vite), Node.js (Express), MongoDB (Mongoose), Socket.io, Groq API

## Test Login

Seed data includes 1 admin and 10 authors:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@bookleaf.com | admin123 |
| Author | priya.sharma@email.com | password123 |

All 10 sample authors use `password123`.

## Run Locally

Need Node.js 18+ and MongoDB (local or Atlas).

```bash
# Backend
cd server
cp .env.example .env    # set MONGO_URI, JWT_SECRET, GROQ_API_KEY
npm install
npm run seed            # loads authors, books, admin user
npm run dev             # http://localhost:5000

# Frontend (separate terminal)
cd client
npm install
npm run dev             # http://localhost:5173
```

## How It's Built

React frontend talks to an Express REST API (JWT auth, role-based access). Socket.io handles real-time ticket messages. When an author submits a ticket, the backend saves it immediately and then calls Groq in the background to classify it, score priority, and draft a reply. If the AI call fails, a keyword-based fallback kicks in so tickets never break.

```
React (Vite)  <--REST + JWT / Socket.io-->  Express API  -->  MongoDB
                                                      |
                                                 (background)
                                                      v
                                                   Groq API
```

### Design decisions

- **Groq (Llama 3.3 70B):** free tier, fast, supports JSON mode. The AI code is isolated in `aiService.js` so swapping providers is easy.
- **One LLM call per ticket** for category + priority + draft. They share the same context, so three separate calls would just triple the cost.
- **Keyword fallback** if Groq is down, rate-limited, or has no key. Ticket creation never depends on AI being up.
- **Fire-and-forget AI:** ticket saves first, AI attaches a few seconds later. Authors don't wait on LLM latency.
- **Socket.io rooms:** per-ticket rooms for real-time messages, plus an `admins` room for new ticket alerts. JWT checked on handshake.

### Data models

- **User** — name, email (unique), password hash (bcrypt), role (author/admin)
- **Book** — author ref, title, ISBN, genre, status, MRP, copies sold, royalty earned/paid/pending
- **Ticket** — ticket number (BLF-0001), author ref, book ref (optional), subject, description, category, priority, status, assignee, messages array (author-visible), internal notes array (admin-only), AI draft, AI metadata

## AI Integration

### Flow

1. Author submits ticket. Saved immediately with default category/priority.
2. Background job sends to Groq:
   - System prompt = short knowledge base (~600 tokens) + tone rules + JSON schema
   - User message = author name + book context (royalty numbers, status) + subject + description
   - `temperature: 0.3`, `max_tokens: 600`, JSON mode
3. Response is validated against allowed categories/priorities (LLM output is never trusted raw), then saved.
4. Admin opens the ticket, sees the draft, edits it, sends. Drafts only regenerate when the admin clicks the button.

Prompt and KB code: `server/src/services/aiService.js` and `knowledgeBase.js`.

### When things fail

- No API key configured: keyword fallback runs right away
- Timeout / 429 / 5xx: caught, fallback used, ticket keeps working
- Bad JSON from LLM: stripped and retried, then fallback
- Invalid category/priority value: replaced with safe defaults

### Cost

- 1 LLM call per ticket (not 3)
- Drafts regenerate only on admin click, not on page load
- Token usage logged per ticket (`aiMeta`) so you can audit cost in the admin UI
- Roughly 1,300 tokens per ticket, effectively free on Groq's free tier

### Key security

The Groq key lives only in the server `.env` file. It's gitignored, never sent to the frontend, never hardcoded.

## API

Base: `/api`. Everything except `POST /auth/login` needs `Authorization: Bearer <token>`.

**Auth**
- `POST /auth/login` — {email, password}, rate-limited
- `GET /auth/me` — current user

**Books**
- `GET /books` — author gets own books; admin can pass `?authorId=`
- `GET /books/:id`

**Tickets**
- `GET /tickets?status=&category=&priority=&search=` — authors see own, admins see all
- `GET /tickets/:id` — internal notes stripped for authors
- `POST /tickets` — {bookId?, subject, description}, author only
- `POST /tickets/:id/messages` — {text}, author or admin reply

**Admin**
- `PATCH /admin/tickets/:id` — {status?, category?, priority?, assignedTo?}
- `POST /admin/tickets/:id/notes` — {text}, internal only
- `POST /admin/tickets/:id/regenerate-draft`
- `GET /admin/stats` — counts, oldest unresolved tickets

**Socket.io events** (JWT in handshake)
- `ticket:join` / `ticket:leave` — client to server
- `ticket:message`, `ticket:updated` — server to room
- `ticket:created` — server to admins room

Errors return `{ "error": "message" }` with standard status codes (400/401/403/404).

## Limitations

- No file attachments on tickets (was marked bonus in the brief)
- Ticket list capped at 100, no pagination yet
- Single admin role, no team-level permissions
- No email notifications, in-app only for now
- No audit log of who changed what on a ticket

## Structure

```
server/src/
  index.js          — Express + Socket.io setup
  config/           — env, db connection
  models/           — User, Book, Ticket
  middleware/       — auth, RBAC, error handler
  routes/           — auth, books, tickets, admin
  services/
    aiService.js          — Groq integration
    knowledgeBase.js      — support KB for prompts
    fallbackClassifier.js — keyword fallback
  seed/seed.js      — sample data loader

client/src/
  pages/author/     — Books, Tickets, New Ticket, Ticket Detail
  pages/admin/      — Dashboard, Queue, Ticket Detail
  services/api.js   — axios + socket client
```
