# Deploy ExamHub → GitHub → Render

Full click-by-click guide: open **`deploy-guide.html`** in your browser
(or download it from the zip).

## Keys you need

| Key | Where to get it | Required? |
|-----|-----------------|-----------|
| `DATABASE_URL` | [neon.tech](https://neon.tech) → New project → Connection string | **Yes** |
| `BETTER_AUTH_SECRET` | Run `openssl rand -hex 32` | **Yes** (or let Render generate) |
| `BETTER_AUTH_URL` | Your Render URL, e.g. `https://examhub.onrender.com` | **Yes** |
| Google OAuth | Optional — email/password works without it | No |

## Quick steps

1. Create GitHub repo, upload this zip (or `git push`).
2. Create free Neon database → copy `DATABASE_URL`.
3. Render → New → Web Service → connect the repo.
4. Build: `npm ci && npm run build:render` · Start: `npm start`
5. Paste env vars from `.env.example`.
6. Deploy. Admin email stays locked to **minjunnios@gmail.com**.

## Discord support

Stuck? Contact **minjunio** on Discord.
