# Vonage Voice API × ElevenLabs Conversational AI Demo

A single Node.js server that bridges an inbound PSTN call (Vonage LVN) → Voice API WebSocket media streaming → an ElevenLabs conversational AI agent, and shows a **speaker-separated (User / Bot)** transcript in a session-authenticated admin UI in real time (SSE).

Japanese documentation: [README-JP.md](./README-JP.md)

```
PSTN caller ──PSTN──▶ Vonage LVN ──NCCO(connect)──▶ wss://<server>/socket
                                                    │  (audio/l16;rate=16000)
                       Admin browser ◀──SSE── EventBus ◀─┤
                             │                    ▲     │
                         /admin (login)           │     ▼
                                         wss://api.elevenlabs.io/v1/convai/conversation
                                         (STT / LLM / TTS / VAD all on the ElevenLabs side)
```

- **VAD and speaker separation live entirely on the ElevenLabs side.** Locally we only forward audio bytes and relay events
- Barge-in: when ElevenLabs emits `interruption`, we send `{"action":"clear"}` to Vonage to drop its playback buffer
- Call logs live in an in-memory ring buffer (last 500 events) only. No DB

## Prerequisites

- Node.js 18+
- Vonage account + an LVN that can receive voice calls + an app with the Voice capability
- ElevenLabs account + API key + a Conversational AI agent

### ElevenLabs agent settings (required)

