'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { createJwt, authHeaders } = require('../src/vonage');

function generateKeyPair() {
  return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
}

function writePem(content) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vk-')), 'private.key');
  fs.writeFileSync(file, content);
  return file;
}

test('createJwt: produces an RS256 JWT with application_id and short exp', () => {
  const { privateKey } = generateKeyPair();
  const jwt = createJwt(privateKey.export({ type: 'pkcs8', format: 'pem' }), 'app-123');

  const [header, payload, signature] = jwt.split('.');
  assert.strictEqual(JSON.parse(Buffer.from(header, 'base64url')).alg, 'RS256');

  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  assert.strictEqual(claims.application_id, 'app-123');
  assert.ok(claims.iat > 0);
  assert.strictEqual(claims.exp - claims.iat, 900);

  const pub = crypto.createPublicKey(privateKey);
  const valid = crypto.verify(
    'sha256',
    Buffer.from(`${header}.${payload}`),
    pub,
    Buffer.from(signature, 'base64url')
  );
  assert.strictEqual(valid, true);
});

test('authHeaders: returns null with no credentials', () => {
  assert.strictEqual(authHeaders({ apiKey: '', apiSecret: '', privateKeyPath: '' }), null);
});

test('authHeaders: prefers Basic when apiKey+secret are present', () => {
  const headers = authHeaders({
    apiKey: 'key',
    apiSecret: 'secret',
    privateKeyPath: '/does/not/exist',
    applicationId: 'a',
  });
  assert.match(headers.Authorization, /^Basic /);
  const decoded = Buffer.from(headers.Authorization.slice(6), 'base64').toString();
  assert.strictEqual(decoded, 'key:secret');
});

test('authHeaders: falls back to JWT Bearer when only the key exists', () => {
  const { privateKey } = generateKeyPair();
  const keyPath = writePem(privateKey.export({ type: 'pkcs8', format: 'pem' }));
  const headers = authHeaders({ apiKey: '', apiSecret: '', applicationId: 'app-x', privateKeyPath: keyPath });
  assert.match(headers.Authorization, /^Bearer /);
  const claims = JSON.parse(
    Buffer.from(headers.Authorization.slice(7).split('.')[1], 'base64url')
  );
  assert.strictEqual(claims.application_id, 'app-x');
});