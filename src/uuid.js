'use strict';

// Vonage conversation UUIDs are standard v4 UUIDs. Restricting the media
// WebSocket to this format blocks direct-browser / external abuse (which also
// makes recording filenames safe from path traversal).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidPeerUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

module.exports = { isValidPeerUuid, UUID_RE };