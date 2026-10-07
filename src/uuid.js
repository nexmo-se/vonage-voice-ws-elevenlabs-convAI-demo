'use strict';

// Vonage conversation UUIDs come in two formats:
// 1. Standard UUID with hyphens: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
// 2. Vonage compact format: 32 hex chars without hyphens (e.g., 368464c5546ddfccdc682950777233df)
// Both are accepted. Restricting to these formats blocks direct-browser / external abuse.
const UUID_RE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/i;

function isValidPeerUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

module.exports = { isValidPeerUuid, UUID_RE };