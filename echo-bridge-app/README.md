# Echo Bridge — narrated learning feed

Paste in anything you want to learn. AI breaks it into short, complete steps,
narrated aloud, one at a time — a swipeable feed instead of a document.

## How it's structured

- `src/App.jsx` — the whole app (React)
- `netlify/functions/generate.js` — a serverless function that holds your
  Anthropic API key and does the AI generation call. The browser never sees
  your key — it only ever talks to `/api/generate`, which Netlify routes to
  this function (see `netlify.toml`).

This split matters: an API key placed directly in browser code can be
extracted by anyone and used to run up your bill. Keeping it server-side
(as an environment variable) is the safe way to ship this.

## Local setup

1. Install dependencies:
   ```
   npm install
   ```

2. Install the Netlify CLI (only needed once, globally):
   ```
   npm install -g netlify-cli
   ```

3. Copy `.env.example` to `.env` and add your real Anthropic API key:
   ```
   cp .env.example .env
   ```

4. Run the site with functions working locally:
   ```
   netlify dev
   ```
   This starts the app AND the serverless function together, usually at
   `http://localhost:8888`. (Running `npm run dev` / plain `vite` alone will
   start the site but the AI generation call will fail, since the function
   isn't running.)

## Deploying to Netlify (from your existing GitHub + Netlify workflow)

1. Push this project to a new GitHub repo.
2. In Netlify: **Add new site → Import an existing project → GitHub** →
   pick the repo.
3. Build settings should auto-detect from `netlify.toml`
   (build command `npm run build`, publish directory `dist`).
4. In **Site settings → Environment variables**, add:
   - `ANTHROPIC_API_KEY` = your real key
5. Deploy. Netlify will build the site and deploy the function together.

## What's real vs. what's next

Working now: AI content breakdown, per-step icon + color, swipeable feed,
browser voice narration (on devices that support it — most real phones and
desktop browsers do), secure backend key handling.

Not built yet: user accounts, saving/revisiting past decks, file/PDF upload
(currently paste-only), a native iOS/Android wrapper. All buildable on top
of this same backend once the website is live and working end to end.
