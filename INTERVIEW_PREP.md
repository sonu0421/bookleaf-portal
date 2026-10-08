# BookLeaf Portal — Code Walkthrough & Interview Prep

Ye document tujhe BookLeaf ke follow-up discussion ke liye taiyar karega.
Har file kya karti hai, kyun aise likhi hai, aur kya questions puch sakte hain.

---

## PART 1: Project Overview (2-minute me samjha)

**Kya banaya:** Author Support Portal — authors apne books dekhte hain (royalty figures ke saath),
support tickets raise karte hain, admin team unko reply karti hai. AI har ticket ko auto-classify
karta hai, priority lagata hai, aur reply ka draft banata hai.

**Stack:** React (Vite) + Express + MongoDB + Socket.io + Groq API

**English one-liner:** "I built a support portal where authors raise tickets about their books,
and AI helps the support team classify, prioritize, and draft replies."

---

## PART 2: Backend — Har Important File

### server/src/index.js — Entry point
**Kya karta hai:** Express app start karta hai, MongoDB connect karta hai, Socket.io setup karta hai,
saare routes register karta hai.

**Kyun aise likha:** Saara bootstrap ek jagah — server start hone se pehle DB connect hona zaroori hai,
nahi to requests fail hongi.

**Question:** "Socket.io ko Express ke saath kaise joda?"
**Answer:** "I created an HTTP server from the Express app, then attached Socket.io to that same
server — so both REST and WebSocket run on one port."

### server/src/config/env.js — Environment validation
**Kya karta hai:** `.env` se saare variables padhta hai aur check karta hai ki zaroori wale
(MONGO_URI, JWT_SECRET) present hain. Agar nahi hain to server start hi nahi hota.

**Kyun aise likha:** Agar secret missing hai aur server chal gaya to auth silently toot jayega.
Fail-fast better hai — problem turant dikhti hai.

**Question:** "Env validation kyun kiya?"
**Answer:** "So the server refuses to boot with missing secrets instead of failing silently at runtime."

### server/src/models/User.js, Book.js, Ticket.js — Database schemas
**Kya karta hai:** MongoDB me data ka structure define karta hai.

- **User:** name, email (unique), passwordHash (bcrypt se hashed), role (author/admin)
- **Book:** author ka reference, title, ISBN, genre, status, MRP, copiesSold, royaltyEarned/Paid/Pending
- **Ticket:** ticketNo (BLF-0001 format), author ref, book ref (optional), subject, description,
  category, priority, status, messages[] (author ko dikhta hai), internalNotes[] (sirf admin),
  aiDraft, aiMeta

**Kyun aise likha:**
- Password kabhi plain text me store nahi hota — bcrypt hash.
- internalNotes aur messages alag arrays hain taaki author ko notes kabhi leak na ho.
- ticketNo human-readable hai (BLF-0001) taaki support team phone pe bhi reference de sake.

**Question:** "Password kaise store kiya?"
**Answer:** "Bcrypt hash, never plain text. I compare with bcrypt.compare on login."

**Question:** "Internal notes author ko kaise nahi dikhte?"
**Answer:** "They're a separate array in the schema, and the API strips them before sending
ticket data to authors — enforced at the serialization layer, not just hidden in UI."

### server/src/middleware/auth.js — JWT authentication
**Kya karta hai:** Har protected route pe check karta hai ki request me valid JWT token hai.
Token se user nikal ke `req.user` me daal deta hai.

**Kyun aise likha:** Har route me login check likhne se code repeat hota. Middleware ek baar
likho, jahan chahiye wahan lagao.

### server/src/middleware/rbac.js — Role-based access
**Kya karta hai:** Check karta hai ki user ka role (author/admin) us route ke liye allowed hai.

**Kyun aise likha:** Sirf login hona kaafi nahi — author admin wale routes access na kar sake.
Ye defense-in-depth hai.

**Question:** "Author dusre author ka data kaise nahi dekh sakta?"
**Answer:** "Two layers — RBAC middleware blocks cross-role access, and the ticket queries
themselves filter by author ID. Even if someone bypasses the frontend, the API won't return
other authors' data."

### server/src/routes/auth.js — Login
**Kya karta hai:** POST /auth/login — email+password check karta hai, sahi hua to JWT token deta hai.
Rate limiting hai: 20 attempts per 15 min per IP (brute force rokne ke liye).

