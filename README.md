# 🌿 Dua Garden — حديقة الأدعية

> A community-powered web app for discovering, sharing, and preserving authentic Islamic duas and dhikr.

[![Netlify Status](https://api.netlify.com/api/v1/badges/placeholder/deploy-status)](https://app.netlify.com)

---

## ✨ Features

### 📖 Dua Collection
- **140+ authentic duas** organised across 9 categories
- Full **Arabic text** with proper right-to-left rendering (Amiri font)
- **Transliteration**, **English translation**, source, and reference for every dua
- **Real-time updates** — new duas submitted by other users appear instantly without refreshing

### 🗂 Categories
| Icon | Category | Slug |
|------|----------|------|
| 📖 | Quranic Duas | `quran` |
| 🌅 | Morning & Evening | `morning-evening` |
| 🤲 | Forgiveness & Repentance | `forgiveness` |
| 💚 | Health & Protection | `health` |
| ❤️ | Family & Marriage | `family` |
| 💰 | Rizq & Worldly Affairs | `rizq` |
| 📚 | Knowledge & Exams | `knowledge` |
| 🌹 | Jannah & Iman | `jannah` |
| 📿 | General & Dhikr | `dhikr` |

### 👤 Authentication
- Email / password sign-in and registration via **Supabase Auth**
- Session persistence across page reloads
- Guest browsing (no account required to read duas)

### ❤️ Likes & Favorites
- **Optimistic UI** — likes update instantly before server confirmation
- Like counts sync in real time across all connected clients
- **Save** duas to a personal Favorites list
- Pinned Favorites strip shown at the top of the All Duas view
- Dedicated **My Favorites** tab

### ➕ Add a Dua
- Community submission form (sign-in required)
- **AI auto-fill** — after you type the Arabic text, the app calls Gemini (2.5-flash → 2.0-flash → 1.5-flash) and falls back to Groq (llama-3.1-8b-instant) to automatically fill:
  - Transliteration
  - English translation
  - Source (Quran / Sunnah)
  - Reference
  - Category suggestion
- **Duplicate detection** — Arabic text normalisation (tashkeel removal, alef variants, teh marbuta) + Jaccard similarity scoring prevents near-duplicate submissions; user is shown the existing dua and can choose to skip or add anyway

### 🗑 Delete
- Users can delete their own submitted duas (with a confirmation step)

### 📋 Copy
- One-click copy of Arabic text + transliteration + translation + reference to clipboard

### 📄 Download PDF
- Exports the current view (or Favorites) as a beautifully designed A4 PDF
- Cover page with category title and dua count
- Arabic text rendered via HTML Canvas → PNG (correct RTL shaping)
- Transliteration, translation, source, like count per dua
- Automatic page breaks and header / page numbers

### 📱 Responsive Design
- **Desktop (≥ 1024 px):** sticky sidebar with category list and account card
- **Tablet / Mobile (< 1024 px):** sidebar hidden; floating **Categories** pill button fixed at the bottom opens a right-side drawer with the full category list and account section; closes automatically on selection

---

## 🗂 Project Structure

```
dua-garden/
├── index.html              # App shell — HTML only, no inline JS or CSS
├── netlify.toml            # Netlify deploy configuration
├── .gitignore
├── README.md
│
├── assets/
│   ├── css/
│   │   └── styles.css      # All styles (CSS custom properties, components, responsive)
│   │
│   └── js/
│       ├── config.js       # Supabase client + API keys
│       ├── state.js        # Central application state object
│       ├── ui.js           # Toast notifications + real-time subscription
│       ├── auth.js         # Sign in / register / sign out / session restore
│       ├── drawer.js       # Mobile/tablet category drawer open / close
│       ├── categories.js   # Load, render, and select categories
│       ├── duplicate.js    # Arabic normalisation + Jaccard duplicate detection
│       ├── ai.js           # Gemini + Groq AI auto-fill for the Add Dua form
│       ├── duas.js         # Load, render, like, favorite, copy, submit, delete duas
│       ├── pdf.js          # PDF generation with jsPDF
│       └── app.js          # Entry point — boots the app in the correct order
│
└── sql/
    ├── 1_schema.sql              # Database schema (tables, RLS, RPC functions)
    ├── 2_categories.sql          # Insert the 9 categories
    ├── 3_seed_duas.sql           # Core dua collection (~110 duas)
    └── 4_add_new_duas.sql        # Additional duas (run after seed)
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML + CSS + JavaScript (no framework) |
| Database | [Supabase](https://supabase.com) (PostgreSQL + Auth + Realtime) |
| AI | Google Gemini API + Groq API |
| PDF | [jsPDF](https://github.com/parallax/jsPDF) |
| Fonts | Google Fonts — Amiri, Outfit, Playfair Display |
| Hosting | Netlify / GitHub Pages |

---

## 🚀 Getting Started

### 1 — Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/dua-garden.git
cd dua-garden
```

### 2 — Open locally

Because the app uses ES modules loaded via `<script src="...">` and calls external APIs, you need a local HTTP server (not just `file://`):

```bash
# Python 3
python3 -m http.server 8080

# Node (npx)
npx serve .
```

Then open `http://localhost:8080` in your browser.

### 3 — Environment / Keys

All keys are in `assets/js/config.js`. For a production fork, replace them with your own:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon (public) key — safe to expose; protected by RLS |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `GROQ_API_KEY` | Groq Cloud API key |

---

## 🗄 Database Setup

Run the SQL files in order inside the **Supabase SQL Editor**:

```
sql/1_schema.sql       — Create tables, RLS policies, RPC functions
sql/2_categories.sql   — Insert the 9 categories
sql/3_seed_duas.sql    — Insert the core dua collection
sql/4_add_new_duas.sql — Insert additional duas (safe to re-run)
```

### Tables

| Table | Description |
|-------|-------------|
| `categories` | The 9 dua categories |
| `duas` | All duas — Arabic text, transliteration, translation, source, reference |
| `likes` | Many-to-many: users ↔ duas |
| `favorites` | Many-to-many: users ↔ duas |

### RPC Functions

| Function | Description |
|----------|-------------|
| `add_like(p_dua_id, p_user_id, p_anon_id)` | Atomically increment like_count and insert likes row |
| `remove_like(p_dua_id, p_user_id, p_anon_id)` | Atomically decrement like_count and delete likes row |

---

## 🌐 Deployment

### Netlify (recommended)

1. Push the repo to GitHub
2. Log in to [Netlify](https://netlify.com) → **Add new site** → **Import from Git**
3. Select your repository — no build command needed
4. Publish directory: `.` (root)
5. Click **Deploy site**

`netlify.toml` is already configured for you.

### GitHub Pages

1. Go to **Settings → Pages** in your repository
2. Source: **Deploy from a branch** → `main` → `/ (root)`
3. Save — your site will be live at `https://YOUR_USERNAME.github.io/dua-garden`

---

## 🤝 Contributing

Contributions are welcome! To add duas to the database, create a new SQL file following the pattern in `sql/4_add_new_duas.sql` (each INSERT wrapped in an `IF NOT EXISTS` guard).

---

## 📜 License

MIT — free to use, modify, and distribute with attribution.

---

<div align="center">
  Made with 🌿 — <em>May Allah accept from us all</em>
</div>