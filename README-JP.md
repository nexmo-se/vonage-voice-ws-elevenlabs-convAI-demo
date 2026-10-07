# Vonage Voice API × ElevenLabs Conversational AI Demo

PSTN 着信 (Vonage LVN) → Voice API WebSocket メディアストリーミング → ElevenLabs 音声ボットエージェント、という双方向音声ボットを単一 Node.js サーバで実装したものです。通話中の発話内容を **話者分離 (User / Bot)** して、セッション認証付きの管理者画面にリアルタイム (SSE) で表示します。

```
PSTN 発話者 ──PSTN──▶ Vonage LVN ──NCCO(connect)──▶ wss://<server>/socket
                                                        │  (audio/l16;rate=16000)
                        管理ブラウザ ◀──SSE── EventBus ◀─┤
                              │                    ▲     │
                          /admin (login)           │     ▼
                                          wss://api.elevenlabs.io/v1/convai/conversation
                                          (ElevenLabs 側で STT / LLM / TTS / VAD を処理)
```

- **VAD / スピーカー分離はすべて ElevenLabs 側**。ローカルでは音声バイトの転送とイベント中継のみ
- バージンイン: ElevenLabs が `interruption` を検知したら、Vonage に `{"action":"clear"}` を送って再生バッファを破棄
- 通話ログはメモリ上のリングバッファ (直近 500 イベント) のみ。DB なし

## 前提条件

- Node.js 18 以上
- Vonage アカウント + 音声通話可能な LVN + Voice キャパビリティ付きアプリケーション
- ElevenLabs アカウント + API キー + Conversational AI エージェント

### ElevenLabs エージェント側の設定 (必須)

1. **Voice タブ → TTS output format: `PCM 16000 Hz`** (Vonage の `audio/l16;rate=16000` と合わせるため)
2. **Advanced タブ → Client Events** に以下を有効化:
   - `audio`
   - `user_transcript`
   - `agent_response`
   - `interruption`

### Vonage アプリケーション側の設定

Webhook 設定は 2 通り:

1. **自動 (推奨)**: `.env` に `VONAGE_APPLICATION_ID` / `VONAGE_ANSWER_URL` / `VONAGE_EVENT_URL` と認証情報 (`VONAGE_PRIVATE_KEY_PATH` または `VONAGE_API_KEY`/`VONAGE_API_SECRET`) を設定すると、**起動時に Applications API (`PUT /v2/applications/:id`) へ自動で Answer/Event URL を設定**します
2. **手動**: Vonage Dashboard で設定
   - Answer URL: `https://<public-url>/answer` (GET)
   - Event URL: `https://<public-url>/event` (POST)

いずれの場合も LVN をアプリケーションに紐付けてください。

## セットアップ

```bash
npm install
cp .env.example .env
# .env を編集 (下記)
```

### .env 変数

