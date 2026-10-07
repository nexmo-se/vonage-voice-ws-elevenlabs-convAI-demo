'use strict';

const transcriptEl = document.getElementById('transcript');
const sseStatusEl = document.getElementById('sse-status');
const autoscrollEl = document.getElementById('autoscroll');
const langToggleEl = document.getElementById('lang-toggle');

const callStatusEl = document.getElementById('call-status');
const callFromEl = document.getElementById('call-from');
const callToEl = document.getElementById('call-to');
const callLvnEl = document.getElementById('call-lvn');
const callUuidEl = document.getElementById('call-uuid');

const countUserEl = document.getElementById('count-user');
const countAgentEl = document.getElementById('count-agent');
const countInterruptionEl = document.getElementById('count-interruption');

const state = {
  seenSeqs: new Set(),
  items: [], // {kind:'utterance'|'note', ...}
  interim: null,
  counts: { user: 0, agent: 0, interruption: 0 },
  call: { active: false, from: '', to: '', uuids: new Set() },
};

//---- rendering helpers ----

function formatTime(iso) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString([], { hour12: false });
}

function scrollDown() {
  if (autoscrollEl.checked) {
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }
}

function buildEmptyState() {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.id = 'empty-state';
  div.innerHTML = t('transcript.empty');
  return div;
}

function buildEntry(item) {
  if (item.kind === 'note') {
    const div = document.createElement('div');
    div.className = `entry entry-system${item.level ? ` entry-${item.level}` : ''}`;
    div.innerHTML = `<span class="time">${formatTime(item.ts)}</span><span class="text"></span>`;
    div.querySelector('.text').textContent = t(item.key, item.params);
    return div;
  }

  const div = document.createElement('div');
  div.className = `entry entry-${item.speaker}${item.interim ? ' interim' : ''}`;
  div.innerHTML =
    `<div class="entry-head"><span class="speaker">${t(`speaker.${item.speaker}`)}</span>` +
    `<span class="time">${formatTime(item.ts)}</span></div><div class="text"></div>`;
  div.querySelector('.text').textContent = item.text || '...';
  return div;
}

function renderAll() {
  applyStaticI18n();
  transcriptEl.innerHTML = '';
  if (state.items.length === 0 && !state.interim) {
    transcriptEl.appendChild(buildEmptyState());
  } else {
    for (const item of state.items) transcriptEl.appendChild(buildEntry(item));
    if (state.interim) transcriptEl.appendChild(buildEntry(state.interim));
  }
  renderCallPanel();
  renderCounts();
  scrollDown();
}

function appendItem(item) {
  const empty = document.getElementById('empty-state');
  if (empty) empty.remove();
  transcriptEl.appendChild(buildEntry(item));
  scrollDown();
}

function renderCallPanel() {
  const c = state.call;
  if (c.active) {
    callStatusEl.textContent = t('call.active');
    callStatusEl.classList.add('active');
  } else {
    callStatusEl.textContent = t('call.none');
    callStatusEl.classList.remove('active');
  }
  callFromEl.textContent = c.from || '-';
  callToEl.textContent = c.to || '-';
  callUuidEl.textContent = c.uuids.size ? [...c.uuids].join(', ') : '-';
  callLvnEl.textContent =
    (window.APP_CONFIG && window.APP_CONFIG.vonageLvn) || '-';
}

function renderCounts() {
  countUserEl.textContent = state.counts.user;
  countAgentEl.textContent = state.counts.agent;
  countInterruptionEl.textContent = state.counts.interruption;
}

//---- event handling ----

function setActiveCall(callUuid, from, to) {
  if (callUuid) state.call.uuids.add(callUuid);
  state.call.active = true;
  if (from) state.call.from = from;
  if (to) state.call.to = to;
  renderCallPanel();
}

function clearActiveCall(callUuid) {
  if (callUuid) state.call.uuids.delete(callUuid);
  if (state.call.uuids.size === 0) state.call.active = false;
  renderCallPanel();
}

