'use strict';

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const settings = require('./settings');

const PACKET_BYTES = 640; // 20 ms of 16 kHz 16-bit mono PCM
const PACE_TIMER_MS = 18; // slightly under 20 ms so packets stay ahead of real time

function timestamp() {
  return new Date().toISOString();
}

function buildConversationInitiationData(config, language) {
  const override = { agent: {}, tts: {} };

  if (config.agentPrompt) override.agent.prompt = { prompt: config.agentPrompt };
  if (config.agentFirstMessage) override.agent.first_message = config.agentFirstMessage;
  const agentLanguage = config.agentLanguage || language;
  if (agentLanguage) override.agent.language = agentLanguage;
  if (config.elevenLabsVoiceId) override.tts.voice_id = config.elevenLabsVoiceId;

  return {
    type: 'conversation_initiation_client_data',
    conversation_config_override: override,
  };
}

function createBridge(config, bus) {
  if (config.recordAllAudio) {
    fs.mkdirSync(config.recordingsDir, { recursive: true });
  }

  return function handleVonageSocket(ws, req) {
    const url = new URL(req.url, 'http://localhost');
    const peerUuid = url.searchParams.get('peer_uuid') || 'unknown';

    console.log(`>>> Vonage WebSocket connected: peer_uuid=${peerUuid}`);

    bus.publish({
      type: 'call_event',
      call_event: 'bridge_connected',
      call_uuid: peerUuid,
    });

    let vonageOpen = true;
    let elevenLabsOpen = false;
    let closing = false;

    let outboundBuffer = Buffer.alloc(0);
    let outboundIndex = 0;

    const recordPath = config.recordAllAudio
      ? {
          toElevenLabs: path.join(config.recordingsDir, `${peerUuid}_to_11l_${Date.now()}.raw`),
          toVonage: path.join(config.recordingsDir, `${peerUuid}_to_vg_${Date.now()}.raw`),
        }
      : null;

    if (recordPath) {
      fs.writeFileSync(recordPath.toElevenLabs, '');
      fs.writeFileSync(recordPath.toVonage, '');
    }

    const elevenLabsUrl =
      `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${encodeURIComponent(config.elevenLabsAgentId)}`;

    const elevenLabsWs = new WebSocket(elevenLabsUrl, {
      headers: { 'xi-api-key': config.elevenLabsApiKey },
    });

    const paceTimer = setInterval(() => {
      if (outboundBuffer.length === 0 || !vonageOpen) return;

      const chunk = outboundBuffer.subarray(outboundIndex, outboundIndex + PACKET_BYTES);

      if (chunk.length === PACKET_BYTES) {
        ws.send(chunk);
        outboundIndex += PACKET_BYTES;

        if (recordPath) {
          fs.appendFile(recordPath.toVonage, chunk, () => {});
        }
      } else if (chunk.length === 0) {
        outboundIndex = 0;
        outboundBuffer = Buffer.alloc(0);
      }

      if (outboundIndex >= outboundBuffer.length) {
        outboundIndex = 0;
        outboundBuffer = Buffer.alloc(0);
      }
    }, PACE_TIMER_MS);

    function clearOutbound() {
      outboundBuffer = Buffer.alloc(0);
      outboundIndex = 0;
    }

    function closeAll() {
      if (closing) return;
      closing = true;
      clearInterval(paceTimer);

      if (elevenLabsOpen || elevenLabsWs.readyState === WebSocket.OPEN) {
        try {
          elevenLabsWs.close();
        } catch (error) {
          console.error('Error closing ElevenLabs WebSocket:', error.message);
        }
      }
    }

    //---- ElevenLabs event handling ----

    elevenLabsWs.on('open', () => {
      console.log('>>> ElevenLabs WebSocket opened');

      const initMessage = buildConversationInitiationData(
        config,
        settings.getLanguage()
      );

      elevenLabsWs.send(JSON.stringify(initMessage));
      elevenLabsOpen = true;
    });

    elevenLabsWs.on('message', (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch (error) {
        console.error('Invalid JSON from ElevenLabs:', error.message);
        return;
      }

      switch (data.type) {
        case 'audio': {
          const payload = Buffer.from(data.audio_event.audio_base_64, 'base64');
          outboundBuffer = Buffer.concat([outboundBuffer, payload]);
          break;
        }

        case 'user_transcript': {
          const text = data.user_transcription_event.user_transcript;
          const isFinal = data.user_transcription_event.is_final;
          console.log(`>>> [user] ${text}`);
          bus.publish({
            type: 'user_transcript',
            speaker: 'user',
            text,
            is_final: isFinal !== false,
            call_uuid: peerUuid,
          });
          break;
        }

        case 'agent_response': {
          const text = data.agent_response_event.agent_response;
          console.log(`>>> [bot] ${text}`);
          bus.publish({
            type: 'agent_response',
            speaker: 'agent',
            text,
            call_uuid: peerUuid,
          });
          break;
        }

        case 'interruption': {
          // ElevenLabs VAD detected the user interrupting the agent:
          // drop queued agent audio and flush what Vonage already buffered.
          clearOutbound();
          if (vonageOpen) {
            ws.send(JSON.stringify({ action: 'clear' }));
          }
          console.log('>>> interruption (barge-in): cleared Vonage buffer');
          bus.publish({
            type: 'interruption',
            call_uuid: peerUuid,
          });
          break;
        }

        case 'ping': {
          if (elevenLabsOpen) {
            elevenLabsWs.send(
              JSON.stringify({
                type: 'pong',
                event_id: data.ping_event.event_id,
              })
            );
          }
          break;
        }

        case 'conversation_initiation_metadata': {
          bus.publish({
            type: 'call_event',
            call_event: 'conversation_started',
            call_uuid: peerUuid,
          });
          break;
        }

        case 'vad_score':
        case 'internal_tentative_agent_response':
          break;

        default:
          if (data.type && data.type.startsWith('error')) {
            console.error('ElevenLabs error event:', JSON.stringify(data));
            bus.publish({
              type: 'bridge_error',
              detail: JSON.stringify(data),
              call_uuid: peerUuid,
            });
          } else {
            console.log('ElevenLabs event:', data.type);
          }
      }
    });

    elevenLabsWs.on('error', (error) => {
      console.error('ElevenLabs WebSocket error:', error.message);
      bus.publish({
        type: 'bridge_error',
        detail: error.message,
        call_uuid: peerUuid,
      });
    });

    elevenLabsWs.on('close', (code, reason) => {
      elevenLabsOpen = false;
      console.log(`>>> ElevenLabs WebSocket closed: ${code} ${reason.toString()}`);
      if (vonageOpen) {
        clearOutbound();
        try {
          ws.close();
        } catch (error) {
          /* noop */
        }
      }
      closeAll();
    });

    //---- Vonage event handling ----

    // express-ws uses ws@7, whose message event has no isBinary flag:
    // binary frames arrive as Buffer, text frames as string.
    ws.on('message', (msg) => {
      if (Buffer.isBuffer(msg)) {
        if (!elevenLabsOpen) return;
        elevenLabsWs.send(JSON.stringify({ user_audio_chunk: msg.toString('base64') }));
        if (recordPath) {
          fs.appendFile(recordPath.toElevenLabs, msg, () => {});
        }
        return;
      }

      let event;
      try {
        event = JSON.parse(String(msg));
      } catch (error) {
        console.log('Vonage text frame:', msg.toString());
        return;
      }

      switch (event.event) {
        case 'websocket:connected':
          console.log('>>> Vonage WebSocket connected event:', event['content-type']);
          break;
        case 'websocket:cleared':
          console.log('>>> Vonage cleared its playback buffer');
          break;
        case 'websocket:dtmf':
          console.log('>>> DTMF:', event.dtmf);
          bus.publish({
            type: 'dtmf',
            digits: event.dtmf,
            call_uuid: peerUuid,
          });
          break;
        default:
          console.log('Vonage event:', JSON.stringify(event));
      }
    });

    ws.on('close', () => {
      vonageOpen = false;
      console.log('>>> Vonage WebSocket closed');
      bus.publish({
        type: 'call_event',
        call_event: 'bridge_disconnected',
        call_uuid: peerUuid,
      });
      clearOutbound();
      closeAll();
    });

    ws.on('error', (error) => {
      console.error('Vonage WebSocket error:', error.message);
      closeAll();
    });
  };
}

module.exports = { createBridge, buildConversationInitiationData };