| 変数 | 説明 |
|---|---|
| `PORT` | サーバポート (既定 3000) |
| `PUBLIC_URL` | 公開 URL (cloudflared の URL 等)。省略時は `VONAGE_ANSWER_URL` → Host ヘッダの順で導出 |
| `VONAGE_APPLICATION_ID` | Vonage アプリケーション ID。Webhook 自動設定に使用 |
| `VONAGE_LVN` | アプリに紐付けた LVN (E.164)。管理画面に表示し、着信の `to` と不一致なら警告ログを出力 |
| `VONAGE_PRIVATE_KEY_PATH` | アプリケーションの `private.key` のパス (相対パスはプロジェクトルート基準)。Vonage API への JWT 認証に使用 |
| `VONAGE_API_KEY` / `VONAGE_API_SECRET` | Vonage API の Basic 認証 (private.key の代替)。通常は未設定 (`#` でコメントアウト済み) |
| `VONAGE_ANSWER_URL` | このサーバの公開 Answer URL (`https://<public>/answer`)。NCCO のベース URL になり、起動時にアプリへ自動設定される |
| `VONAGE_EVENT_URL` | このサーバの公開 Event URL (`https://<public>/event`)。起動時にアプリへ自動設定される |
| `ELEVENLABS_API_KEY` | ElevenLabs API キー (必須) |
| `ELEVENLABS_AGENT_ID` | エージェント ID (必須) |
| `ELEVENLABS_VOICE_ID` | 省略可 (エージェント既定の音声) |
| `AGENT_PROMPT` / `AGENT_FIRST_MESSAGE` / `AGENT_LANGUAGE` | `conversation_config_override` で上書き。`AGENT_LANGUAGE` を空にすると管理画面の言語 (ja/en) に追従 (`ja` / `en` 等を明示指定も可) |
| `GREETING_TEXT_JA` / `GREETING_TEXT_EN` | WebSocket 接続前に Vonage `talk` で読み上げる挨拶。管理画面の言語に応じて JA/EN が選択される (空で無効)。既定は日本語/英語の挨拶文 |
| `GREETING_LANGUAGE` | `talk` の音声言語を固定 (例: `ja-JP` / `en-US`)。空なら管理画面の言語に追従 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 管理画面のログイン認証情報 (必須) |
| `UI_LANGUAGE` | 管理画面の既定言語: `ja` (既定) / `en`。画面上部のトグルで切替可能 (選択はブラウザに保存され、サーバ側の現在言語にも反映) |
| `SESSION_SECRET` | セッション Cookie 署名用の長いランダム文字列 (必須) |
| `RECORD_ALL_AUDIO` | `true` で `./recordings/` に生 PCM を保存 |

## 起動とテスト (cloudflared)

### 1. サーバ起動 (初回)

```bash
node server.js
```

### 2. cloudflared で公開

```bash
cloudflared tunnel --url http://localhost:3000
```

ログに出る `https://xxxx.trycloudflare.com` をコピーします。

### 3. .env の Vonage 設定 → 再起動

`.env` に以下を設定してサーバを再起動します (Vonage Dashboard のアプリから `private.key` をダウンロードして配置):

```bash
VONAGE_APPLICATION_ID=<アプリケーションID>
VONAGE_LVN=<LVN (E.164)>
VONAGE_PRIVATE_KEY_PATH=./private.key
VONAGE_ANSWER_URL=https://xxxx.trycloudflare.com/answer
VONAGE_EVENT_URL=https://xxxx.trycloudflare.com/event
```

起動ログに `>>> Vonage webhooks applied:` と出れば、Applications API 経由で Answer/Event URL の自動設定完了です (失敗した場合はログの指示どおり Dashboard で手動設定)。`VONAGE_ANSWER_URL` は NCCO の WebSocket URI にも使われます。

### 4. ヘルスチェック

```bash
curl http://localhost:3000/health   # → Ok
```

LVN をアプリケーションにリンクしていれば準備完了です。

### 5. 通話テスト

LVN 着信 → ブラウザで `https://xxxx.trycloudflare.com/login` にアクセス → 管理者ログイン → 話者分離トランスクリプトがリアルタイム表示される:

- **User** (青・左寄せ): ElevenLabs の `user_transcript` (確定前は破線の interim 表示)
- **Bot** (緑・右寄せ): ElevenLabs の `agent_response`
- 中央のシステムノート: 通話イベント / バージンイン / エラー
- 管理画面は既定で日本語。右上のトグルで英語と切り替え可能 (`UI_LANGUAGE` で既定変更)

### 言語切り替え (JA / EN)

右上の JA/EN トグルは、単なる UI 表示だけでなく **サーバ全体の言語** を切り替えます:

| 対象 | 切替内容 |
|---|---|
| フロントエンド | 管理画面の表示言語 (data-i18n、選択はブラウザに保存) |
| バックエンド | `POST /admin/api/language` でサーバに保存。SSE 経由で他ブラウザにも `language_changed` が配信され、トランスクリプトに切替ノートが表示 |
| メッセージ読み上げ (Vonage) | 着信時の `talk` 挨拶が `GREETING_TEXT_JA` / `GREETING_TEXT_EN` から現在言語で選択され、音声言語も `ja-JP` / `en-US` に切替 |
| メッセージ読み上げ (ElevenLabs) | 会話開始時に `conversation_config_override.agent.language` へ現在言語を送信 (`AGENT_LANGUAGE` 明示指定時はそちらを優先) |

