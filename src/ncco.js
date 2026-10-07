'use strict';

const settings = require('./settings');

function resolveBaseUrl(config, req) {
  // Precedence: VONAGE_ANSWER_URL origin > PUBLIC_URL > request Host headers
  if (config.vonage && config.vonage.answerUrl) {
    const url = new URL(config.vonage.answerUrl);
    return url.origin;
  }
  if (config.publicUrl) return config.publicUrl;
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || `localhost:${config.port}`).split(',')[0].trim();
  return `${proto}://${host}`;
}

function buildNcco(config, req, call) {
  const baseUrl = resolveBaseUrl(config, req);
  const wsScheme = baseUrl.replace(/^http/, 'ws');
  const wsUri = `${wsScheme}/socket?peer_uuid=${encodeURIComponent(call.uuid || '')}`;

  const language = settings.getLanguage();
  const greetingText =
    language === 'en' ? config.greetingTextEn : config.greetingTextJa;
  const greetingLanguage =
    config.greetingLanguage || (language === 'en' ? 'en-US' : 'ja-JP');

  const ncco = [];

  if (greetingText) {
    ncco.push({
      action: 'talk',
      text: greetingText,
      language: greetingLanguage,
    });
  }

  ncco.push({
    action: 'connect',
    eventUrl: [`${baseUrl}/event`],
    from: call.from,
    endpoint: [
      {
        type: 'websocket',
        uri: wsUri,
        'content-type': 'audio/l16;rate=16000',
        headers: {
          peer_uuid: String(call.uuid || ''),
          conversation_uuid: String(call.conversation_uuid || ''),
        },
      },
    ],
  });

  return ncco;
}

function createAnswerHandler(config, bus) {
  return function answerHandler(req, res) {
    const query = req.method === 'GET' ? req.query : req.body || {};
    const call = {
      uuid: query.uuid || '',
      conversation_uuid: query.conversation_uuid || '',
      from: query.from || '',
      to: query.to || '',
    };

    console.log(`>>> Answer webhook: uuid=${call.uuid} from=${call.from} to=${call.to}`);

    const configuredLvn = config.vonage && config.vonage.lvn;
    if (configuredLvn && call.to) {
      const digits = (s) => String(s).replace(/\D/g, '');
      if (digits(configuredLvn) !== digits(call.to)) {
        console.warn(
          `Warning: inbound "to" (${call.to}) does not match VONAGE_LVN (${configuredLvn})`
        );
      }
    }

    bus.publish({
      type: 'call_event',
      call_event: 'answered',
      call_uuid: call.uuid,
      from: call.from,
      to: call.to,
    });

    res.status(200).json(buildNcco(config, req, call));
  };
}

module.exports = { createAnswerHandler, buildNcco, resolveBaseUrl };
