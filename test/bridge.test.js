'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { buildConversationInitiationData } = require('../src/bridge');

const config = {
  agentPrompt: 'You are a helpful assistant.',
  agentFirstMessage: 'Hello!',
  agentLanguage: '',
  elevenLabsVoiceId: 'voice-9',
};

test('buildConversationInitiationData: follows the given language', () => {
  assert.strictEqual(
    buildConversationInitiationData(config, 'ja').conversation_config_override.agent.language,
    'ja'
  );
  assert.strictEqual(
    buildConversationInitiationData(config, 'en').conversation_config_override.agent.language,
    'en'
  );
});

test('buildConversationInitiationData: explicit AGENT_LANGUAGE wins', () => {
  const withFixed = { ...config, agentLanguage: 'de' };
  const data = buildConversationInitiationData(withFixed, 'en');
  assert.strictEqual(data.conversation_config_override.agent.language, 'de');
});

test('buildConversationInitiationData: optional fields are only included when set', () => {
  const data = buildConversationInitiationData(
    { agentPrompt: config.agentPrompt, agentLanguage: '', elevenLabsVoiceId: '' },
    'ja'
  );
  const override = data.conversation_config_override;

  assert.strictEqual(override.agent.prompt.prompt, config.agentPrompt);
  assert.ok(!('first_message' in override.agent));
  assert.strictEqual(override.agent.language, 'ja');
  assert.ok(!('voice_id' in override.tts));
  assert.strictEqual(data.type, 'conversation_initiation_client_data');
});

test('buildConversationInitiationData: empty result is well-formed', () => {
  const data = buildConversationInitiationData({}, '');
  assert.deepStrictEqual(data, {
    type: 'conversation_initiation_client_data',
    conversation_config_override: { agent: {}, tts: {} },
  });
});