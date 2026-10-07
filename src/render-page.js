'use strict';

const fs = require('fs');
const settings = require('./settings');

function renderPage(res, filePath, appConfig) {
  const html = fs.readFileSync(filePath, 'utf8');
  const json = JSON.stringify(appConfig).replace(/</g, '\\u003c');
  res
    .type('html')
    .send(html.replace('window.APP_CONFIG = {};', `window.APP_CONFIG = ${json};`));
}

function buildAppConfig(config) {
  return {
    uiLanguage: settings.getLanguage(),
    vonageLvn: config.vonage.lvn,
  };
}

module.exports = { renderPage, buildAppConfig };