function handleEvent(event) {
  if (event.seq && state.seenSeqs.has(event.seq)) return;
  if (event.seq) state.seenSeqs.add(event.seq);

  switch (event.type) {
    case 'user_transcript': {
      if (event.is_final) {
        if (state.interim) {
          state.interim = null;
          renderAll();
        }
        if (event.text && event.text.trim()) {
          const item = { kind: 'utterance', speaker: 'user', text: event.text, ts: event.ts };
          state.items.push(item);
          state.counts.user += 1;
          appendItem(item);
          renderCounts();
        }
      } else if (event.text || state.interim) {
        if (state.interim) {
          state.interim.text = event.text;
        } else {
          state.interim = { kind: 'utterance', speaker: 'user', text: event.text, ts: event.ts, interim: true };
        }
        const empty = document.getElementById('empty-state');
        if (empty) empty.remove();
        renderAll();
      }
      break;
    }

    case 'agent_response': {
      if (state.interim) {
        state.interim = null;
        renderAll();
      }
      if (event.text && event.text.trim()) {
        const item = { kind: 'utterance', speaker: 'agent', text: event.text, ts: event.ts };
        state.items.push(item);
        state.counts.agent += 1;
        appendItem(item);
        renderCounts();
      }
      break;
    }

    case 'interruption': {
      state.counts.interruption += 1;
      const item = { kind: 'note', key: 'note.interruption', ts: event.ts, level: 'warn' };
      state.items.push(item);
      appendItem(item);
      renderCounts();
      break;
    }

    case 'dtmf': {
      const item = { kind: 'note', key: 'note.dtmf', params: { digits: event.digits }, ts: event.ts };
      state.items.push(item);
      appendItem(item);
      break;
    }

    case 'bridge_error': {
      const item = {
        kind: 'note',
        key: 'note.bridgeError',
        params: { detail: event.detail },
        ts: event.ts,
        level: 'error',
      };
      state.items.push(item);
      appendItem(item);
      break;
    }

    case 'call_event': {
      const status = event.call_event;
      if (status === 'answered') {
        setActiveCall(event.call_uuid, event.from, event.to);
        addNote('note.callAnswered', { from: event.from || '-' }, event.ts);
      } else if (status === 'bridge_connected') {
        setActiveCall(event.call_uuid);
        addNote('note.bridgeConnected', null, event.ts);
      } else if (status === 'conversation_started') {
        addNote('note.conversationStarted', null, event.ts);
      } else if (status === 'bridge_disconnected') {
        clearActiveCall(event.call_uuid);
        addNote('note.bridgeDisconnected', null, event.ts, 'warn');
      } else if (status === 'completed') {
        clearActiveCall(event.call_uuid);
        addNote('note.callCompleted', null, event.ts, 'warn');
      } else if (status === 'disconnected') {
        clearActiveCall(event.call_uuid);
        addNote('note.callDisconnected', null, event.ts, 'warn');
      } else {
        addNote('note.callEvent', { status }, event.ts);
      }
      break;
    }

    case 'language_changed': {
      if (getLang() !== event.language) {
        setLang(event.language);
        renderAll();
        setBadge(sseBadgeKey);
      }
      addNote('note.languageSwitched', { lang: displayLanguage(event.language) }, event.ts);
      break;
    }

    default: {
      addNote('note.callEvent', { status: `${event.type}: ${JSON.stringify(event)}` }, event.ts);
    }
  }
}

function addNote(key, params, ts, level) {
  const item = { kind: 'note', key, params, ts, level };
  state.items.push(item);
  appendItem(item);
}

//---- SSE ----

let sseBadgeKey = 'badge.disconnected';

function setBadge(key) {
  sseBadgeKey = key;
  sseStatusEl.textContent = t(key);
  sseStatusEl.className = key === 'badge.connected' ? 'badge badge-on' : 'badge badge-off';
}

function connect() {
  const source = new EventSource('/admin/events');

  source.onopen = () => setBadge('badge.connected');

  source.onmessage = (message) => {
    try {
      handleEvent(JSON.parse(message.data));
    } catch (error) {
      console.error('Failed to parse SSE message:', error);
    }
  };

  source.onerror = () => setBadge('badge.reconnecting');
}

//---- language toggle ----

langToggleEl.addEventListener('click', () => {
  const next = getLang() === 'ja' ? 'en' : 'ja';
  setLang(next);
  renderAll();
  setBadge(sseBadgeKey);
  // Persist server-side so the greeting TTS and the ElevenLabs agent follow.
  fetch('/admin/api/language', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: next }),
  }).catch((error) => console.error('Failed to persist language:', error));
});

//---- init ----

renderAll();
setBadge('badge.disconnected');
connect();
