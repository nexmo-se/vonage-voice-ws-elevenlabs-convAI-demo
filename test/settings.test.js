'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const settings = require('../src/settings');
const { isValidPeerUuid } = require('../src/uuid');

test('settings: init defaults to ja and clamps invalid values', () => {
  settings.initLanguage('en');
  assert.strictEqual(settings.getLanguage(), 'en');
  settings.initLanguage('xx');
  assert.strictEqual(settings.getLanguage(), 'ja');
});

test('settings: setLanguage accepts ja/en, rejects others', () => {
  assert.strictEqual(settings.setLanguage('ja'), true);
  assert.strictEqual(settings.getLanguage(), 'ja');
  assert.strictEqual(settings.setLanguage('en'), true);
  assert.strictEqual(settings.setLanguage('fr'), false);
  assert.strictEqual(settings.setLanguage(''), false);
  assert.strictEqual(settings.getLanguage(), 'en');
});

test('settings: displayLanguage', () => {
  assert.strictEqual(settings.displayLanguage('ja'), '日本語');
  assert.strictEqual(settings.displayLanguage('en'), 'English');
  assert.strictEqual(settings.displayLanguage('xx'), '日本語');
});

test('isValidPeerUuid accepts Vonage UUIDs', () => {
  assert.strictEqual(isValidPeerUuid('123e4567-e89b-12d3-a456-426614174000'), true);
  assert.strictEqual(isValidPeerUuid('123E4567-E89B-12D3-A456-426614174000'), true);
});

test('isValidPeerUuid rejects malformed / path-traversal values', () => {
  for (const bad of [
    '',
    null,
    42,
    'not-a-uuid',
    '123e4567e89b12d3a456426614174000',
    '../../etc/passwd',
    '123e4567-e89b-12d3-a456-426614174000/../../x',
    '123e4567-e89b-12d3-a456-4266141740000',
    ' g123e4567-e89b-12d3-a456-426614174000',
  ]) {
    assert.strictEqual(isValidPeerUuid(bad), false, `should reject: ${String(bad)}`);
  }
});