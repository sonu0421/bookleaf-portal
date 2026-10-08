# 📚 BookLeaf — Author Support & Communication Portal

A full-stack support portal for BookLeaf Publishing with **AI-assisted ticket classification, priority scoring, and response drafting**.

**Live Demo:** _(URL after deployment)_
**Tech Stack:** React (Vite) · Node.js (Express) · MongoDB (Mongoose) · Socket.io · Groq (Llama 3.3 70B)

---

## Test Credentials (seeded)

| Role   | Email                    | Password    |
|--------|--------------------------|-------------|
| Admin  | admin@bookleaf.com       | admin123    |
| Author | priya.sharma@email.com   | password123 |
| Author | rohit.kapoor@email.com   | password123 |
| …      | (all 10 sample authors)  | password123 |

---

## Quick Start (Local)

**Prerequisites:** Node.js 18+, MongoDB (local or Atlas)

```bash
# 1. Backend
cd server
cp .env.example .env        # fill in MONGO_URI, JWT_SECRET, GROQ_API_KEY
npm install
npm run seed                # loads 10 authors + 18 books + admin user
npm run dev                 # → http://localhost:5000

# 2. Frontend (new terminal)
cd client
npm install
npm run dev                 # → http://localhost:5173 (proxies /api → :5000)
```

---

## Architecture

```
┌─────────────┐      REST + JWT       ┌──────────────┐      ┌───────────┐
│ React (Vite) │ ◄──────────────────► │ Express API  │ ───► │ MongoDB   │
│ Author/Admin │      Socket.io       │  + RBAC      │      │ Mongoose  │
│   portals    │ ◄──────────────────► │              │      └───────────┘
└─────────────┘   real-time tickets   └──────┬───────┘
                                            │ single LLM call
                                            ▼
                                     ┌──────────────┐
                                     │ Groq API     │
                                     │ Llama 3.3    │
                                     └──────────────┘
```

### Why these choices

| Decision | Reason |
|----------|--------|
| **Groq (Llama 3.3 70B)** | Free tier, ~10x faster than OpenAI for this workload, JSON mode support. `gpt-4o-mini` would be the paid alternative. |
| **Single LLM call per ticket** | Classification + priority + draft share the same context (KB + ticket). 1 call ≈ 900 input + 400 output tokens vs 3× that for separate calls. |
| **Keyword fallback classifier** | If Groq is down/rate-limited/misconfigured, tickets still get classified and drafted — ticket creation never fails because of AI. |
| **Socket.io rooms** | `ticket-<id>` rooms for author+admin real-time sync; `admins` room for new-ticket alerts. JWT verified on handshake. |
| **Fire-and-forget AI** | Ticket is created synchronously; AI analysis attaches async. Authors never wait on LLM latency. |
| **MongoDB** | Document model fits tickets (embedded messages/notes) naturally; Mongoose validation at the schema layer. |

### Data Models

- **User** — name, email (unique), passwordHash (bcrypt), role (`author`|`admin`), profile fields
- **Book** — author ref, title, ISBN, genre, status, MRP, copiesSold, royaltyEarned/Paid/Pending, printPartner, availableOn
- **Ticket** — ticketNo (`BLF-0001`), author ref, book ref (nullable = General), subject, description, category, priority, status, assignedTo, `messages[]` (visible to author), `internalNotes[]` (admin-only), `aiDraft`, `aiMeta` (model, tokens, fallback flag)

---

## AI Integration

### How it works

1. Author submits ticket → saved immediately with defaults (`General Inquiry` / `Medium`)
2. Background job calls Groq with:
   - **System prompt** = compact Knowledge Base (~600 tokens) + tone guidelines + strict JSON schema
   - **User message** = author name + book context (royalty figures, status) + subject + description
   - `temperature: 0.3` (consistent classification), `max_tokens: 600` (cost cap), `response_format: json_object`
3. Response parsed → category/priority validated against enums (never trust raw LLM output) → draft stored
4. Admin opens ticket → sees draft → **edits** → sends. Draft regenerates only on explicit request.

### Prompt strategy

- KB is distilled to operational facts only — no fluff, to keep input tokens low
- Book context (actual royalty numbers, payout dates) is injected so drafts are **specific**, not generic
- Tone rules embedded: acknowledge first, own mistakes, 48-hour timelines, clear next step
- See `server/src/services/aiService.js` (`SYSTEM_PROMPT`) and `knowledgeBase.js`

### Error handling