**Question:** "Rate limiting kyun lagaya?"
**Answer:** "To prevent brute-force password guessing — 20 attempts per IP per 15 minutes."

### server/src/routes/books.js — Books API
**Kya karta hai:** GET /books — author ko uski khud ki books, admin ko kisi bhi author ki
(?authorId= query se).

### server/src/routes/tickets.js — Ticket APIs
**Kya karta hai:**
- GET /tickets — author ko apne tickets, admin ko saare (filters ke saath)
- POST /tickets — naya ticket banata hai, phir background me AI analysis trigger karta hai
- POST /tickets/:id/messages — reply add karta hai, Socket.io se real-time broadcast

**Kyun aise likha:** Ticket turant save hota hai, AI background me chalta hai. Author ko
LLM ka wait nahi karna padta (fire-and-forget pattern).

**Question:** "Ticket create karne pe AI ka wait kyun nahi karwate?"
**Answer:** "The ticket saves synchronously and AI runs async. Authors never stare at a
loading spinner — the classification attaches a few seconds later."

### server/src/routes/admin.js — Admin APIs
**Kya karta hai:**
- PATCH /admin/tickets/:id — status/category/priority change (override track hota hai)
- POST /admin/tickets/:id/notes — internal note (author kabhi nahi dekhta)
- POST /admin/tickets/:id/regenerate-draft — naya AI draft on demand
- GET /admin/stats — dashboard numbers

---

## PART 3: AI Integration Deep-Dive (25% weightage — sabse important!)

### server/src/services/aiService.js — Groq integration

**Kya karta hai:** Ek function `analyzeTicket()` jo Groq API ko call karta hai aur ek hi call me
teen cheezein nikalta hai: category + priority + draft reply.

**Flow:**
1. System prompt = Knowledge Base (~600 tokens) + tone rules + JSON schema
2. User message = author ka naam + book context (royalty numbers, status) + subject + description
3. Groq ko bhejo: `temperature: 0.3`, `max_tokens: 600`, JSON mode
4. Response aaya to validate karo — category aur priority allowed list me hone chahiye
5. Draft ko ticket me save karo

**Kyun EK call, teen nahi?**
Teeno ko same context chahiye (KB + ticket). Teen alag calls = 3x cost, 3x latency, koi quality gain nahi.
Ye cost-awareness hai.

**Kyun temperature 0.3?**
Low temperature = consistent output. Classification me creativity nahi chahiye, consistency chahiye.
0 would be too rigid, 0.3 thoda flexibility deta hai.

**Kyun max_tokens 600?**
Cost cap. Draft reply lamba nahi hona chahiye — short, actionable reply.

**Kyun JSON mode?**
Taaki response predictable format me aaye. Phir bhi blind trust nahi — `safeParseJson`
fences strip karta hai, aur har field validate hota hai.

**Question:** "Why one LLM call instead of three?"
**Answer:** "All three need identical context. Three calls would triple cost and latency
with zero quality gain."

**Question:** "What if the LLM returns garbage?"
**Answer:** "Three safety nets — JSON parsing with fence-stripping, enum validation against
allowed categories/priorities, and safe defaults. Bad output never reaches the database."

**Question:** "Why Groq over OpenAI?"
**Answer:** "Free tier, very low latency, JSON mode support. And the AI code is isolated in
one module, so switching providers is just a config change."

### server/src/services/knowledgeBase.js — Support KB

**Kya karta hai:** ~600 tokens ka compact knowledge base — royalty payout dates, ISBN process,
printing timelines, escalation rules. Ye har AI call me system prompt ka part hai.

**Kyun compact?** Har ticket pe ye tokens kharch hote hain. Chhota KB = kam cost.
Sirf operational facts, koi fluff nahi.

**Question:** "KB ko prompt me kyun daala, RAG kyun nahi?"
**Answer:** "At this scale a static KB is simpler and cheaper. For production with a large KB,
I'd switch to RAG — embed articles, retrieve top-3 per ticket."

### server/src/services/fallbackClassifier.js — Keyword fallback

**Kya karta hai:** Agar Groq down hai / key nahi hai / rate limit hai to keyword matching se
category aur priority guess karta hai. Template-based draft banata hai.

**Kyun?** Support tickets AI ke down hone pe rukne nahi chahiye. Graceful degradation —
system hamesha kaam karta hai, bas quality thodi kam hoti hai. Admin UI me badge dikhta hai
jab fallback use hua.

