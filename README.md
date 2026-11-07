<div align="center">

<img src="assets/banner.svg" alt="Chatley" width="100%"/>

<br/>

[![Live Demo](https://img.shields.io/badge/Live_Demo-chatley--five.vercel.app-6366f1?style=for-the-badge&logo=vercel&logoColor=white)](https://chatley-five.vercel.app)

![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)

</div>

---

## ✨ What is Chatley?

Chatley is a **private web chat** built with React, Vite, TypeScript, Tailwind, and Supabase.

<div align="center">
  <img src="assets/chat-demo.svg" alt="Chatley chat demo" width="640"/>
</div>

## 🚀 Features

- 🔐 **Google authentication** via Supabase Auth
- 🛡️ **Postgres with Row Level Security** so only the right people see your data
- ⚡ **Realtime messaging** powered by Supabase Realtime
- 🖼️ **File and image sharing** with Supabase Storage
- 🎨 **Modern UI** with Tailwind CSS

## 🧰 Tech Stack

| Layer | Tech |
| --- | --- |
| Frontend | React, Vite, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Backend | Supabase (Auth, Postgres + RLS, Realtime, Storage) |
| Hosting | Vercel |

## 🛠️ Setup

1. **Configure env.** Copy `.env.example` to `.env.local` and add your Supabase URL and anon key.
2. **Enable Google auth.** In your Supabase project, enable the Google provider and add this app's origin to the Auth redirect URLs.
3. **Install and run:**

```bash
npm install
npm run dev
```

> [!WARNING]
> `.env.local` is gitignored and should never be committed.

## 📁 Project Structure

```
chatley/
├── public/      # static assets
├── src/         # React app
├── supabase/    # database schema & policies
└── .env.example # environment template
```

---

<div align="center">

Made with 💜 by [saran-77](https://github.com/saran-77)

</div>

