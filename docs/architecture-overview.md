---
marp: true
title: Vonage Voice × ElevenLabs Conversational AI
description: システムアーキテクチャとデータフロー
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
---

<!-- _class: cover -->

# 電話音声エージェントの全体像

## Vonage Voice API × ElevenLabs Conversational AI

Node.js / Express によるリアルタイム音声ブリッジと、話者分離トランスクリプト管理 UI

<br>

**対象:** `vonage-voice-ws-elevenlabs-convAI-demo`  
**構成:** PSTN 着信 → 音声 AI 対話 → 管理画面でライブ確認

---

# システム概要

<div class="flow">
  <div class="node">発信者<br><span class="muted">PSTN</span></div>
  <div class="arrow">→</div>
  <div class="node">Vonage Voice API<br><span class="muted">LVN / NCCO</span></div>
  <div class="arrow">⇄</div>
  <div class="node">Node.js ブリッジ<br><span class="muted">音声中継 / イベント集約</span></div>
  <div class="arrow">⇄</div>
  <div class="node">ElevenLabs<br><span class="muted">STT / LLM / TTS / VAD</span></div>
</div>

<div class="cols">
  <div class="card">
    <h3>通話・音声経路</h3>
    <ul>
      <li>Vonage の Answer webhook に NCCO を返し、WebSocket メディアを接続</li>
      <li>サーバーは音声を符号化して中継し、AI と通話のイベントを集約</li>
      <li>STT / LLM / TTS / VAD は ElevenLabs 側で実行</li>
    </ul>
  </div>
  <div class="card">
    <h3>運用・監視経路</h3>
    <ul>
      <li>ログイン保護された管理 UI が話者別トランスクリプトを表示</li>
      <li>EventBus の最新 500 イベントを SSE とポーリングで配信</li>
      <li>DB は使わず、イベントとセッションはメモリ上に保持</li>
    </ul>
  </div>
</div>

---

# 全体アーキテクチャ

<img class="diagram" src="assets/architecture-flow.svg" alt="Vonage、Node.js、ElevenLabs、管理UIのシステム構成">

<div class="cols small">
  <div class="card"><h3>Webhook / NCCO</h3><code>/answer</code> が talk + connect を返し、<code>/event</code> が通話状態を集約。</div>
  <div class="card"><h3>Media bridge</h3><code>src/bridge.js</code> が PCM を転送し、割り込み・ペーシング・キュー上限を処理。</div>
  <div class="card"><h3>Event fanout</h3><code>src/events.js</code> が type 付きイベントに連番 seq を付与し、最新 500 件を保持。</div>
  <div class="card"><h3>Admin / auth</h3><code>src/auth.js</code> と <code>src/routes/admin.js</code> がセッション認証、SSE、状態 API を提供。</div>
</div>

---

# 通話開始から音声応答まで

<img class="diagram" src="assets/architecture-sequence.svg" alt="着信からAI応答までのシーケンス">

<p class="muted">通話イベント（/event）と会話イベント（ElevenLabs WebSocket）は、どちらもサーバー内で共通の EventBus に集約されます。</p>

---

<!-- _class: audio-bridge -->

# 音声ブリッジの要点

<div class="cols">
  <div class="card">
    <h3>発信者 → AI</h3>
    <ol>
      <li>Vonage から 16 kHz PCM を受信</li>
      <li>Base64 化して <code>user_audio_chunk</code> で ElevenLabs へ</li>
      <li>任意で音声を <code>recordings/</code> に保存</li>
    </ol>
    <p class="small"><strong>入力:</strong> audio/l16;rate=16000<br><strong>1フレーム:</strong> 20 ms 相当 = 640 bytes</p>
  </div>
  <div class="card">
    <h3>AI → 発信者</h3>
    <ol>
      <li><code>audio</code> イベントを PCM に復号</li>
      <li>640 bytes 単位で 18 ms ごとに Vonage へ送信</li>
      <li>キュー上限 512 KB。超過時は古い音声を破棄</li>
    </ol>
    <p class="small"><strong>バックプレッシャー:</strong> 送信音声キューに上限を設け、遅延時のメモリ増加を抑制。</p>
  </div>
</div>

<div class="flow small">
  <div class="node">VAD が割り込み検知</div><div class="arrow">→</div>
  <div class="node">未送信音声を破棄</div><div class="arrow">→</div>
  <div class="node"><code>action: clear</code><br>Vonage 再生を消去</div><div class="arrow">→</div>
  <div class="node">次の応答を再開</div>
</div>

<p class="callout"><strong>担当分離:</strong> STT / LLM / TTS / VAD は ElevenLabs。Node.js はエンコード・ペーシング・イベント中継・接続ライフサイクルを担当。</p>

