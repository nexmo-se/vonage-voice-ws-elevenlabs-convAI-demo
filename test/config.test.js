'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { loadConfig } = require('../src/config');

const BASE = {
  ELEVENLABS_API_KEY: 'eleven_test_key',
  ELEVENLABS_AGENT_ID: 'agent_1',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 's3cret',
  SESSION_SECRET: 's3ssion-secret',
};

function loadWith(overrides = {}) {
  const prev = { ...process.env };
  try {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, BASE, overrides);
    return loadConfig();
  } finally {
    process.env = prev;
  }
}

function expectExit(run) {
  const originalExit = process.exit;
  const originalError = console.error;
  console.error = () => {};
  let code = null;
  process.exit = (c) => {
    code = c;
    throw new Error('exit');
  };
  try {
    assert.throws(run, /exit/);
  } finally {
    process.exit = originalExit;
    console.error = originalError;
  }
  assert.strictEqual(code, 1);
}

test('config: defaults without a public URL', () => {
  const config = loadWith();
  assert.strictEqual(config.port, 3000);
  assert.strictEqual(config.uiLanguage, 'ja');
  assert.strictEqual(config.trustProxy, false);
  assert.strictEqual(config.secureCookies, false);
  assert.strictEqual(config.vonage.applyWebhooks, false);
});

test('config: HTTPS public URL enables proxy trust and secure cookies', () => {
  const config = loadWith({ PUBLIC_URL: 'https://demo.example' });
  assert.strictEqual(config.trustProxy, true);
  assert.strictEqual(config.secureCookies, true);
});

test('config: VONAGE_ANSWER_URL https also enables proxy trust', () => {
  const config = loadWith({ VONAGE_ANSWER_URL: 'https://demo.example/answer' });
  assert.strictEqual(config.trustProxy, true);
  assert.strictEqual(config.secureCookies, true);
});

test('config: TRUST_PROXY overrides the derived value', () => {
  assert.strictEqual(loadWith({ TRUST_PROXY: 'false', PUBLIC_URL: 'https://demo.example' }).trustProxy, false);
  assert.strictEqual(loadWith({ TRUST_PROXY: 'loopback' }).trustProxy, 'loopback');
  assert.strictEqual(loadWith({ TRUST_PROXY: true }).trustProxy, true);
});

test('config: invalid UI_LANGUAGE exits with code 1', () => {
  expectExit(() => loadWith({ UI_LANGUAGE: 'fr' }));
});

test('config: invalid URL exits with code 1', () => {
  expectExit(() => loadWith({ PUBLIC_URL: 'not a url' }));
  expectExit(() => loadWith({ VONAGE_ANSWER_URL: 'ftp://x' }));
});

test('config: out-of-range inactivity seconds exits with code 1', () => {
  expectExit(() => loadWith({ ELEVENLABS_INACTIVITY_SECONDS: '0' }));
  expectExit(() => loadWith({ ELEVENLABS_INACTIVITY_SECONDS: '999' }));
});

test('config: warns when placeholders from .env.example are still in use', () => {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(String(message));
  try {
    loadWith({ ADMIN_PASSWORD: 'change-me', SESSION_SECRET: 'please-change-this-session-secret' });
  } finally {
    console.warn = originalWarn;
  }
  assert.strictEqual(warnings.length, 2);
  assert.match(warnings[0], /ADMIN_PASSWORD/);
  assert.match(warnings[1], /SESSION_SECRET/);
});

test('config: missing required variable exits with code 1', () => {
  expectExit(() => loadWith({ ELEVENLABS_API_KEY: '' }));
});