1. **Voice tab → TTS output format: `PCM 16000 Hz`** (must match Vonage's `audio/l16;rate=16000`)
2. **Advanced tab → Client Events**: enable
   - `audio`
   - `user_transcript`
   - `agent_response`
   - `interruption`

### Vonage application settings

Two ways to configure the webhooks:

1. **Automatic (recommended)**: set `VONAGE_APPLICATION_ID` / `VONAGE_ANSWER_URL` / `VONAGE_EVENT_URL` plus credentials (`VONAGE_PRIVATE_KEY_PATH` or `VONAGE_API_KEY`/`VONAGE_API_SECRET`) in `.env`, and the server **applies the Answer/Event URLs via the Applications API (`PUT /v2/applications/:id`) at startup**
2. **Manual**: set them in the Vonage Dashboard
   - Answer URL: `https://<public-url>/answer` (GET)
   - Event URL: `https://<public-url>/event` (POST)

Either way, link the LVN to the application.

## Setup

```bash
npm install
cp .env.example .env
# edit .env (see below)
```

### Environment variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default 3000) |
| `PUBLIC_URL` | Public base URL (e.g. the cloudflared URL). Fallback order: `VONAGE_ANSWER_URL` → Host header |
| `TRUST_PROXY` | Trust reverse proxy headers (cloudflared etc): `true` / `false` / Express-style string (`loopback`, ...). When unset, derived automatically from an HTTPS public URL (also enables Secure cookies). Keep `false` where nothing terminates TLS |
| `VONAGE_APPLICATION_ID` | Vonage application ID. Used for webhook auto-apply |
| `VONAGE_LVN` | LVN linked to the app (E.164). Shown in the admin UI; a mismatch with the inbound `to` number logs a warning |
| `VONAGE_PRIVATE_KEY_PATH` | Path to the app's `private.key` (relative paths resolve from the project root). Used for JWT auth to the Vonage API |
| `VONAGE_API_KEY` / `VONAGE_API_SECRET` | Basic auth for the Vonage API (alternative to private.key). Normally left unset (commented out in `.env.example`) |
| `VONAGE_ANSWER_URL` | Public Answer URL (`https://<public>/answer`). Becomes the NCCO base URL and is auto-applied to the app |
| `VONAGE_EVENT_URL` | Public Event URL (`https://<public>/event`). Auto-applied to the app |
| `ELEVENLABS_API_KEY` | ElevenLabs API key (required) |
| `ELEVENLABS_AGENT_ID` | Agent ID (required) |
| `ELEVENLABS_VOICE_ID` | Optional (uses the agent's default voice) |
| `AGENT_PROMPT` / `AGENT_FIRST_MESSAGE` / `AGENT_LANGUAGE` | Override via `conversation_config_override`. Leave `AGENT_LANGUAGE` empty to follow the admin UI language (ja/en) |
| `GREETING_TEXT_JA` / `GREETING_TEXT_EN` | Spoken greeting (Vonage `talk`) played before the WebSocket connects. JA/EN is selected by the admin UI language (empty = skip) |
| `GREETING_LANGUAGE` | Force the talk voice language (e.g. `ja-JP` / `en-US`). Empty = follow the admin UI language |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin UI login credentials (required) |
| `UI_LANGUAGE` | Default admin UI language: `ja` (default) / `en`. Switchable from the top bar; the choice is remembered in the browser and updates the server's current language |
| `SESSION_SECRET` | Long random string used to sign session cookies (required) |
| `RECORD_ALL_AUDIO` | `true` to save raw PCM to `./recordings/` |

## Running and testing (cloudflared)

### 0. Unit tests

```bash
npm test
```

`node --test` verifies config / JWT / NCCO greeting switching / `conversation_config_override` / the login rate limiter / i18n parity, etc.

### 1. Start the server (first run)

```bash
node server.js
```

### 2. Expose it with cloudflared

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the `https://xxxx.trycloudflare.com` URL from the output.

### 3. Vonage settings in .env → restart

Set the following in `.env` (download `private.key` from the app in the Vonage Dashboard):

```bash
VONAGE_APPLICATION_ID=<application id>
VONAGE_LVN=<LVN (E.164)>
VONAGE_PRIVATE_KEY_PATH=./private.key
VONAGE_ANSWER_URL=https://xxxx.trycloudflare.com/answer
VONAGE_EVENT_URL=https://xxxx.trycloudflare.com/event
```

When the startup log shows `>>> Vonage webhooks applied:`, the Answer/Event URLs were set automatically via the Applications API (on failure, follow the log message and set them manually). `VONAGE_ANSWER_URL` is also used as the base for the NCCO WebSocket URI.

`VONAGE_API_KEY`/`VONAGE_API_SECRET` are optional; without them the server uses JWT auth (`private.key`) instead.

### 4. Health check

```bash
curl http://localhost:3000/health   # → Ok
```

You are ready once the LVN is linked to the application.

### 5. Call test

Call the LVN → open `https://xxxx.trycloudflare.com/login` in a browser → log in as admin → the speaker-separated transcript appears in real time:

- **User** (blue, left): ElevenLabs `user_transcript` (dashed interim while non-final)
- **Bot** (green, right): ElevenLabs `agent_response`
- System notes in the middle: call events / barge-in / errors

The admin UI defaults to Japanese; use the toggle in the top bar to switch to English (`UI_LANGUAGE` changes the default).

### Language switching (JA / EN)

The JA/EN toggle in the top bar switches the **server-wide language**, not just the UI text:

| Layer | What switches |
|---|---|
| Frontend | Admin UI strings (data-i18n; choice remembered per browser) |
| Backend | Persisted via `POST /admin/api/language`. A `language_changed` event is broadcast over SSE to all browsers and shown as a transcript note |
| Read-aloud (Vonage) | The inbound `talk` greeting is chosen from `GREETING_TEXT_JA` / `GREETING_TEXT_EN`, and the voice language switches between `ja-JP` / `en-US` |
| Read-aloud (ElevenLabs) | On conversation start the current language is sent as `conversation_config_override.agent.language` (an explicitly set `AGENT_LANGUAGE` takes precedence) |

Switches apply from the **next inbound call / conversation start** (the language is fixed for the duration of a call).

### 6. Standalone checks (no call needed)

```bash
# login / SSE / empty state can be verified without a call
open http://localhost:3000/login
```

# Server-side hardening notes

- **Sessions:** `express-session` uses the default **in-memory store**; all sessions are lost on restart. For multiple instances or restart tolerance, swap in a shared store (`connect-redis` / `connect-mongo`, etc.)
- **Secure cookie:** only sent when behind TLS (`TRUST_PROXY` enabled or an HTTPS public URL is configured). Plain HTTP stays non-Secure
- **Rate-limit IP:** with `TRUST_PROXY` enabled the `X-Forwarded-For` header is trusted, so a client could spoof its IP if nothing actually terminates TLS — keep `TRUST_PROXY=false` in that case
- **Vonage WebSocket:** `peer_uuid` must be a UUID (`^[0-9a-f]{8}-[0-9a-f]{4}-...`); anything else is closed immediately (blocks path traversal and direct external connections)
- **Placeholder warnings:** at startup a warning is logged if `ADMIN_PASSWORD` / `SESSION_SECRET` / `ELEVENLABS_API_KEY` still use the `.env.example` placeholder
- **Outbound buffer:** the ElevenLabs audio queue to Vonage is capped at 512 KB (oldest audio is dropped when Vonage stalls)

## API / endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | none | Health check |
| GET/POST | `/answer` | none (Vonage) | Answer webhook → returns NCCO |
| POST | `/event` | none (Vonage) | Status event webhook |
| WS | `/socket?peer_uuid=...` | peer_uuid required | Vonage media streaming |
| GET | `/login` `POST /login` `POST /logout` | – | Admin login (5 failures → 5-minute lockout) |
| GET | `/admin` | session | Admin UI |
| GET/POST | `/admin/api/language` | session | Get / switch the current language (`{"language":"ja"}` or `"en"`); broadcasts `language_changed` over SSE |
| GET | `/admin/events` | session | Transcript SSE (history replay + live) |
| GET | `/admin/api/state` | session | Event history as JSON |

## Security

- Login: username/password from `.env`, compared with `crypto.timingSafeEqual`, per-IP rate limiting (5 failures in 15 minutes → 5-minute lockout). `X-Forwarded-For` is only trusted when `TRUST_PROXY` is enabled (keep `false` without a TLS terminator, or clients can spoof their IP)
- Session: `express-session` with httpOnly / SameSite=Lax cookies; the `Secure` flag is set when `TRUST_PROXY` is enabled. The store is in-memory (logins reset on restart — use an external store for production). The session ID is regenerated on successful login
- `/admin*` and `/admin/events` (SSE) reject unauthenticated requests (HTML navigations redirect to `/login`, API/SSE get 401)
- The Vonage WebSocket requires a well-formed `peer_uuid` (validated as a UUID; anything else is closed immediately). This also blocks path traversal via the recording filename
- The ElevenLabs → Vonage audio buffer is capped at 512 KB (old audio is dropped if Vonage stalls, protecting memory)

### Pushing secrets (pre-push hook)

`scripts/hooks/pre-push` refuses `git push` when any blob **path or content** in the pushed commits matches a secret pattern (scans full history, including force pushes):

| Kind | Blocks |
|---|---|
| Paths | `.env`, `*.env` (`prod.env`, ...), `.env.*` (`.env.local`, ...), `private.key`, `*.key`, `*.pem`, `*.p12`, `*.pfx`, `*.p8`, `*.jks`, `*.keystore`, `credentials.json`, `secrets.json`, `recordings/`, `.npmrc`, `id_rsa`, ... (`scripts/hooks/path-blocklist`) |
| Content | PEM/OpenSSH private keys (`-----BEGIN PRIVATE KEY-----`, ...), ElevenLabs `sk_...`, AWS `AKIA...`/`AWS_SECRET_ACCESS_KEY`, GitHub `ghp_`/`github_pat_`, GitLab `glpat-`, JWTs, `authToken` (`scripts/hooks/content-blocklist`) |

The only allowed exception is the safe template `.env.example` (skipped).

**Enable**: the hook ships with the repo. After cloning, run once:

```bash
git config core.hooksPath scripts/hooks
```

(Already configured in this repo — verify with `git config --get core.hooksPath`)

## Audio format notes

- Vonage ↔ server: `audio/l16;rate=16000` (16-bit LE mono 16 kHz, 20 ms = 640 bytes)
- Server → Vonage: audio bytes from ElevenLabs are paced on an **18 ms timer in 640-byte chunks** (pacing only, unrelated to VAD)
- ElevenLabs ↔ server: `user_audio_chunk` (base64) / `audio_event.audio_base_64`
