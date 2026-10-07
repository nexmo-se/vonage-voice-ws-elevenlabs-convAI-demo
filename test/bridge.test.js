'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { buildConversationInitiationData } = require('../src/bridge');

test('buildConversationInitiationData: only voice_id is sent when set', () => {
  const data = buildConversationInitiationData(
    { elevenLabsVoiceId: 'voice-9' },
    'ja'
  );
  assert.strictEqual(data.conversation_config_override.tts.voice_id, 'voice-9');
  assert.deepStrictEqual(data.conversation_config_override.agent, {});
});

test('buildConversationInitiationData: empty result when nothing set', () => {
  const data = buildConversationInitiationData({}, '');
  assert.deepStrictEqual(data, {
    type: 'conversation_initiation_client_data',
    conversation_config_override: { agent: {}, tts: {} },
  });
});

test('buildConversationInitiationData: prompt/first_message/language are not sent', () => {
  const data = buildConversationInitiationData(
    { agentPrompt: 'test', agentFirstMessage: 'hi', agentLanguage: 'ja', elevenLabsVoiceId: '' },
    'en'
  );
  assert.deepStrictEqual(data.conversation_config_override.agent, {});
  assert.deepStrictEqual(data.conversation_config_override.tts, {});
});