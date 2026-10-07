'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const { EventBus } = require('../src/events');
const { createAdminRouter } = require('../src/routes/admin');

function startServer() {
  const bus = new EventBus();
  const app = express();
  app.use(express.json());
  // Fake session: the test exercises the router (state/events) directly.
  app.use((req, res, next) => {
    req.session = { authenticated: true };
    next();
  });
  app.use('/', createAdminRouter({ uiLanguage: 'ja' }, bus));

  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, port, bus });
    });
  });
}

async function stopServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

test('admin state: returns replay events and honors ?since=', async () => {
  const { server, port, bus } = await startServer();
  try {
    bus.publish({ type: 'call_event', call_event: 'answered', call_uuid: 'u1' });
    bus.publish({ type: 'user_transcript', speaker: 'user', text: 'hello', is_final: true });
    bus.publish({ type: 'agent_response', speaker: 'agent', text: 'hi', call_uuid: 'u1' });

    const full = await fetch(`http://127.0.0.1:${port}/admin/api/state`).then((r) => r.json());
    assert.strictEqual(full.events.length, 3);

    const lastSeq = full.events[full.events.length - 1].seq;
    const inc = await fetch(
      `http://127.0.0.1:${port}/admin/api/state?since=${lastSeq}`
    ).then((r) => r.json());
    assert.deepStrictEqual(inc.events, []);

    bus.publish({ type: 'user_transcript', speaker: 'user', text: 'next', is_final: true });
    const inc2 = await fetch(
      `http://127.0.0.1:${port}/admin/api/state?since=${lastSeq}`
    ).then((r) => r.json());
    assert.strictEqual(inc2.events.length, 1);
    assert.strictEqual(inc2.events[0].text, 'next');
  } finally {
    await stopServer(server);
  }
});

test('admin state: unauthenticated returns 401', async () => {
  const bus = new EventBus();
  const app = express();
  app.use((req, res, next) => {
    req.session = { authenticated: false };
    next();
  });
  app.use('/', createAdminRouter({ uiLanguage: 'ja' }, bus));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const port = server.address().port;
    const resp = await fetch(`http://127.0.0.1:${port}/admin/api/state`);
    assert.strictEqual(resp.status, 401);
  } finally {
    await stopServer(server);
  }
});