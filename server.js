'use strict';

const express = require('express');
const expressWs = require('express-ws');

const { loadConfig } = require('./src/config');
const { EventBus } = require('./src/events');
const settings = require('./src/settings');
const { createAuthRouter, createSessionMiddleware, requireAuth } = require('./src/auth');
const { createAnswerHandler } = require('./src/ncco');
const { createBridge } = require('./src/bridge');
const { createAdminRouter } = require('./src/routes/admin');
const { applyWebhooks } = require('./src/vonage');

const config = loadConfig();
settings.initLanguage(config.uiLanguage);
const bus = new EventBus();

const app = express();
expressWs(app);

app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(createSessionMiddleware(config));
app.use(express.static(require('path').join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.status(200).send('Ok');
});

app.get('/answer', createAnswerHandler(config, bus));
app.post('/answer', createAnswerHandler(config, bus));

app.post('/event', (req, res) => {
  const body = req.body || {};
  console.log('>>> Vonage event:', JSON.stringify(body));
  bus.publish({
    type: 'call_event',
    call_event: body.status || 'event',
    call_uuid: body.uuid || body.conversation_uuid || '',
    from: body.from || '',
    to: body.to || '',
  });
  res.status(200).send('Ok');
});

app.use('/', createAuthRouter(config));
app.use('/', createAdminRouter(config, bus));

app.ws('/socket', requireAuthHolder(createBridge(config, bus)));

function requireAuthHolder(handler) {
  return (ws, req, next) => {
    // Vonage's WebSocket is not browser-session authenticated;
    // only guard against direct browser access without peer_uuid.
    if (!new URL(req.url, 'http://localhost').searchParams.get('peer_uuid')) {
      ws.close();
      return;
    }
    handler(ws, req);
  };
}

async function applyVonageWebhooks() {
  if (!config.vonage.applyWebhooks) {
    const missing = [];
    if (!config.vonage.applicationId) missing.push('VONAGE_APPLICATION_ID');
    if (!config.vonage.answerUrl) missing.push('VONAGE_ANSWER_URL');
    if (!config.vonage.eventUrl) missing.push('VONAGE_EVENT_URL');
    if (!config.vonage.apiKey || !config.vonage.apiSecret) {
      if (!config.vonage.privateKeyPath) missing.push('VONAGE_API_KEY/SECRET or VONAGE_PRIVATE_KEY_PATH');
    }
    if (missing.length) {
      console.log('>>> Vonage webhook auto-apply skipped (missing:', missing.join(', ') + ')');
      console.log('    Set the Answer/Event URLs manually in the Vonage Dashboard instead.');
    }
    return;
  }
  try {
    await applyWebhooks(config.vonage);
  } catch (error) {
    console.error('>>> Vonage webhook auto-apply failed:', error.message);
    console.error('    Set the Answer/Event URLs manually in the Vonage Dashboard instead.');
  }
}

applyVonageWebhooks().finally(() => {
  app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
    console.log(`Admin UI: http://localhost:${config.port}/login (language: ${settings.getLanguage()})`);
    console.log(`Answer webhook: ${config.vonage.answerUrl || `http://localhost:${config.port}/answer`}`);
    console.log(`Vonage LVN: ${config.vonage.lvn || '(not set in VONAGE_LVN)'}`);
    console.log(`ElevenLabs agent: ${config.elevenLabsAgentId} (language: ${config.agentLanguage})`);
  });
});