切り替えは **次回の着信・会話開始から** 適用されます (通話中は言語を固定)。

### 6. 通話なしでの単体確認

```bash
# ログイン・SSE・空状態表示は通話なしで確認可能
open http://localhost:3000/login
```

## API / エンドポイント

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| GET | `/health` | 不要 | ヘルスチェック |
| GET/POST | `/answer` | 不要 (Vonage) | Answer webhook → NCCO 返却 |
| POST | `/event` | 不要 (Vonage) | 状態イベント webhook |
| WS | `/socket?peer_uuid=...` | peer_uuid 必須 | Vonage メディアストリーミング |
| GET | `/login` `POST /login` `POST /logout` | – | 管理者ログイン (失敗 5 回で 5 分ロック) |
| GET | `/admin` | セッション | 管理画面 |
| GET/POST | `/admin/api/language` | セッション | 現在言語の取得 / 切替 (`{"language":"ja"}` または `"en"`)。切替時は SSE で `language_changed` 配信 |
| GET | `/admin/events` | セッション | トランスクリプト SSE (履歴リプレイ + リアルタイム) |
| GET | `/admin/api/state` | セッション | イベント履歴 JSON |

## セキュリティ

- ログイン: ユーザ名/パスワードは `.env` から取得、`crypto.timingSafeEqual` でタイミングセーフ比較、ログイン失敗は IP 単位でレート制限 (5 回 / 15 分で 5 分ロック)
- セッション: `express-session` + httpOnly / SameSite=Lax Cookie、ログイン成功時にセッション ID を再生成
- `/admin*` および `/admin/events` (SSE) は未認証を拒否 (HTML ナビゲーションは `/login` へリダイレクト、API/SSE は 401)
- Vonage WebSocket は `peer_uuid` パラメータ必須 (ブラウザからの直接接続は拒否)

### 秘密情報の PUSH 防止 (pre-push フック)

`scripts/hooks/pre-push` は **`git push` 時に、PUSH するコミット内の以下を検出して PUSH を拒否** します (force push・履歴からの古いコミットも含めて全走査):

| 種別 | ブロック対象 |
|---|---|
| パス | `.env`, `*.env` (`prod.env` 等), `.env.*` (`.env.local` 等)、`private.key`, `*.key`, `*.pem`, `*.p12`, `*.pfx`, `*.p8`, `*.jks`, `*.keystore`, `credentials.json`, `secrets.json`, `recordings/`, `.npmrc`, `id_rsa` 等 (`scripts/hooks/path-blocklist`) |
| 内容 | PEM/OpenSSH 秘密鍵 (例: `-----BEGIN PRIVATE KEY-----`), ElevenLabs `sk_...`, AWS `AKIA...`/`AWS_SECRET_ACCESS_KEY`, GitHub `ghp_`/`github_pat_`, GitLab `glpat-`, JWT, `authToken` (`scripts/hooks/content-blocklist`) |

許可されているのは安全なテンプレート `.env.example` のみです (例外としてスキップ)。

**有効化**: フックはリポジトリに同梱されています。クローン後一度だけ:

```bash
git config core.hooksPath scripts/hooks
```

(現在のリポジトリでは設定済み `git config --get core.hooksPath` で確認できます)

## 音声フォーマットメモ

- Vonage ↔ サーバ: `audio/l16;rate=16000` (16 bit LE mono 16 kHz、20 ms = 640 バイト)
- サーバ → Vonage: ElevenLabs から届く音声バイトを **18 ms タイマーで 640 バイト刻み**に整えて送信 (ペーシングのみ。VAD とは無関係)
- ElevenLabs ↔ サーバ: `user_audio_chunk` (base64) / `audio_event.audio_base_64`
