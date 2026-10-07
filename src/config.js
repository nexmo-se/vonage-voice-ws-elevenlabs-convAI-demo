'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');

function required(name) {
  const value = (process.env[name] || '').trim();
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function optional(name, fallback = '') {
  return (process.env[name] || '').trim() || fallback;
}

function optionalNumber(name, fallback) {
  const raw = optional(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (Number.isNaN(value)) {
    console.error(`Invalid number in environment variable ${name}: ${raw}`);
    process.exit(1);
  }
  return value;
}

function optionalUrl(name) {
  const raw = optional(name);
  if (!raw) return '';
  let url;
  try {
    url = new URL(raw);
  } catch {
    console.error(`Invalid URL in environment variable ${name}: ${raw}`);
    process.exit(1);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    console.error(`${name} must be an http(s) URL: ${raw}`);
    process.exit(1);
  }
  return url.toString().replace(/\/+$/, '');
}

function loadConfig() {
  const config = {
    port: optionalNumber('PORT', 3000),
    publicUrl: optionalUrl('PUBLIC_URL'),

    vonage: {
      applicationId: optional('VONAGE_APPLICATION_ID'),
      lvn: optional('VONAGE_LVN'),
      privateKeyPath: optional('VONAGE_PRIVATE_KEY_PATH'),
      apiKey: optional('VONAGE_API_KEY'),
      apiSecret: optional('VONAGE_API_SECRET'),
      answerUrl: optionalUrl('VONAGE_ANSWER_URL'),
      eventUrl: optionalUrl('VONAGE_EVENT_URL'),
    },

    elevenLabsApiKey: required('ELEVENLABS_API_KEY'),
    elevenLabsAgentId: required('ELEVENLABS_AGENT_ID'),
    elevenLabsVoiceId: optional('ELEVENLABS_VOICE_ID'),
    agentPrompt: optional('AGENT_PROMPT'),
    agentFirstMessage: optional('AGENT_FIRST_MESSAGE'),
    // Empty = follow the admin UI language (ja/en) at conversation start
    agentLanguage: optional('AGENT_LANGUAGE'),
    elevenLabsInactivitySeconds: optionalNumber('ELEVENLABS_INACTIVITY_SECONDS', 180),

    // Spoken (Vonage talk) greeting; which one is used follows the admin UI language.
    greetingTextJa: optional('GREETING_TEXT_JA', 'お電話ありがとうございます。ただいま接続いたします。'),
    greetingTextEn: optional(
      'GREETING_TEXT_EN',
      'Thank you for calling. Connecting you now.'
    ),
    // Empty = ja-JP / en-US depending on the admin UI language
    greetingLanguage: optional('GREETING_LANGUAGE'),

    uiLanguage: optional('UI_LANGUAGE', 'ja'),

    adminUsername: required('ADMIN_USERNAME'),
    adminPassword: required('ADMIN_PASSWORD'),
    sessionSecret: required('SESSION_SECRET'),

    recordAllAudio: optional('RECORD_ALL_AUDIO') === 'true',
    recordingsDir: path.join(__dirname, '..', 'recordings'),
  };

  if (config.elevenLabsInactivitySeconds < 1 || config.elevenLabsInactivitySeconds > 180) {
    console.error('ELEVENLABS_INACTIVITY_SECONDS must be between 1 and 180');
    process.exit(1);
  }

  if (!['ja', 'en'].includes(config.uiLanguage)) {
    console.error(`UI_LANGUAGE must be "ja" or "en": ${config.uiLanguage}`);
    process.exit(1);
  }

  if (config.vonage.privateKeyPath) {
    const keyPath = path.isAbsolute(config.vonage.privateKeyPath)
      ? config.vonage.privateKeyPath
      : path.join(__dirname, '..', config.vonage.privateKeyPath);
    if (fs.existsSync(keyPath)) {
      config.vonage.privateKeyPath = keyPath;
    } else {
      console.warn(
        `Warning: VONAGE_PRIVATE_KEY_PATH not found (${keyPath}). ` +
          'JWT auth to the Vonage API will be unavailable.'
      );
      config.vonage.privateKeyPath = '';
    }
  }

  const { applicationId, answerUrl, eventUrl, apiKey, apiSecret, privateKeyPath } = config.vonage;
  const hasAuth = (apiKey && apiSecret) || privateKeyPath;
  config.vonage.applyWebhooks = Boolean(applicationId && answerUrl && eventUrl && hasAuth);

  return config;
}

module.exports = { loadConfig };
