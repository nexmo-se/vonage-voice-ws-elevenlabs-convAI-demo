'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function loadI18n() {
  const source = fs.readFileSync(path.join(PUBLIC_DIR, 'i18n.js'), 'utf8');
  const sandbox = {
    window: {},
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { documentElement: {}, querySelectorAll: () => [] },
  };
  vm.createContext(sandbox);
  vm.runInContext(source + '\nthis.__I18N = I18N;', sandbox);
  return sandbox.__I18N;
}

function referencedKeys() {
  const keys = new Set();

  for (const file of ['login.html', 'admin.html']) {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf8');
    for (const m of html.matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)) keys.add(m[1]);
  }

  const adminJs = fs.readFileSync(path.join(PUBLIC_DIR, 'admin.js'), 'utf8');
  for (const m of adminJs.matchAll(/\bt\('([^']+)'/g)) keys.add(m[1]);
  for (const m of adminJs.matchAll(/'(note\.[A-Za-z]+)'/g)) keys.add(m[1]);

  return keys;
}

test('i18n: ja and en have identical key sets', () => {
  const I18N = loadI18n();
  const ja = new Set(Object.keys(I18N.ja));
  const en = new Set(Object.keys(I18N.en));
  assert.deepStrictEqual(ja, en);
});

test('i18n: every referenced key exists in both languages', () => {
  const I18N = loadI18n();
  for (const key of referencedKeys()) {
    assert.ok(key in I18N.ja, `ja missing: ${key}`);
    assert.ok(key in I18N.en, `en missing: ${key}`);
  }
});

test('i18n: t() interpolates params and falls back to ja', () => {
  const source = fs.readFileSync(path.join(PUBLIC_DIR, 'i18n.js'), 'utf8');
  const sandbox = {
    window: {},
    localStorage: {
      getItem: () => 'en',
      setItem: () => {},
    },
    document: { documentElement: {}, querySelectorAll: () => [] },
  };
  vm.createContext(sandbox);
  vm.runInContext(
    source +
      '\nthis.__t = t; this.__setLang = setLang; this.__getLang = getLang; this.__displayLanguage = displayLanguage;',
    sandbox
  );

  assert.strictEqual(sandbox.__getLang(), 'en');
  assert.strictEqual(sandbox.__t('transcript.title'), 'Live transcript');
  assert.strictEqual(sandbox.__t('note.dtmf', { digits: '42' }), 'DTMF: 42');
  assert.strictEqual(sandbox.__displayLanguage('ja'), '日本語');
  assert.strictEqual(sandbox.__displayLanguage('en'), 'English');

  sandbox.__setLang('ja');
  assert.strictEqual(sandbox.__t('transcript.title'), 'ライブトランスクリプト');
});