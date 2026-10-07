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

// 'true'/'false' pass through, otherwise the raw string is handed to
// app.set('trust proxy', ...) (e.g. 'loopback', 'loopback, 172.16.0.0/12').
function parseTrustProxy(raw, defaultTrust) {
  if (!raw) return defaultTrust;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

const PLACEHOLDER_VALUES = new Set([
  'change-me',
  'please-change-this-session-secret',
  'your_elevenlabs_api_key',
  'your_elevenlabs_agent_id',
]);

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

  // Trust the proxy only when we are reached through a public HTTPS URL;
  // otherwise requests can spoof X-Forwarded-For and bypass the login ratelimiter.
  const behindTls =
    config.publicUrl.startsWith('https://') ||
    config.vonage.answerUrl.startsWith('https://') ||
    config.vonage.eventUrl.startsWith('https://');
  config.trustProxy = parseTrustProxy(process.env.TRUST_PROXY, behindTls);

  // Send the session cookie over HTTPS only when served behind a TLS proxy.
  config.secureCookies = config.trustProxy === true || behindTls;

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

  if (PLACEHOLDER_VALUES.has(config.adminPassword)) {
    console.warn('Warning: ADMIN_PASSWORD still set to the placeholder value from .env.example.');
  }
  if (PLACEHOLDER_VALUES.has(config.sessionSecret)) {
    console.warn('Warning: SESSION_SECRET still set to the placeholder value from .env.example.');
  }
  if (PLACEHOLDER_VALUES.has(config.elevenLabsApiKey)) {
    console.warn('Warning: ELEVENLABS_API_KEY still set to the placeholder value from .env.example.');
  }

  return config;
}

module.exports = { loadConfig };
