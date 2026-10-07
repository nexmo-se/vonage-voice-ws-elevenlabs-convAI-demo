'use strict';

const crypto = require('crypto');
const path = require('path');
const express = require('express');
const session = require('express-session');
const { renderPage, buildAppConfig } = require('./render-page');

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 5 * 60 * 1000;

function timingSafeEqualString(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function createLoginRateLimiter() {
  const attempts = new Map();

  function getEntry(ip) {
    const now = Date.now();
    let entry = attempts.get(ip);
    if (!entry || now - entry.firstSeen > WINDOW_MS) {
      entry = { firstSeen: now, count: 0, lockedUntil: 0 };
      attempts.set(ip, entry);
    }
    return entry;
  }

  return {
    checkAllowed(ip) {
      const entry = getEntry(ip);
      if (entry.lockedUntil > Date.now()) {
        return { allowed: false, retryAfterMs: entry.lockedUntil - Date.now() };
      }
      return { allowed: true };
    },
    recordFailure(ip) {
      const entry = getEntry(ip);
      entry.count += 1;
      if (entry.count >= MAX_ATTEMPTS) {
        entry.lockedUntil = Date.now() + LOCK_MS;
      }
      attempts.set(ip, entry);
    },
    recordSuccess(ip) {
      attempts.delete(ip);
    },
  };
}

function createAuthRouter(config) {
  const router = express.Router();
  const rateLimiter = createLoginRateLimiter();

  router.get('/login', (req, res) => {
    if (req.session.authenticated) {
      return res.redirect('/admin');
    }
    renderPage(res, path.join(__dirname, '..', 'public', 'login.html'), buildAppConfig(config));
  });

  router.post('/login', express.urlencoded({ extended: false }), (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const { allowed } = rateLimiter.checkAllowed(ip);

    if (!allowed) {
      return res.redirect('/login?error=rate_limited');
    }

    const username = req.body && req.body.username;
    const password = req.body && req.body.password;

    const userOk = timingSafeEqualString(username || '', config.adminUsername);
    const passOk = timingSafeEqualString(password || '', config.adminPassword);

    if (userOk && passOk) {
      rateLimiter.recordSuccess(ip);
      req.session.regenerate((error) => {
        if (error) {
          console.error('Session regenerate error:', error);
          return res.status(500).send('Internal server error');
        }
        req.session.authenticated = true;
        res.redirect('/admin');
      });
      return;
    }

    rateLimiter.recordFailure(ip);
    res.redirect('/login?error=credentials');
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  });

  return router;
}

function createSessionMiddleware(config) {
  return session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 12 * 60 * 60 * 1000,
    },
  });
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  const accept = String(req.headers.accept || '');
  if (req.path.endsWith('/events') || accept.includes('text/event-stream')) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (accept.includes('text/html')) {
    return res.redirect('/login');
  }
  res.status(401).json({ error: 'unauthorized' });
}

module.exports = {
  createAuthRouter,
  createSessionMiddleware,
  requireAuth,
};