---

<!-- _class: data-flow -->

# 主要データ構造とイベント配信

<div class="cols">
  <div class="card">
    <h3>EventBus のイベントレコード</h3>
    <pre><code>{
  "seq": 42, "ts": "ISO-8601",
  "type": "user_transcript", "speaker": "user",
  "text": "ご用件をお願いします",
  "is_final": true, "call_uuid": "..."
}</code></pre>
    <p class="small">主な type: call_event / user_transcript / agent_response / interruption / bridge_error / language_changed</p>
  </div>
  <div class="card">
    <h3>履歴とリアルタイム配送</h3>
    <ul>
      <li><code>EventBus</code>: seq を付与し、直近 500 件をメモリ保持</li>
      <li><code>GET /admin/events</code>: 履歴リプレイ + SSE 配信</li>
      <li><code>GET /admin/api/state?since=seq</code>: 指定 seq より後を取得</li>
      <li>1.5 秒ごとのポーリングを併用、seq で重複排除</li>
      <li>ブラウザの表示も最大 500 件に制限</li>
    </ul>
  </div>
</div>

<div class="callout"><strong>一貫性の工夫:</strong> SSE がトンネル等でバッファリングされてもポーリングで追いつける。SSE とポーリングの重複はイベント seq で排除。</div>

---

<!-- _class: dense -->

# API 設計とセキュリティ境界

| エンドポイント | 用途 | 認証・入力 |
|---|---|---|
| `GET /health` | ヘルスチェック | 認証なし |
| `GET/POST /answer` | Vonage Answer webhook → NCCO | 外部公開・認証なし |
| `POST /event` | Vonage 通話状態イベント | 外部公開・認証なし |
| `WS /socket?peer_uuid=…` | 音声メディアブリッジ | UUID 形式を検証 |
| `GET/POST /login`, `POST /logout` | 管理者ログイン・ログアウト | 失敗 5 回で 5 分ロック |
| `GET /admin`, `/admin/*` | 管理 UI / 言語 / 状態 / SSE | セッション必須 |

<div class="cols">
  <div class="card">
    <h3>実装されている保護</h3>
    <ul class="small">
      <li>ログイン資格情報の timing-safe 比較、IP 単位のレート制限</li>
      <li>ログイン時にセッション ID を再生成</li>
      <li>Cookie: httpOnly / SameSite=Lax、HTTPS 条件下で Secure</li>
      <li>管理 API / SSE は requireAuth、WS は Vonage UUID 形式を検証</li>
      <li>秘密ファイル・録音ファイルを push 防止フックで検査</li>
    </ul>
  </div>
  <div class="card">
    <h3>運用で注意する境界</h3>
    <ul class="small">
      <li>Vonage webhook は認証なしの公開 URL。HTTPS と送信元・署名検証を配備要件に含める</li>
      <li><code>peer_uuid</code> の形式チェックは、単独では WebSocket の認証ではない</li>
      <li>セッションとイベント履歴はメモリ内。再起動・複数インスタンスで共有されない</li>
      <li>音声録音を有効にする場合、同意・アクセス・保持期間を定義</li>
    </ul>
  </div>
</div>

---

<!-- _class: summary -->

# まとめ — 特長と改善ロードマップ

<div class="cols">
  <div class="card">
    <h3>設計上の特長</h3>
    <ul>
      <li>小さな Node.js サービスに通話制御・音声中継・管理 UI を集約</li>
      <li>AI 音声処理を ElevenLabs に委譲し、ローカルの責務を限定</li>
      <li>割り込み対応、送信キュー上限、接続 ping でリアルタイム特性をケア</li>
      <li>SSE とポーリングの併用でプロキシ環境の監視画面を堅牢化</li>
      <li>外部 API 不要の Node.js 組み込みテストで主要モジュールを検証</li>
    </ul>
  </div>
  <div class="card">
    <h3>改善の優先候補</h3>
    <ol>
      <li><strong>本番スケール:</strong> セッション / イベントを Redis 等へ外出しし、複数インスタンスに対応</li>
      <li><strong>境界保護:</strong> Webhook 署名・送信元検証、WebSocket 接続の認証を追加</li>
      <li><strong>運用性:</strong> 構造化ログ、遅延・切断・バッファ破棄のメトリクス、readiness を整備</li>
      <li><strong>データ管理:</strong> 録音・イベントの同意、保持、削除ポリシーを明文化</li>
    </ol>
  </div>
</div>

<div class="priority">
  <strong>結論:</strong> このデモの中核は「NCCO で接続を確立し、WebSocket で音声を双方向中継、EventBus で会話状況を運用 UI へ配信する」軽量なリアルタイム・ブリッジ。
</div>