| Failure | Behaviour |
|---------|-----------|
| No API key | Keyword fallback immediately (documented, not an error) |
| Timeout / 429 / 5xx | Catch → keyword fallback + template draft; ticket keeps working |
| Malformed JSON | `safeParseJson` strips fences; on failure → fallback |
| Invalid enum value | Validated against allow-lists; defaults to `General Inquiry`/`Medium` |

### Cost awareness

- **1 LLM call per ticket** (not 3) — shared context
- Drafts regenerate **only** on admin click, never on page view
- `max_tokens: 600` caps output; KB kept to ~600 tokens input
- Every ticket logs `aiMeta.promptTokens/completionTokens` — visible in admin UI for cost auditing
- Estimated: ~1,300 tokens/ticket ≈ **$0.0002** on Groq free tier (effectively $0)

### API key security

- Key lives **only** in server `.env` (`GROQ_API_KEY`), never in code, never sent to frontend
- `.env` is gitignored; `.env.example` documents required vars without values

---

## API Documentation

Base URL: `/api`. All routes except `POST /auth/login` require `Authorization: Bearer <JWT>`.

### Auth
| Method | Endpoint | Body | Notes |
|--------|----------|------|-------|
| POST | `/auth/login` | `{email, password}` | Rate-limited 20/15min per IP → `{token, user}` |
| GET | `/auth/me` | — | Current user |

### Books
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/books` | Author: own books. Admin: `?authorId=` for any author |
| GET | `/books/:id` | Ownership enforced |

### Tickets
| Method | Endpoint | Body | Notes |
|--------|----------|------|-------|
| GET | `/tickets` | `?status=&category=&priority=&search=` | Authors see own; admins see all + filters |
| GET | `/tickets/:id` | — | `internalNotes` + `aiMeta` stripped for authors |
| POST | `/tickets` | `{bookId?, subject, description}` | Author only. AI analysis runs async |
| POST | `/tickets/:id/messages` | `{text}` | Author or admin reply; real-time broadcast |

### Admin
| Method | Endpoint | Body | Notes |
|--------|----------|------|-------|
| PATCH | `/admin/tickets/:id` | `{status?, category?, priority?, assignedTo?}` | Category/priority edits set `*Overridden=true` |
| POST | `/admin/tickets/:id/notes` | `{text}` | Internal note (author never sees) |
| POST | `/admin/tickets/:id/regenerate-draft` | — | Fresh AI draft on demand |
| GET | `/admin/stats` | — | Totals, by-status, by-priority, 5 oldest unresolved |

### Error format
```json
{ "error": "Human-readable message", "details": ["field-specific…"] }
```
- `400` validation, `401` auth, `403` RBAC, `404` not found, `409` duplicate — never bare 500s for client errors.

### Real-time events (Socket.io, JWT in handshake)
| Event | Direction | Payload |
|-------|-----------|---------|
| `ticket:join` / `ticket:leave` | client → server | ticketId |
| `ticket:message` | server → room | `{ticketId, message}` |
| `ticket:updated` | server → room | `{ticketId}` |
| `ticket:created` | server → `admins` room | `{ticketId, ticketNo}` |

---

## Known Limitations & Future Work

1. **File attachments** are UI-only (per assignment: bonus, not required). Production: S3/Cloudinary + virus scan.
2. **No pagination** on ticket lists (capped at 100). Production: cursor pagination.
3. **Single admin role** — no team/role granularity (support lead vs agent).
4. **AI re-classification** doesn't re-run when the author edits a ticket (tickets are immutable after creation by design).
5. **Email notifications** not implemented — Socket.io covers in-app; production would add SES/SendGrid for offline authors.
6. **No audit log** of who changed status/category — would add an `activityLog[]` in production.

---

## Project Structure

```
server/src/
  index.js            — Express + Socket.io bootstrap
  config/             — env validation, DB connect
  models/             — User, Book, Ticket (Mongoose schemas)
  middleware/         — JWT auth, RBAC, central error handler
  routes/             — auth, books, tickets, admin
  services/
    aiService.js          — Groq: 1-call classify+priority+draft
    knowledgeBase.js      — compact KB (~600 tokens)
    fallbackClassifier.js — keyword classifier (AI-down mode)
  seed/seed.js        — loads sample dataset

client/src/
  pages/author/       — My Books, My Tickets, New Ticket, Ticket Detail
  pages/admin/        — Dashboard, Queue (filters), Ticket Detail (AI draft editor)
  services/api.js     — axios + Socket.io client
```
