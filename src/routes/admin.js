'use strict';

const path = require('path');
const express = require('express');
const { requireAuth } = require('../auth');
const { renderPage, buildAppConfig } = require('../render-page');
const settings = require('../settings');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

function createAdminRouter(config, bus) {
  const router = express.Router();

  router.get('/admin', requireAuth, (req, res) => {
    renderPage(res, path.join(PUBLIC_DIR, 'admin.html'), buildAppConfig(config));
  });

  router.get('/admin/api/language', requireAuth, (req, res) => {
    res.json({ language: settings.getLanguage() });
  });

  router.post('/admin/api/language', requireAuth, (req, res) => {
    const language = req.body && req.body.language;
    if (!settings.setLanguage(language)) {
      return res.status(400).json({ error: 'language must be "ja" or "en"' });
    }
    bus.publish({
      type: 'language_changed',
      language: settings.getLanguage(),
    });
    res.json({ language: settings.getLanguage() });
  });

  router.get('/admin/api/state', requireAuth, (req, res) => {
    const since = Number(req.query.since) || 0;
    res.json({
      events: since > 0 ? bus.replay().filter((e) => e.seq > since) : bus.replay(),
    });
  });

  router.get('/admin/events', requireAuth, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    // Force flush headers immediately
    res.flushHeaders?.();

    const send = (event) => {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      const ok = res.write(data);
      if (!ok) {
        // Buffer full, wait for drain
        return new Promise((resolve) => res.once('drain', resolve));
      }
    };

    // Send replay history
    for (const event of bus.replay()) {
      send(event);
    }

    const unsubscribe = bus.subscribe(send);
    const keepAlive = setInterval(() => {
      const ok = res.write(': keepalive\n\n');
      if (!ok) {
        // If buffer full, skip this keepalive
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
    });

    // Handle client disconnect / errors
    req.on('error', () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });

  return router;
}

module.exports = { createAdminRouter };
