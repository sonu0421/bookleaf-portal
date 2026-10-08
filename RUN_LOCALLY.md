# Apne Laptop Pe Chalane Ka Guide

## Step 0: Zip download karo
`bookleaf-portal.zip` download karke extract karo (koi bhi folder me).

## Step 1: Node.js install karo
https://nodejs.org se **LTS version** download karke install karo.
Check karne ke liye terminal me `node --version` likho.

## Step 2: MongoDB Atlas (free cloud database)

Tumhara Atlas account pehle se hai (Gupshup wala). Usi cluster me BookLeaf ke liye **alag user + alag database** banayenge. Gupshup ko kuch nahi hoga.

**Important:** Purane `gupshup` user ka password mat change karna. Live Gupshup site usi password se connect hoti hai (Render pe). Hamesha **naya user** banao.

1. https://cloud.mongodb.com pe login karo
2. **Database Access** (left sidebar) me **ADD NEW DATABASE USER** dabao:
   - Username: `bookleaf`
   - Password: Autogenerate karo ya khud set karo (yaad rakhna)
   - Role: **Read and write to any database**
   - **Add User** dabao
3. **Network Access** me **Add IP Address** -> **Allow Access from Anywhere** (0.0.0.0/0) -> Confirm
4. **Database** -> **Connect** -> **Drivers** -> connection string copy karo. Kuch aisa dikhega:
   ```
   mongodb+srv://bookleaf:<password>@gupshup.bgzvevi.mongodb.net/?appName=MongoDB
   ```
5. `<password>` ki jagah apna password daalo, aur `/?` se pehle `/bookleaf` add karo:
   ```
   mongodb+srv://bookleaf:TUMHARA_PASSWORD@gupshup.bgzvevi.mongodb.net/bookleaf?appName=BookLeaf
   ```

Samajhne ke liye: cluster ek building hai, `gupshup` aur `bookleaf` alag-alag flat hain. Ek flat ka kaam dusre ko touch nahi karta.

## Step 3: Backend setup

```bash
cd bookleaf-portal/server
npm install
```

Phir `server/` folder me **`.env`** naam ki file banao, isme ye likho:

```
PORT=5000
MONGO_URI=mongodb+srv://bookleaf:TUMHARA_PASSWORD@gupshup.bgzvevi.mongodb.net/bookleaf?appName=BookLeaf
JWT_SECRET=koi-bhi-lambi-random-string-yahan-likho-12345
CLIENT_URL=http://localhost:5173
GROQ_API_KEY=tumhari-groq-key-yahan
GROQ_MODEL=openai/gpt-oss-120b
```

Phir seed aur start:

```bash
npm run seed     # 10 authors + 18 books load hoga
npm start        # backend chalega -> http://localhost:5000
```

Terminal me `[server] listening on :5000` dikhe to backend up hai.

## Step 4: Frontend setup (naya terminal kholo)

```bash
cd bookleaf-portal/client
npm install
npm run dev      # -> http://localhost:5173
```

## Step 5: Browser me kholo

**http://localhost:5173** kholo aur login karo:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@bookleaf.com | admin123 |
| Author | priya.sharma@email.com | password123 |

## Kya-kya try karna

**Author banke:**
1. My Books dekho, royalty figures dikhenge
2. "New Query" me book select karo, subject + description likho, Submit dabao
3. My Tickets me ticket dikhega (category/priority AI laga dega, kuch second me)

**Admin banke (dusri browser window me):**
1. Dashboard -> Ticket Queue
2. Ticket kholo, **AI-drafted reply** dikhega. Edit karo, "Send to Author" dabao
3. Author wali window me bina refresh ke reply aa jayega

## Problem aaye to

- `npm install` fail ho raha hai: Node.js LTS reinstall karo
- MongoDB connect nahi ho raha: password ya IP whitelist check karo (Step 2 ka point 3)
- Port busy error: purana terminal band karke dobara try karo
