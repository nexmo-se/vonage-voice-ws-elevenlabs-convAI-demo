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

// Keep the rendered transcript bounded (mirrors the server-side 500-event cap):
// drop the oldest once it grows past 1000, so DOM/memory stay flat on long calls.
const MAX_ITEMS = 500;

const state = {
  seenSeqs: new Set(),
  seenSeqOrder: [],
  items: [], // {kind:'utterance'|'note', ...}
  interim: null,
  counts: { user: 0, agent: 0, interruption: 0 },
  call: { active: false, from: '', to: '', uuids: new Set() },
};

// Keep the seq dedup set bounded: keep the most recent 500 seen by dropping
// the oldest once the window grows past 1000.
function markSeen(seq) {
  state.seenSeqs.add(seq);
  state.seenSeqOrder.push(seq);
  if (state.seenSeqOrder.length > 1000) {
    const dropped = state.seenSeqOrder.splice(0, state.seenSeqOrder.length - 500);
    for (const droppedSeq of dropped) state.seenSeqs.delete(droppedSeq);
  }
}

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

function addItem(item) {
  state.items.push(item);
  if (state.items.length > MAX_ITEMS) {
    // Drop the oldest entries and their matching DOM nodes to keep the
    // transcript bounded on long calls.
    const overflow = state.items.splice(0, state.items.length - MAX_ITEMS);
    for (let i = 0; i < overflow.length && transcriptEl.firstChild; i++) {
      const firstChild = transcriptEl.firstChild;
      // Skip the empty-state placeholder if it's still at the top.
      if (firstChild.id === 'empty-state') {
        firstChild.remove();
        i--; // don't count empty-state against overflow
        continue;
      }
      transcriptEl.removeChild(firstChild);
    }
  }
  appendItem(item);
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
  if (event.seq) markSeen(event.seq);

  switch (event.type) {
    case 'user_transcript': {
      if (event.is_final) {
        if (state.interim) {
          state.interim = null;
          renderAll();
        }
        if (event.text && event.text.trim()) {
          const item = { kind: 'utterance', speaker: 'user', text: event.text, ts: event.ts };
          state.counts.user += 1;
          addItem(item);
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
        state.counts.agent += 1;
        addItem(item);
        renderCounts();
      }
      break;
    }

    case 'interruption': {
      state.counts.interruption += 1;
      const item = { kind: 'note', key: 'note.interruption', ts: event.ts, level: 'warn' };
      addItem(item);
      renderCounts();
      break;
    }

    case 'dtmf': {
      const item = { kind: 'note', key: 'note.dtmf', params: { digits: event.digits }, ts: event.ts };
      addItem(item);
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
      addItem(item);
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
  addItem(item);
}

//---- SSE ----

let sseBadgeKey = 'badge.disconnected';
let eventSource = null;
let lastSeq = 0;

function setBadge(key) {
  sseBadgeKey = key;
  sseStatusEl.textContent = t(key);
  sseStatusEl.className = key === 'badge.connected' ? 'badge badge-on' : 'badge badge-off';
}

async function syncState() {
  try {
    const resp = await fetch(`/admin/api/state?since=${lastSeq}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (resp.status === 401) {
      console.warn('Session expired or invalid, redirecting to login...');
      window.location.href = '/login';
      return;
    }
    if (!resp.ok) return;
    const payload = await resp.json();
    for (const event of payload.events || []) {
      if (event.seq > lastSeq) lastSeq = event.seq;
      handleEvent(event);
    }
  } catch (error) {
    // Network error; retry on the next poll tick.
    console.warn('State poll failed:', error);
  }
}

function connect() {
  if (eventSource) {
    eventSource.close();
  }

  // Use withCredentials to send session cookie
  const source = new EventSource('/admin/events', { withCredentials: true });
  eventSource = source;

  source.onopen = () => {
    console.log('SSE connected, readyState:', source.readyState);
    setBadge('badge.connected');
  };

  source.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data);
      if (event.seq > lastSeq) lastSeq = event.seq;
      handleEvent(event);
    } catch (error) {
      console.error('Failed to parse SSE message:', error);
    }
  };

  source.onerror = (err) => {
    console.warn('SSE error:', err, 'readyState:', source.readyState);
    setBadge('badge.reconnecting');

    // If unauthorized, likely session expired or wrong domain -> redirect to login
    // EventSource doesn't expose status code, but we can detect by trying a fetch
    if (source.readyState === EventSource.CLOSED) {
      checkAuthAndRedirect();
    } else {
      // EventSource auto-reconnects, but force reconnect after delay if needed
      setTimeout(() => {
        if (eventSource && eventSource.readyState === EventSource.CLOSED) {
          console.log('SSE reconnecting...');
          connect();
        }
      }, 3000);
    }
  };
}

async function checkAuthAndRedirect() {
  try {
    const resp = await fetch('/admin/api/state', { credentials: 'include' });
    if (resp.status === 401) {
      console.warn('Session expired or invalid, redirecting to login...');
      window.location.href = '/login';
    }
  } catch (e) {
    console.warn('Auth check failed:', e);
  }
}

// Expose for debugging
window.__sseReconnect = connect;
window.__checkAuth = checkAuthAndRedirect;

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

// Reliable fallback transport: poll the state endpoint so the transcript and
// call panel render even when SSE is buffered/blocked by proxies (e.g. the
// trycloudflare tunnel). The seq-based dedup in handleEvent prevents duplicates
// when both SSE and polling deliver the same event.
syncState();
setInterval(syncState, 1500);
