# Ripple 💬

A real-time private chat app built with React, Firebase Firestore, and Gemini AI.

> "How one message starts a whole conversation"

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Database | Firebase Firestore (real-time) |
| Auth | Firebase Custom Sessions (no password) |
| AI | Google Gemini 2.0 Flash |
| Animations | Motion (Framer Motion) |
| Deployment | Vercel (serverless API functions) |

---

## Project Structure

```
sheets-chat/
├── api/                        # Vercel serverless functions
│   ├── csrf-token.ts           # Returns CSRF token for request validation
│   ├── active-spreadsheet.ts   # Legacy endpoint (returns null, Firestore used instead)
│   ├── admin/
│   │   └── register.ts         # Admin Google OAuth token registration
│   ├── sheets/
│   │   └── proxy.ts            # Google Sheets API proxy (legacy)
│   └── gemini/
│       └── chat.ts             # Gemini AI chat endpoint
├── src/
│   ├── components/
│   │   ├── App.tsx             # Main app — all state, auth, routing logic
│   │   ├── Sidebar.tsx         # Left panel — members list, DMs, add member
│   │   ├── ChatArea.tsx        # Right panel — messages, input, AI toggle
│   │   ├── ConnectSheetModal.tsx # Admin Google Sheets connector (legacy)
│   │   └── RippleLogo.tsx      # SVG logo component
│   ├── lib/
│   │   ├── firebase.ts         # Firebase init, auth, custom session logic
│   │   └── sheets.ts           # Firestore data layer (read/write all collections)
│   └── types.ts                # TypeScript interfaces
├── .env.local                  # Local environment variables (never committed)
├── .env.example                # Template for environment variables
├── vercel.json                 # Vercel deployment config
├── local-db.json               # Legacy local fallback DB (not used with Firestore)
└── server.ts                   # Local Express dev server
```

---

## Environment Variables

Create a `.env.local` file (copy from `.env.example`):

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_OAUTH_CLIENT_ID=
GEMINI_API_KEY=
CSRF_SECRET=
```

For Vercel deployment, add all these as Environment Variables in the Vercel dashboard.

---

## Running Locally

```bash
npm install
npm run dev
```

App runs at `http://localhost:5173`

---

## Authentication Flow

Ripple uses **no passwords**. Auth is name + nickname only.

### Regular User Login

1. User enters **Name** + **Nickname** → clicks **Join**
2. App shows **"Just a sec..."** screen immediately
3. In background, Firestore `users` collection is checked:
   - `usr-{nickname}` document exists + name matches → **"Welcome back!"**
   - `usr-{nickname}` exists but name doesn't match → **"User not found"** (can still join as new)
   - `usr-{nickname}` doesn't exist → **"Welcome to Ripple!"** (new user)
4. User confirms → `nicknameSignIn()` creates a custom session in `sessionStorage`
5. New users are written to Firestore `users` collection in the background (fire & forget)

### Admin Login

1. Admin clicks **Admin Login** tab
2. Enters nickname `anmol@0322` → triggers Google OAuth popup
3. Google OAuth gives a real Firebase user + access token
4. Admin can connect a Google Sheet database via `ConnectSheetModal`

### Session Persistence

- Sessions stored in `sessionStorage` under `sheets_chat_custom_session`
- On page reload, `initAuth()` checks sessionStorage first before Firebase auth state
- Logout clears sessionStorage + all form fields

---

## Database (Firestore)

### Collections

| Collection | Document ID | Fields |
|-----------|-------------|--------|
| `users` | `usr-{nickname}` | `id`, `name`, `email`, `photoUrl`, `status`, `lastActive` |
| `rooms` | `ai-chat` or `dm-{uid1}-{uid2}` | `id`, `name`, `description`, `createdBy`, `createdAt` |
| `messages` | `msg-{randomId}` | `id`, `roomId`, `userId`, `userName`, `userEmail`, `userPhoto`, `text`, `timestamp`, `replyToId` |

### Real-time Listeners

`sheets.ts` boots **3 Firestore `onSnapshot` listeners** at module load time (before React even mounts):

```
Module loads → _bootListeners() runs
  → onSnapshot(users)    → cachedUsers updated
  → onSnapshot(rooms)    → cachedRooms updated
  → onSnapshot(messages) → cachedMessages updated
```

This means by the time the user types and clicks Join, the cache is already warm. `fetchUsers()` waits for the first snapshot via `waitForCache()` promise.

### Seeding

On first ever load, if `rooms/ai-chat` doesn't exist, `seedIfEmpty()` creates:
- `rooms/ai-chat` — the default AI chat room
- `messages/msg-welcome` — the welcome message from Gemini AI

---

## Rooms & DMs

- **`ai-chat`** — default room, always exists, all users can access
- **DM rooms** — generated client-side as `dm-${[uid1, uid2].sort().join("-")}`
  - Sorting ensures the same room ID regardless of who initiates
  - Example: `dm-usr-alice@01-usr-bob@02`

---

## Add Member Flow

1. User clicks **UserPlus** icon in sidebar
2. Enters target user's nickname
3. App checks `users` collection for `usr-{nickname}`
4. If found → sends `👋 Hi! I'd like to connect with you.` to the DM room
5. Target user sees the message within seconds (real-time via onSnapshot)
6. Sender is switched to the DM room automatically

---

## Gemini AI Integration

- **`/api/gemini/chat`** — Vercel serverless function
- Uses `gemini-2.0-flash` model
- In `ai-chat` room — every message automatically triggers Gemini
- In DM rooms — click the ✨ sparkle button to toggle AI mode, or start message with `/ai`
- Last 12 messages sent as context history
- AI response posted as a new message with `replyToId` pointing to user's message

---

## Deployment (Vercel)

1. Push to GitHub
2. Import repo on [vercel.com/new](https://vercel.com/new)
3. Add all environment variables in Vercel dashboard
4. Deploy — `vercel.json` handles everything:
   - `vite build` for frontend
   - `/api/*` routes to serverless functions

### After Deploy

Add your `*.vercel.app` domain to:
- **Firebase Console → Authentication → Settings → Authorized Domains**

---

## User ID Format

| Type | Format | Example |
|------|--------|---------|
| Regular user | `usr-{nickname}` | `usr-xender@03` |
| Admin (Google) | Firebase UID | `abc123xyz` |
| AI bot | `ai-bot` | `ai-bot` |
| System | `system` | `system` |

Admin is identified by checking `!uid.startsWith("usr-")`.

---

## Name & Nickname Rules

| Field | Rules |
|-------|-------|
| Name | Lowercase only, `a-z` and spaces, max 30 chars, no paste |
| Nickname | `a-z`, `0-9`, `@`, `_` only, no paste |
| Admin nickname | Hardcoded as `anmol@0322` |

---

## Known Limitations (Prototype 1)

- No end-to-end encryption (messages stored in plain text in Firestore)
- Firestore rules are open (`allow read, write: if true`) — needs proper auth rules before public launch
- No message deletion or editing
- No push notifications
- Admin Google OAuth token expires every hour (only affects Google Sheets legacy feature, not Firestore)
