'use strict';

const I18N = {
  ja: {
    'login.title': 'ボット管理コンソール',
    'login.subtitle': 'ログインしてライブトランスクリプトを確認します',
    'login.username': '管理者ユーザー名',
    'login.password': 'パスワード',
    'login.submit': 'ログイン',
    'login.error.credentials': 'ユーザー名またはパスワードが正しくありません。',
    'login.error.rate_limited': 'ログイン失敗が多すぎます。しばらく待ってから再度お試しください。',

    'top.logout': 'ログアウト',
    'top.langSwitch': 'English',
    'badge.connected': '接続中',
    'badge.disconnected': '未接続',
    'badge.reconnecting': '再接続中...',

    'call.title': '通話状況',
    'call.none': '現在通話はありません',
    'call.active': '通話中',
    'call.from': '発信元',
    'call.to': '着信先',
    'call.lvn': 'LVN (自局番号)',
    'call.uuid': 'UUID',
    'session.title': 'セッション',
    'session.user': '利用者発話',
    'session.agent': 'ボット発話',
    'session.interruptions': '割り込み',

    'transcript.title': 'ライブトランスクリプト',
    'transcript.autoscroll': '自動スクロール',
    'transcript.empty': '通話待ち中...<br />Vonage の LVN に発信すると会話が表示されます。',
    'speaker.user': '利用者',
    'speaker.agent': 'ボット',

    'note.callAnswered': '着信 (発信元: {from})',
    'note.bridgeConnected': '音声ブリッジ接続',
    'note.conversationStarted': 'ElevenLabs 会話開始',
    'note.bridgeDisconnected': '音声ブリッジ切断',
    'note.callCompleted': '通話終了',
    'note.callDisconnected': '通話切断',
    'note.interruption': 'ボット割り込み (利用者のバージンイン)',
    'note.dtmf': 'DTMF: {digits}',
    'note.languageSwitched': '言語を切り替えました: {lang}',
    'note.bridgeError': 'ブリッジエラー: {detail}',
    'note.callEvent': '通話イベント: {status}',
  },

  en: {
    'login.title': 'Voice Bot Admin',
    'login.subtitle': 'Sign in to view live transcripts',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'login.error.credentials': 'Invalid username or password.',
    'login.error.rate_limited': 'Too many login attempts. Please wait a few minutes.',

    'top.logout': 'Logout',
    'top.langSwitch': '日本語',
    'badge.connected': 'connected',
    'badge.disconnected': 'disconnected',
    'badge.reconnecting': 'reconnecting...',

    'call.title': 'Active call',
    'call.none': 'No active call',
    'call.active': 'In progress',
    'call.from': 'From',
    'call.to': 'To',
    'call.lvn': 'LVN (your number)',
    'call.uuid': 'UUID',
    'session.title': 'Session',
    'session.user': 'User utterances',
    'session.agent': 'Bot utterances',
    'session.interruptions': 'Interruptions',

    'transcript.title': 'Live transcript',
    'transcript.autoscroll': 'Auto-scroll',
    'transcript.empty': 'Waiting for a call...<br />Call the Vonage LVN to start the conversation.',
    'speaker.user': 'User',
    'speaker.agent': 'Bot',

    'note.callAnswered': 'Call answered (from: {from})',
    'note.bridgeConnected': 'Audio bridge connected',
    'note.conversationStarted': 'ElevenLabs conversation started',
    'note.bridgeDisconnected': 'Audio bridge disconnected',
    'note.callCompleted': 'Call completed',
    'note.callDisconnected': 'Call disconnected',
    'note.interruption': 'Bot interrupted (user barge-in)',
    'note.dtmf': 'DTMF: {digits}',
    'note.languageSwitched': 'Language switched to: {lang}',
    'note.bridgeError': 'Bridge error: {detail}',
    'note.callEvent': 'Call event: {status}',
  },
};

function resolveInitialLanguage() {
  const saved = localStorage.getItem('uiLang');
  if (saved && I18N[saved]) return saved;
  const fallback =
    (window.APP_CONFIG && window.APP_CONFIG.uiLanguage) ||
    document.documentElement.lang ||
    'ja';
  return I18N[fallback] ? fallback : 'ja';
}

let currentLang = resolveInitialLanguage();

function t(key, params) {
  const table = I18N[currentLang] || I18N.ja;
  let text = table[key];
  if (text === undefined) text = I18N.ja[key] || key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

function getLang() {
  return currentLang;
}

function setLang(lang) {
  if (!I18N[lang]) return;
  currentLang = lang;
  localStorage.setItem('uiLang', lang);
  document.documentElement.lang = lang;
}

function displayLanguage(lang) {
  return lang === 'en' ? 'English' : '日本語';
}

function applyStaticI18n(root) {
  (root || document).querySelectorAll('[data-i18n]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18n);
  });
  (root || document).querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
  });
}

document.documentElement.lang = currentLang;
