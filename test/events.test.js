'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { EventBus, MAX_EVENTS } = require('../src/events');

test('EventBus: publishes with seq and ts', () => {
  const bus = new EventBus();
  const seen = [];
  bus.subscribe((event) => seen.push(event));
  bus.publish({ type: 'x' });
  bus.publish({ type: 'y', ts: '2020-01-01T00:00:00.000Z' });

  assert.strictEqual(seen.length, 2);
  assert.strictEqual(seen[0].seq, 1);
  assert.strictEqual(seen[0].type, 'x');
  assert.ok(seen[0].ts);
  assert.strictEqual(seen[1].seq, 2);
  assert.strictEqual(seen[1].ts, '2020-01-01T00:00:00.000Z');
});

test('EventBus: unsubscribe stops delivery', () => {
  const bus = new EventBus();
  let count = 0;
  const off = bus.subscribe(() => count++);
  bus.publish({ type: 'a' });
  off();
  bus.publish({ type: 'b' });
  assert.strictEqual(count, 1);
});

test('EventBus: replay returns a copy of history', () => {
  const bus = new EventBus();
  bus.publish({ type: 'a' });
  const snapshot = bus.replay();
  bus.publish({ type: 'b' });
  assert.strictEqual(snapshot.length, 1);
  assert.strictEqual(snapshot[0].type, 'a');
  snapshot.push({ type: 'mutated' });
  assert.strictEqual(bus.replay().length, 2);
});

test('EventBus: history is capped at MAX_EVENTS', () => {
  const bus = new EventBus();
  for (let i = 0; i < MAX_EVENTS + 50; i++) {
    bus.publish({ type: 'n', index: i });
  }
  const history = bus.replay();
  assert.strictEqual(history.length, MAX_EVENTS);
  assert.strictEqual(history[0].index, 50);
  assert.strictEqual(history[history.length - 1].index, MAX_EVENTS + 49);
});

test('EventBus: a throwing listener does not break other listeners', () => {
  const bus = new EventBus();
  bus.subscribe(() => {
    throw new Error('boom');
  });
  let ok = false;
  bus.subscribe(() => {
    ok = true;
  });
  bus.publish({ type: 'x' });
  assert.strictEqual(ok, true);
});