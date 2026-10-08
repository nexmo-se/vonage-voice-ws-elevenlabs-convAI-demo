---
marp: true
title: Vonage Voice × ElevenLabs Conversational AI
description: System architecture and data flow
theme: default
paginate: true
size: 16:9
style: |
  section {
    background: #f5f7fb;
    color: #14213d;
    font-family: "Aptos", "Arial", sans-serif;
    padding: 48px 62px;
  }
  section.cover {
    background: linear-gradient(135deg, #101d3a 0%, #173b66 55%, #147d88 100%);
    color: #fff;
    justify-content: center;
  }
  section.cover h1 { font-size: 2.15em; color: #fff; }
  section.cover h2 { color: #d5f4f1; font-weight: 400; }
  h1 { color: #102b4e; font-size: 1.55em; margin-bottom: 0.45em; }
  h2 { color: #147d88; }
  strong { color: #087e8b; }
  code { color: #a43b68; }
  table { font-size: 0.72em; }
  th { background: #173b66; color: #fff; }
  td, th { border-color: #d7e0ed; }
  .muted { color: #52647b; font-size: 0.76em; }
  .tag { color: #087e8b; font-weight: 700; letter-spacing: .08em; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  .card {
    background: #fff; border: 1px solid #dbe5ef; border-radius: 12px;
    padding: 16px 20px; box-shadow: 0 3px 12px #102b4e12;
  }
  .card h3 { margin: 0 0 8px; color: #147d88; }
  .flow {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px; margin: 26px 0;
  }
  .flow .node {
    flex: 1; background: #fff; border: 2px solid #b8d9df;
    border-radius: 12px; padding: 14px 10px; text-align: center;
    font-size: .83em; font-weight: 700;
  }
  .flow .arrow { color: #087e8b; font-size: 1.25em; font-weight: 700; }
  .small { font-size: .77em; }
  .callout {
    border-left: 5px solid #12a6a3; background: #e7f6f5;
    padding: 12px 16px; border-radius: 4px;
  }
  .diagram { width: 100%; max-height: 500px; object-fit: contain; display: block; }
  .kpi { color: #147d88; font-size: 1.65em; font-weight: 700; }
  .priority { background: #102b4e; color: white; border-radius: 10px; padding: 14px 18px; }
  .priority strong { color: #82e3d3; }
  section.dense table { font-size: .60em; }
  section.dense .card { font-size: .80em; padding: 10px 14px; }
  section.dense .card .small { font-size: .72em; }
  section.dense .card ul { margin-top: .3em; margin-bottom: .2em; }
  section.dense li { margin-bottom: .15em; }
  section.summary .card { font-size: .78em; padding: 10px 14px; }
  section.summary .card ul, section.summary .card ol { margin-top: .3em; margin-bottom: .2em; }
  section.summary li { margin-bottom: .15em; }
  section.audio-bridge { padding-top: 38px; padding-bottom: 38px; }
  section.audio-bridge .card { font-size: .80em; padding: 12px 16px; }
  section.audio-bridge .card ol { margin-top: .25em; margin-bottom: .25em; }
  section.audio-bridge .card li { margin-bottom: .15em; }
  section.audio-bridge .flow { gap: 6px; margin: 12px 0; }
  section.audio-bridge .flow .node { padding: 8px 6px; font-size: .69em; }
  section.audio-bridge .callout { font-size: .76em; padding: 8px 12px; }
  section.data-flow { padding-top: 38px; padding-bottom: 38px; }
  section.data-flow .card { font-size: .78em; padding: 12px 16px; }
  section.data-flow .card h3 { font-size: 1.05em; }
  section.data-flow .card ul { margin-top: .3em; margin-bottom: .2em; }
  section.data-flow .card li { margin-bottom: .16em; }
  section.data-flow pre { margin: .35em 0; padding: 10px 12px; font-size: .70em; line-height: 1.2; }
  section.data-flow .callout { font-size: .76em; padding: 8px 12px; }
  section.system-overview { padding-top: 28px; padding-bottom: 28px; }
  section.system-overview .flow { margin: 8px 0; }
  section.system-overview .card { padding: 12px 16px; }
  section.architecture { padding-top: 40px; padding-bottom: 40px; }
  section.architecture .diagram { width: 90%; margin-left: auto; margin-right: auto; }
  section.sequence .diagram { max-height: 430px; }
  section.dense { padding-top: 38px; padding-bottom: 38px; }
  section.dense table { font-size: .55em; }
  section.summary { padding-top: 34px; padding-bottom: 34px; }
  section.summary .card { font-size: .70em; }
  section.summary .priority { font-size: .84em; padding: 11px 14px; }
---

<!-- _class: cover -->

# Phone Voice Agent Architecture

## Vonage Voice API × ElevenLabs Conversational AI

Real-time voice bridge and speaker-separated transcript dashboard built with Node.js / Express

<br>

**Project:** `vonage-voice-ws-elevenlabs-convAI-demo`  
**Flow:** PSTN inbound call → AI voice conversation → live admin monitoring

---

<!-- _class: system-overview -->

# System Overview

<div class="flow">
  <div class="node">Caller<br><span class="muted">PSTN</span></div>
  <div class="arrow">→</div>
  <div class="node">Vonage Voice API<br><span class="muted">LVN / NCCO</span></div>
  <div class="arrow">⇄</div>
  <div class="node">Node.js bridge<br><span class="muted">Media relay / event aggregation</span></div>
  <div class="arrow">⇄</div>
  <div class="node">ElevenLabs<br><span class="muted">STT / LLM / TTS / VAD</span></div>
</div>

<div class="cols">
  <div class="card">
    <h3>Call and media path</h3>
    <ul>
      <li>Answer webhook returns NCCO to connect the call to a WebSocket media stream</li>
      <li>The server relays encoded audio and aggregates AI and call events</li>
      <li>STT / LLM / TTS / VAD run on the ElevenLabs side</li>
    </ul>
  </div>
  <div class="card">
    <h3>Operations and monitoring path</h3>
    <ul>
      <li>Authenticated admin UI displays speaker-separated transcripts</li>
      <li>The latest 500 EventBus events are delivered through SSE and polling</li>
      <li>No database: events and sessions are kept in memory</li>
    </ul>
  </div>
</div>

---

<!-- _class: architecture -->

# Overall Architecture

<img class="diagram" src="assets/architecture-flow.en.svg" alt="System architecture: caller, Vonage, Node.js, ElevenLabs, and admin UI">

<div class="cols small">
  <div class="card"><h3>Webhook / NCCO</h3><code>/answer</code> returns talk + connect; <code>/event</code> collects call status.</div>
  <div class="card"><h3>Media bridge</h3><code>src/bridge.js</code> relays PCM and handles interruption, pacing, and queue limits.</div>
  <div class="card"><h3>Event fanout</h3><code>src/events.js</code> assigns sequential <code>seq</code> values to typed events and retains the latest 500.</div>
  <div class="card"><h3>Admin / auth</h3><code>src/auth.js</code> and <code>src/routes/admin.js</code> provide session auth, SSE, and state APIs.</div>
</div>

---

<!-- _class: sequence -->

# From Call Setup to AI Audio Response

<img class="diagram" src="assets/architecture-sequence.en.svg" alt="Sequence diagram from inbound call to AI voice response and admin updates">

<p class="muted">Call events (<code>/event</code>) and conversation events (ElevenLabs WebSocket) are both aggregated through the server's shared EventBus.</p>

---

<!-- _class: audio-bridge -->

# Audio Bridge: How It Works

<div class="cols">
  <div class="card">
    <h3>Caller → AI</h3>
    <ol>
      <li>Receive 16 kHz PCM from Vonage</li>
      <li>Base64-encode and send to ElevenLabs as <code>user_audio_chunk</code></li>
      <li>Optionally save audio under <code>recordings/</code></li>
    </ol>
    <p class="small"><strong>Input:</strong> audio/l16;rate=16000<br><strong>Frame:</strong> 640 bytes ≈ 20 ms</p>
  </div>
  <div class="card">
    <h3>AI → Caller</h3>
    <ol>
      <li>Decode the <code>audio</code> event to PCM</li>
      <li>Send 640-byte chunks to Vonage every 18 ms</li>
      <li>Queue capped at 512 KB; discard oldest audio when full</li>
    </ol>
    <p class="small"><strong>Backpressure:</strong> A bounded outbound queue limits memory growth when delivery stalls.</p>
  </div>
</div>

<div class="flow small">
  <div class="node">VAD detects interruption</div><div class="arrow">→</div>
  <div class="node">Drop unsent audio</div><div class="arrow">→</div>
  <div class="node"><code>action: clear</code><br>Clear Vonage playback</div><div class="arrow">→</div>
  <div class="node">Resume next response</div>
</div>

<p class="callout"><strong>Separation of concerns:</strong> ElevenLabs handles STT / LLM / TTS / VAD. Node.js handles encoding, pacing, event relay, and connection lifecycle.</p>

---

<!-- _class: data-flow -->

# Key Data Structures and Event Delivery

<div class="cols">
  <div class="card">
    <h3>EventBus event record</h3>
    <pre><code>{
  "seq": 42, "ts": "ISO-8601",
  "type": "user_transcript", "speaker": "user",
  "text": "How can I help you?",
  "is_final": true, "call_uuid": "..."
}</code></pre>
    <p class="small">Key types: call_event / user_transcript / agent_response / interruption / bridge_error / language_changed</p>
  </div>
  <div class="card">
    <h3>History and real-time delivery</h3>
    <ul>
      <li><code>EventBus</code>: assigns <code>seq</code> and retains the latest 500 events in memory</li>
      <li><code>GET /admin/events</code>: history replay + SSE stream</li>
      <li><code>GET /admin/api/state?since=seq</code>: fetch events after the given sequence</li>
      <li>1.5-second polling fallback; deduplicate by <code>seq</code></li>
      <li>Browser transcript is also capped at 500 items</li>
    </ul>
  </div>
</div>

<div class="callout"><strong>Delivery resilience:</strong> Polling catches up if a tunnel or proxy buffers SSE. Sequence numbers prevent duplicates across both transports.</div>

---

<!-- _class: dense -->

# API Design and Security Boundaries

| Endpoint | Purpose | Authentication / input |
|---|---|---|
| `GET /health` | Health check | No authentication |
| `GET/POST /answer` | Vonage Answer webhook → NCCO | Public endpoint; unauthenticated |
| `POST /event` | Vonage call status events | Public endpoint; unauthenticated |
| `WS /socket?peer_uuid=…` | Media bridge | UUID format validated |
| `GET/POST /login`, `POST /logout` | Admin login / logout | Lock 5 min after 5 failed attempts |
| `GET /admin`, `/admin/*` | Admin UI / language / state / SSE | Session required |

<div class="cols">
  <div class="card">
    <h3>Protections in place</h3>
    <ul class="small">
      <li>Timing-safe credential comparison and per-IP login rate limiting</li>
      <li>Session ID regenerated after successful login</li>
      <li>Cookies: httpOnly / SameSite=Lax; Secure when served behind HTTPS</li>
      <li>Admin APIs / SSE require auth; WebSocket validates Vonage UUID format</li>
      <li>Pre-push hooks scan for secrets and recording files</li>
    </ul>
  </div>
  <div class="card">
    <h3>Operational boundaries to consider</h3>
    <ul class="small">
      <li>Vonage webhooks are public and unauthenticated. Require HTTPS and consider sender / signature validation in deployment</li>
      <li><code>peer_uuid</code> format validation alone does not authenticate a WebSocket client</li>
      <li>Sessions and event history are in memory; they are not shared across restarts or instances</li>
      <li>If recording is enabled, define consent, access, and retention policies</li>
    </ul>
  </div>
</div>

---

<!-- _class: summary -->

# Summary: Strengths and Improvement Roadmap

<div class="cols">
  <div class="card">
    <h3>Design strengths</h3>
    <ul>
      <li>One small Node.js service combines call control, media relay, and admin UI</li>
      <li>Delegates AI audio processing to ElevenLabs, keeping local responsibilities focused</li>
      <li>Handles interruption, bounds the send queue, and pings connections for liveness</li>
      <li>SSE plus polling makes monitoring more resilient behind proxies</li>
      <li>Core modules are covered by built-in Node.js tests without external APIs</li>
    </ul>
  </div>
  <div class="card">
    <h3>Improvement priorities</h3>
    <ol>
      <li><strong>Production scale:</strong> Move sessions / events to Redis or similar for multi-instance operation</li>
      <li><strong>Boundary protection:</strong> Add webhook signature / sender validation and WebSocket client authentication</li>
      <li><strong>Operations:</strong> Add structured logs, latency / disconnect / dropped-audio metrics, and readiness checks</li>
      <li><strong>Data governance:</strong> Define consent, retention, and deletion policies for recordings / events</li>
    </ol>
  </div>
</div>

<div class="priority">
  <strong>Takeaway:</strong> The core is a lightweight real-time bridge: establish the call with NCCO, relay two-way audio over WebSockets, and deliver conversation events to the operations UI through EventBus.
</div>
