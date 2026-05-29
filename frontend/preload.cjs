const { webcrypto } = require('crypto');
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.getRandomValues) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    enumerable: true,
    writable: true
  });
}

try {
  const dc = require('diagnostics_channel');
  if (!dc.tracingChannel) {
    dc.tracingChannel = (name) => ({
      subscribe: () => {},
      unsubscribe: () => {},
      traceSync: (fn) => fn(),
      tracePromise: (fn) => fn(),
      hasSubscribers: false
    });
  }
} catch (e) {
  // ignore
}
