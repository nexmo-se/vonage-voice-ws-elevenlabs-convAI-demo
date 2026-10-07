'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const settings = require('../src/settings');
const { buildNcco, resolveBaseUrl } = require('../src/ncco');

const baseConfig = {
  port: 3000,
  publicUrl: '',
  vonage: { answerUrl: '' },
  greetingTextJa: 'お電話ありがとうございます。ただいま接続いたします。',
  greetingTextEn: 'Thank you for calling. Connecting you now.',
  greetingLanguage: '',
};

const req = {
  protocol: 'https',
  headers: {
    host: 'demo.example',
    'x-forwarded-proto': 'https',
    'x-forwarded-host': 'proxy.example, real.example',
  },
};

function call(uuid) {
  return { uuid, conversation_uuid: 'conv', from: '819011111111', to: '819012345678' };
}

test('resolveBaseUrl: precedence is VONAGE_ANSWER_URL > PUBLIC_URL > Host headers', () => {
  const c = {
    ...baseConfig,
    vonage: { answerUrl: 'https://answer.example/answer?x=1' },
    publicUrl: 'https://pub.example',
  };
  assert.strictEqual(resolveBaseUrl(c, req), 'https://answer.example');

  const c2 = { ...baseConfig, publicUrl: 'https://pub.example' };
  assert.strictEqual(resolveBaseUrl(c2, req), 'https://pub.example');

  const c3 = { ...baseConfig };
  assert.strictEqual(resolveBaseUrl(c3, req), 'https://proxy.example');

  const c4 = { ...baseConfig };
  const plainReq = { protocol: 'http', headers: { host: 'localhost:3000' } };
  assert.strictEqual(resolveBaseUrl(c4, plainReq), 'http://localhost:3000');
});

test('buildNcco: talk greeting follows the current language', () => {
  settings.setLanguage('ja');
  let ncco = buildNcco(baseConfig, req, call('u1'));
  let talk = ncco.find((a) => a.action === 'talk');
  assert.strictEqual(talk.text, baseConfig.greetingTextJa);
  assert.strictEqual(talk.language, 'ja-JP');

  settings.setLanguage('en');
  ncco = buildNcco(baseConfig, req, call('u2'));
  talk = ncco.find((a) => a.action === 'talk');
  assert.strictEqual(talk.text, baseConfig.greetingTextEn);
  assert.strictEqual(talk.language, 'en-US');
});

test('buildNcco: GREETING_LANGUAGE override wins over the language default', () => {
  settings.setLanguage('ja');
  const withOverride = { ...baseConfig, greetingLanguage: 'en-US' };
  const talk = buildNcco(withOverride, req, call('u3')).find((a) => a.action === 'talk');
  assert.strictEqual(talk.language, 'en-US');
});

test('buildNcco: empty greetings omit the talk action', () => {
  settings.setLanguage('ja');
  const ncco = buildNcco({ ...baseConfig, greetingTextJa: '', greetingTextEn: '' }, req, call('u4'));
  assert.ok(!ncco.some((a) => a.action === 'talk'));
});

test('buildNcco: websocket connect carries peer_uuid and 16 kHz format', () => {
  const connect = buildNcco(baseConfig, req, call('123e4567-e89b-12d3-a456-426614174000'))
    .find((a) => a.action === 'connect');
  assert.strictEqual(connect.endpoint[0]['content-type'], 'audio/l16;rate=16000');
  assert.match(connect.endpoint[0].uri, /peer_uuid=123e4567-e89b-12d3-a456-426614174000$/);
  assert.strictEqual(connect.endpoint[0].headers.peer_uuid, '123e4567-e89b-12d3-a456-426614174000');
  assert.match(connect.endpoint[0].uri, /^wss:\/\//);
});