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
    res.json({ events: bus.replay() });
  });

  router.get('/admin/events', requireAuth, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    for (const event of bus.replay()) {
      send(event);
    }

    const unsubscribe = bus.subscribe(send);
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });

  return router;
}

module.exports = { createAdminRouter };
