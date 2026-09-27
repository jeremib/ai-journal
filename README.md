# AI Journal

A mobile-first, installable PWA for journaling on your projects. Each project is a journal you fill with:

- ✍️ **Text**: written notes
- 🎙️ **Audio**: recorded voice notes (or uploaded audio files)
- 🎥 **Video**: recorded with the front or back camera (or uploaded video files)
- 🔗 **Links**: saved URLs. The server fetches each page and keeps its text.

Then **Ask AI** chats with Claude, which gets the whole project as context: your writing, the transcripts of your recordings, and the text of your saved pages.

Sign-in is with Google (Auth.js). Data lives in SQLite, and uploaded media is stored on disk.

## How recordings become AI context

Claude reads text, so audio and video go in as transcripts:

1. **Live in-browser transcription** (Web Speech API) runs while you record, in Chrome, Edge, Android and Safari.
2. **Optional server transcription**: set `TRANSCRIBE_API_KEY` to send uploads to any OpenAI-compatible `/audio/transcriptions` endpoint (Whisper, Groq, a self-hosted server, ...). This replaces the live transcript.
3. You can always edit a transcript by hand. Entries without one are flagged in the UI.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

Required variables (see `.env.example`):

| Variable | What it is |
|---|---|
| `AUTH_SECRET` | Run `npx auth secret` to generate one |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client. The redirect URI is `https://<your-host>/api/auth/callback/google` (use `http://localhost:3000/...` for dev) |
| `ANTHROPIC_API_KEY` | Used for the AI chat. The default model is `claude-opus-5`; override it with `ANTHROPIC_MODEL` |

Optional variables: `ALLOWED_EMAILS` (a sign-in allowlist), `TRANSCRIBE_*`, `DATA_DIR` (default `./data`), `MAX_UPLOAD_MB` (default 200), and `AUTH_TRUST_HOST=true` when running behind a proxy.

## Production / deploying

```bash
npm run build && npm start
```

Or use Docker (mount a volume for data):

```bash
docker build -t ai-journal .
docker run -p 3000:3000 --env-file .env.local -v journal-data:/app/data ai-journal
```

The app needs a **persistent disk** for the SQLite database and media files. Host it on a VM, Fly.io, Railway or Render with a volume. Serverless hosts such as Vercel won't keep the data.

**Installing as an app:** PWAs, camera and microphone all require **HTTPS** (localhost is exempt). Open the site on your phone and choose *Add to Home Screen* (iOS Safari) or *Install app* (Android Chrome).

## Project layout

```
src/
  auth.ts                        Google sign-in (Auth.js, JWT sessions)
  lib/db.ts                      SQLite schema and queries
  lib/ai.ts                      Claude client and project-context prompt
  lib/fetch-url.ts               URL fetch and text extraction (blocks private IPs)
  lib/transcribe.ts              optional Whisper-compatible transcription
  app/api/projects/...           project, entry and chat (streaming) routes
  app/api/media/[id]             auth-checked media streaming with Range support
  components/                    ProjectView, Recorder, Composer, EntryCard, Chat
  app/manifest.ts, public/sw.js  PWA manifest and service worker
```
