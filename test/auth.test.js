'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { timingSafeEqualString, createLoginRateLimiter } = require('../src/auth');

test('timingSafeEqualString: equality and inequality', () => {
  assert.strictEqual(timingSafeEqualString('admin', 'admin'), true);
  assert.strictEqual(timingSafeEqualString('admin', 'Admin'), false);
  assert.strictEqual(timingSafeEqualString('a', 'ab'), false);
  assert.strictEqual(timingSafeEqualString('', ''), true);
});

test('login rate limiter: allows until 5 failures then locks', () => {
  const limiter = createLoginRateLimiter();
  const ip = '1.2.3.4';

  for (let i = 0; i < 4; i++) {
    limiter.recordFailure(ip);
    assert.strictEqual(limiter.checkAllowed(ip).allowed, true);
  }

  limiter.recordFailure(ip);
  const blocked = limiter.checkAllowed(ip);
  assert.strictEqual(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);
  assert.ok(blocked.retryAfterMs <= 5 * 60 * 1000);
});

test('login rate limiter: success clears the entry for that IP', () => {
  const limiter = createLoginRateLimiter();
  const ip = '1.2.3.4';
  limiter.recordFailure(ip);
  limiter.recordFailure(ip);
  limiter.recordSuccess(ip);
  assert.strictEqual(limiter.checkAllowed(ip).allowed, true);
});

test('login rate limiter: a bad IP does not affect another IP', () => {
  const limiter = createLoginRateLimiter();
  for (let i = 0; i < 5; i++) limiter.recordFailure('10.0.0.1');
  assert.strictEqual(limiter.checkAllowed('10.0.0.1').allowed, false);
  assert.strictEqual(limiter.checkAllowed('10.0.0.2').allowed, true);
});

test('login rate limiter: window resets the counter', () => {
  const realDateNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;

  const limiter = createLoginRateLimiter();
  const ip = '1.2.3.4';
  for (let i = 0; i < 5; i++) limiter.recordFailure(ip);
  assert.strictEqual(limiter.checkAllowed(ip).allowed, false);

  now += 20 * 60 * 1000; // beyond the 15 min window
  assert.strictEqual(limiter.checkAllowed(ip).allowed, true);

  Date.now = realDateNow;
});