'use strict';

let language = 'ja';

function initLanguage(initial) {
  language = initial === 'en' ? 'en' : 'ja';
}

function getLanguage() {
  return language;
}

function setLanguage(lang) {
  if (lang !== 'ja' && lang !== 'en') return false;
  language = lang;
  return true;
}

function displayLanguage(lang) {
  return lang === 'en' ? 'English' : '日本語';
}

module.exports = { initLanguage, getLanguage, setLanguage, displayLanguage };
