# Chatley

Private web chat built with React, Vite, TypeScript, Tailwind, and Supabase (Google auth, Postgres + RLS, Realtime, Storage).

## Setup

1. Copy `.env.example` to `.env.local` and add your Supabase URL and anon key.
2. Enable the Google provider in the Supabase project and add this app origin to Auth redirect URLs.
3. Install and run:

```bash
npm install
npm run dev
```

`.env.local` is gitignored and should never be committed.
