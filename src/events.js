'use strict';

const MAX_EVENTS = 500;

class EventBus {
  constructor() {
    this.listeners = new Set();
    this.history = [];
    this.seq = 0;
  }

  publish(event) {
    const record = {
      seq: ++this.seq,
      ts: event.ts || new Date().toISOString(),
      ...event,
    };

    this.history.push(record);
    if (this.history.length > MAX_EVENTS) {
      this.history.splice(0, this.history.length - MAX_EVENTS);
    }

    for (const listener of this.listeners) {
      try {
        listener(record);
      } catch (error) {
        console.error('EventBus listener error:', error);
      }
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  replay() {
    return this.history.slice();
  }
}

module.exports = { EventBus, MAX_EVENTS };
