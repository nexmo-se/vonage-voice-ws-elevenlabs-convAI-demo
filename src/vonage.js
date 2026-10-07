'use strict';

const crypto = require('crypto');
const fs = require('fs');

const API_BASE = 'https://api.nexmo.com';

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function createJwt(privateKey, applicationId) {
  const iat = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({ application_id: applicationId, iat, exp: iat + 900 })
  );
  const signature = crypto.sign(
    'sha256',
    Buffer.from(`${header}.${payload}`),
    crypto.createPrivateKey(privateKey)
  );
  return `${header}.${payload}.${signature.toString('base64url')}`;
}

function authHeaders(vonage) {
  if (vonage.apiKey && vonage.apiSecret) {
    const token = Buffer.from(`${vonage.apiKey}:${vonage.apiSecret}`).toString('base64');
    return { Authorization: `Basic ${token}` };
  }
  if (vonage.applicationId && vonage.privateKeyPath) {
    const privateKey = fs.readFileSync(vonage.privateKeyPath, 'utf8');
    return { Authorization: `Bearer ${createJwt(privateKey, vonage.applicationId)}` };
  }
  return null;
}

async function apiRequest(method, path, vonage, body) {
  const headers = authHeaders(vonage);
  if (!headers) {
    throw new Error(
      'No Vonage API credentials: set VONAGE_API_KEY/VONAGE_API_SECRET or ' +
        'VONAGE_APPLICATION_ID/VONAGE_PRIVATE_KEY_PATH'
    );
  }
  headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} -> HTTP ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function applyWebhooks(vonage) {
  const current = await apiRequest('GET', `/v2/applications/${vonage.applicationId}`, vonage);

  const capabilities = current.capabilities || {};
  const voice = capabilities.voice || {};
  const webhooks = { ...(voice.webhooks || {}) };

  webhooks.answer_url = { ...(webhooks.answer_url || {}), address: vonage.answerUrl, http_method: 'GET' };
  webhooks.event_url = { ...(webhooks.event_url || {}), address: vonage.eventUrl, http_method: 'POST' };

  const body = {
    name: current.name,
    capabilities: { ...capabilities, voice: { ...voice, webhooks } },
  };

  await apiRequest('PUT', `/v2/applications/${vonage.applicationId}`, vonage, body);

  console.log('>>> Vonage webhooks applied:');
  console.log(`    answer_url (GET): ${vonage.answerUrl}`);
  console.log(`    event_url  (POST): ${vonage.eventUrl}`);
}

module.exports = { applyWebhooks, createJwt, authHeaders };