**Question:** "AI down hua to kya hoga?"
**Answer:** "The system degrades to a keyword classifier immediately. Tickets keep working —
the admin UI badges it so nobody mistakes it for an AI draft."

### Cost awareness (interview me zaroor puchega!)

- 1 call per ticket (not 3)
- Draft regenerate sirf admin ke click pe, page load pe nahi
- ~1,300 tokens per ticket ≈ effectively $0 on Groq free tier
- Har ticket pe token usage log hota hai (aiMeta) — admin UI me audit kar sakte ho

**English one-liner:** "One LLM call per ticket, drafts regenerate only on demand,
and every ticket logs its token usage for cost auditing."

### Key security

- Groq key sirf server ke `.env` me hai
- Kabhi frontend ko nahi bheja jata
- Kabhi code me hardcode nahi hai
- `.env` gitignored hai

---

## PART 4: Frontend — Important Files

### client/src/services/api.js — API client
**Kya karta hai:** Axios instance jo backend ko call karta hai. Har request me JWT token
auto-attach karta hai. 401 aaya to logout karke login page pe bhejta hai.

**Important fix:** Pehle `baseURL: '/api'` hardcoded tha — production me ye Vercel ko call
kar raha tha, Render ko nahi! Fix: `VITE_API_URL` env var use karta hai.

**Question:** "Production me ek bug aaya tha — kya tha?"
**Answer:** "The frontend was calling its own origin instead of the backend. I fixed it to
use the VITE_API_URL environment variable."

### client/src/components/AuthContext.jsx — Auth state
**Kya karta hai:** Login/logout, user state, page refresh pe token se user restore karta hai.

### client/src/pages/author/ — Author pages
- My Books: books + royalty figures
- My Tickets: ticket list
- New Ticket: ticket form (book dropdown + subject + description)
- Ticket Detail: messages, real-time via Socket.io

### client/src/pages/admin/ — Admin pages
- Dashboard: stats + oldest unresolved tickets
- Queue: filters (status, category, priority, date, search)
- Ticket Detail: AI draft editor, internal notes, assign

### client/vercel.json — SPA rewrites
**Kya karta hai:** Vercel ko bolta hai ki saare routes index.html pe bhejo (React Router handle karega).
Nahi hota to /login pe refresh karne se 404 aata.

---

## PART 5: Possible Questions + Short Answers

**Q: Architecture samjhao.**
A: "React frontend, Express REST API with JWT auth, MongoDB, Socket.io for real-time.
AI runs as a background job on ticket creation."

**Q: Real-time kaise kaam karta hai?**
A: "Socket.io rooms — each ticket has a room, plus an admins room for new ticket alerts.
JWT verified on handshake."

**Q: AI ka prompt kaise design kiya?**
A: "System prompt has the knowledge base plus tone rules and a strict JSON schema.
User message injects the author's book context — actual royalty numbers — so drafts are
specific, not generic."

**Q: AI ki galti se galat category lagi to?**
A: "Admin can override. Overrides are flagged in the UI, and I'd use them as training
data to improve the classifier."

**Q: Scale kaise karoge? (1000 tickets/day)**
A: "Queue the AI jobs instead of fire-and-forget, add RAG for the KB, cache common
classifications, and add rate limiting per author."

**Q: Sabse mushkil part kya tha?**
A: "Making AI failures invisible to users — the fallback system. And the production
debugging when the frontend called the wrong API origin."

**Q: Kya change karoge agar dobara banate?**
A: "RAG for the knowledge base, confidence threshold to route uncertain tickets to humans
first, and an audit log of every status change."

**Q: Testing kaise kiya?**
A: "13-point API audit — RBAC both directions, internal notes never leak to authors,
AI classification accuracy, fallback when Groq is down, real-time message delivery."

---

## PART 6: Demo Flow (agar live demo dikhana ho)

1. **Author login** (priya.sharma@email.com) → My Books dikhao → royalty numbers point karo
2. **New ticket** banao → "My royalty is pending for 6 months" → submit karo
3. **Admin login** (dusri window) → Queue me naya ticket dikhega → AI ne category + priority lagaya
4. **Ticket kholo** → AI draft dikhao → edit karo → send karo
5. **Author window** me bina refresh ke reply aa jayega (real-time!)

**English:** "Let me show you the full flow — author raises a ticket, AI classifies it,
admin edits the draft, and the author sees the reply in real time."
